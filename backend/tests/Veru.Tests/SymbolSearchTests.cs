using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Veru.MarketData;
using Veru.MarketData.Yahoo;

namespace Veru.Tests;

public class SymbolSearchTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public SymbolSearchTests(WebApplicationFactory<Program> factory) => _factory = factory;

    private HttpClient ClientWith(ISymbolSearch search) =>
        _factory.WithWebHostBuilder(b => b.ConfigureServices(s => s.AddSingleton(search))).CreateClient();

    /// <summary>Trimmed from a real 2026-11-14 response for "tes".</summary>
    private const string YahooBody = """
        {"explains":[],"count":3,"quotes":[
          {"exchange":"NMS","shortname":"Tesla, Inc.","quoteType":"EQUITY","symbol":"TSLA","typeDisp":"Equity","longname":"Tesla, Inc.","exchDisp":"NASDAQ"},
          {"exchange":"LSE","shortname":"TESCO PLC ORD 6 1/3P","quoteType":"EQUITY","symbol":"TSCO.L","typeDisp":"Equity","longname":"Tesco PLC","exchDisp":"London"},
          {"exchange":"CME","shortname":"Micro Tesla","quoteType":"FUTURE","symbol":"XTSLA=F","typeDisp":"Futures"},
          {"index":"news","shortname":"no symbol here"}
        ],"news":[]}
        """;

    [Fact]
    public async Task Yahoo_client_maps_quotes_and_skips_entries_without_a_symbol()
    {
        var handler = new StubHandler(HttpStatusCode.OK, YahooBody);
        var client = new YahooSearchClient(new HttpClient(handler) { BaseAddress = new Uri("https://query1.finance.yahoo.com/") });

        var matches = await client.SearchAsync(" tes ", 8, CancellationToken.None);

        Assert.Equal(
            "https://query1.finance.yahoo.com/v1/finance/search?q=tes&quotesCount=8&newsCount=0&listsCount=0&enableFuzzyQuery=false",
            handler.LastRequest!.RequestUri!.ToString());
        Assert.Equal(["TSLA", "TSCO.L", "XTSLA=F"], matches.Select(m => m.Symbol));
        Assert.Equal(new SymbolMatch("TSLA", "Tesla, Inc.", "NASDAQ", "Equity"), matches[0]);
        // Falls back to the short name and raw exchange code when the display fields are missing.
        Assert.Equal(new SymbolMatch("XTSLA=F", "Micro Tesla", "CME", "Futures"), matches[2]);
    }

    [Fact]
    public async Task Yahoo_client_reports_upstream_failure_as_unavailable()
    {
        var client = new YahooSearchClient(new HttpClient(new StubHandler(HttpStatusCode.TooManyRequests, "slow down", "text/html"))
        {
            BaseAddress = new Uri("https://query1.finance.yahoo.com/"),
        });

        await Assert.ThrowsAsync<MarketDataUnavailableException>(() => client.SearchAsync("tes", 8, CancellationToken.None));
    }

    [Fact]
    public async Task Cache_serves_repeat_searches_case_insensitively()
    {
        var inner = new FakeSearch(q => [new SymbolMatch(q.ToUpperInvariant(), null, null, null)]);
        var cache = new CachingSymbolSearch(inner, new MemoryCache(new MemoryCacheOptions()), Options.Create(new MarketDataOptions()));

        await cache.SearchAsync("tes", 8, CancellationToken.None);
        await cache.SearchAsync("TES ", 8, CancellationToken.None);
        await cache.SearchAsync("tes", 5, CancellationToken.None);

        Assert.Equal(2, inner.Calls);
    }

    [Fact]
    public async Task Endpoint_returns_matches()
    {
        string? seen = null;
        var search = new FakeSearch(q => { seen = q; return [new SymbolMatch("TSLA", "Tesla, Inc.", "NASDAQ", "Equity")]; });

        var json = await ClientWith(search).GetFromJsonAsync<JsonElement>("/api/market/search?q=tesla");

        Assert.Equal("tesla", seen);
        var first = json.GetProperty("matches")[0];
        Assert.Equal("TSLA", first.GetProperty("symbol").GetString());
        Assert.Equal("Tesla, Inc.", first.GetProperty("name").GetString());
        Assert.Equal("NASDAQ", first.GetProperty("exchange").GetString());
    }

    [Fact]
    public async Task Empty_query_answers_without_calling_upstream()
    {
        var search = new FakeSearch(_ => throw new InvalidOperationException("not called"));

        var json = await ClientWith(search).GetFromJsonAsync<JsonElement>("/api/market/search?q=%20");

        Assert.Equal(0, json.GetProperty("matches").GetArrayLength());
    }

    [Theory]
    [InlineData("/api/market/search?q=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "q")]
    [InlineData("/api/market/search?q=a&limit=0", "limit")]
    [InlineData("/api/market/search?q=a&limit=21", "limit")]
    public async Task Invalid_search_returns_validation_problem(string url, string field)
    {
        var response = await ClientWith(new FakeSearch(_ => [])).GetAsync(url);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(problem.GetProperty("errors").TryGetProperty(field, out _));
    }

    [Fact]
    public async Task Upstream_failure_maps_to_bad_gateway()
    {
        var response = await ClientWith(new FakeSearch(_ => throw new MarketDataUnavailableException("down"))).GetAsync("/api/market/search?q=a");

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
    }

    private sealed class FakeSearch(Func<string, IReadOnlyList<SymbolMatch>> respond) : ISymbolSearch
    {
        public int Calls { get; private set; }

        public Task<IReadOnlyList<SymbolMatch>> SearchAsync(string query, int limit, CancellationToken cancellationToken)
        {
            Calls++;
            return Task.FromResult(respond(query));
        }
    }

    private sealed class StubHandler(HttpStatusCode status, string body, string mediaType = "application/json") : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, mediaType) });
        }
    }
}
