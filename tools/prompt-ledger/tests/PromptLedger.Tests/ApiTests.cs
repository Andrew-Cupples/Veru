using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc.Testing;
using PromptLedger.Api;
using PromptLedger.Core.Domain;

namespace PromptLedger.Tests;

public sealed class ApiTests : IAsyncLifetime
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
    private static readonly DateTimeOffset T0 = new(2026, 11, 14, 12, 0, 0, TimeSpan.Zero);

    private TestDb _db = null!;
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        _db = await TestDb.CreateAsync();
        await using (var ctx = _db.Open())
        {
            ctx.Sessions.Add(new Session { Id = "s1", StartedAt = T0 });
            ctx.Prompts.AddRange(
                new Prompt { SessionId = "s1", Sequence = 1, Text = "First prompt", SubmittedAt = T0 },
                new Prompt { SessionId = "s1", Sequence = 2, Text = "Second prompt", SubmittedAt = T0.AddMinutes(1) });
            await ctx.SaveChangesAsync();
        }

        var temp = Path.GetDirectoryName(_db.File)!;
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b => b
            .UseSetting("Ledger:DatabaseFile", _db.File)
            .UseSetting("Ledger:RepoRoot", temp)
            .UseSetting("Ledger:TranscriptDirectory", Path.Combine(temp, "no-such-dir")));
        _client = _factory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
        await _db.DisposeAsync();
    }

    [Fact]
    public async Task Patch_updates_annotations_and_picks_up_hashtags_from_the_comment()
    {
        var response = await _client.PatchAsJsonAsync("/api/prompts/1",
            new { humanReviewed = true, comment = "Solid answer #architecture #DB", outcome = "Kept", rationale = "Pick a DB" }, Json);
        response.EnsureSuccessStatusCode();

        var prompt = (await response.Content.ReadFromJsonAsync<PromptDetailDto>(Json))!;
        Assert.True(prompt.HumanReviewed);
        Assert.NotNull(prompt.ReviewedAt);
        Assert.Equal(PromptOutcome.Kept, prompt.Outcome);
        Assert.Equal(["architecture", "db"], prompt.Tags);

        var filtered = await _client.GetFromJsonAsync<PagedResult<PromptSummaryDto>>("/api/prompts?tags=db&reviewed=true", Json);
        Assert.Equal(1, filtered!.Total);
        Assert.Equal(1, filtered.Items[0].Id);
    }

    [Fact]
    public async Task Clearing_review_resets_the_reviewed_timestamp()
    {
        await _client.PatchAsJsonAsync("/api/prompts/2", new { humanReviewed = true }, Json);
        var response = await _client.PatchAsJsonAsync("/api/prompts/2", new { humanReviewed = false }, Json);
        var prompt = (await response.Content.ReadFromJsonAsync<PromptDetailDto>(Json))!;
        Assert.False(prompt.HumanReviewed);
        Assert.Null(prompt.ReviewedAt);
    }

    [Fact]
    public async Task Renaming_a_tag_onto_an_existing_one_merges_them()
    {
        await _client.PutAsJsonAsync("/api/prompts/1/tags", new { tags = new[] { "ui" } }, Json);
        await _client.PutAsJsonAsync("/api/prompts/2/tags", new { tags = new[] { "frontend", "ui" } }, Json);

        var response = await _client.PatchAsJsonAsync("/api/tags/ui", new { name = "frontend", color = "#7c3aed" }, Json);
        response.EnsureSuccessStatusCode();
        var merged = (await response.Content.ReadFromJsonAsync<TagDto>(Json))!;
        Assert.Equal("frontend", merged.Name);
        Assert.Equal(2, merged.PromptCount);
        Assert.Equal("#7c3aed", merged.Color);

        var tags = await _client.GetFromJsonAsync<List<TagDto>>("/api/tags", Json);
        Assert.Equal(["frontend"], tags!.Select(t => t.Name));
    }

    [Fact]
    public async Task Invalid_requests_return_problem_details()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/prompts/999")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.GetAsync("/api/prompts?pageSize=5000")).StatusCode);

        var badChange = await _client.PostAsJsonAsync("/api/manual-changes", new { title = " ", relatedPromptId = 42 }, Json);
        Assert.Equal(HttpStatusCode.BadRequest, badChange.StatusCode);
        var body = await badChange.Content.ReadAsStringAsync();
        Assert.Contains("title", body, StringComparison.Ordinal);
        Assert.Contains("relatedPromptId", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Settings_round_trip_arbitrary_json()
    {
        var theme = new { accent = "#ff6b35", density = "compact", panels = new[] { "tags", "timeline" } };
        (await _client.PutAsJsonAsync("/api/settings/theme", theme, Json)).EnsureSuccessStatusCode();

        var setting = await _client.GetFromJsonAsync<SettingDto>("/api/settings/theme", Json);
        Assert.Equal("compact", setting!.Value.GetProperty("density").GetString());
    }

    [Fact]
    public async Task Openapi_document_is_served()
    {
        var doc = await _client.GetStringAsync("/openapi/v1.json");
        Assert.Contains("/api/prompts", doc, StringComparison.Ordinal);
    }
}
