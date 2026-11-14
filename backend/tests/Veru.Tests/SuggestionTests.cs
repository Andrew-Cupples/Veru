using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Veru.Tests;

public sealed class SuggestionTests : IClassFixture<WebApplicationFactory<Program>>, IDisposable
{
    private readonly string _dir = Path.Combine(Path.GetTempPath(), $"veru-suggestions-{Guid.NewGuid():N}");
    private readonly HttpClient _client;

    public SuggestionTests(WebApplicationFactory<Program> factory)
    {
        // Each test class gets its own database file, in a folder that doesn't exist yet (the store creates it).
        _client = factory.WithWebHostBuilder(b => b.UseSetting("Suggestions:DatabasePath", Path.Combine(_dir, "test.db"))).CreateClient();
    }

    public void Dispose()
    {
        _client.Dispose();
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        if (Directory.Exists(_dir)) Directory.Delete(_dir, recursive: true);
    }

    [Fact]
    public async Task Saves_a_suggestion_and_lists_it_newest_first()
    {
        var first = await _client.PostAsJsonAsync("/api/suggestions", new { feature = "reports", kind = "like", message = "  Love the compare view  ", page = "Reports" });
        var second = await _client.PostAsJsonAsync("/api/suggestions", new { feature = "other", otherFeature = "Alerts", kind = "want", message = "Price alerts" });

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        var saved = await first.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Love the compare view", saved.GetProperty("message").GetString());
        Assert.Equal(JsonValueKind.Null, saved.GetProperty("otherFeature").ValueKind);

        var list = await _client.GetFromJsonAsync<JsonElement>("/api/suggestions");
        Assert.Equal(2, list.GetArrayLength());
        Assert.Equal("Alerts", list[0].GetProperty("otherFeature").GetString());
        Assert.Equal("reports", list[1].GetProperty("feature").GetString());
        Assert.Equal("Reports", list[1].GetProperty("page").GetString());
    }

    [Theory]
    [InlineData("""{"feature":"nope","kind":"like","message":"x"}""", "feature")]
    [InlineData("""{"feature":"other","kind":"like","message":"x"}""", "otherFeature")]
    [InlineData("""{"feature":"reports","kind":"meh","message":"x"}""", "kind")]
    [InlineData("""{"feature":"reports","kind":"like","message":"   "}""", "message")]
    public async Task Rejects_incomplete_suggestions(string body, string field)
    {
        var response = await _client.PostAsync("/api/suggestions", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(problem.GetProperty("errors").TryGetProperty(field, out _));
    }

    [Fact]
    public async Task Rejects_overlong_messages()
    {
        var response = await _client.PostAsJsonAsync("/api/suggestions", new { feature = "reports", kind = "want", message = new string('a', 2001) });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
