using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Veru.MarketData;

namespace Veru.Tests;

public class ApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ApiTests(WebApplicationFactory<Program> factory) => _factory = factory;

    private HttpClient ClientWith(IMarketDataProvider provider) =>
        _factory.WithWebHostBuilder(b => b.ConfigureServices(s => s.AddSingleton(provider))).CreateClient();

    [Fact]
    public async Task Returns_bars_and_instrument_as_json()
    {
        var bar = new PriceBar(new DateTimeOffset(2026, 11, 13, 9, 30, 0, TimeSpan.FromHours(-5)), MarketSession.Regular, 1.2346m, 2m, 1m, 1.5m, 42);
        var provider = new FakeProvider(_ => new PriceSeries(Instrument("TSLA"), "15m", [bar]));

        var json = await ClientWith(provider).GetFromJsonAsync<JsonElement>("/api/market/tsla/bars");

        Assert.Equal("TSLA", json.GetProperty("query").GetProperty("symbol").GetString());
        Assert.Equal("15m", json.GetProperty("query").GetProperty("interval").GetString());
        Assert.Equal("1mo", json.GetProperty("query").GetProperty("range").GetString());
        var first = json.GetProperty("bars")[0];
        Assert.Equal("2026-11-13T09:30:00-05:00", first.GetProperty("time").GetString());
        Assert.Equal("regular", first.GetProperty("session").GetString());
        Assert.Equal(1.2346m, first.GetProperty("open").GetDecimal());
        Assert.Equal(42, first.GetProperty("volume").GetInt64());
    }

    [Fact]
    public async Task Daily_returns_the_assessment_format_with_four_decimal_places()
    {
        var at = (int hour) => new DateTimeOffset(2026, 11, 13, hour, 0, 0, TimeSpan.FromHours(-5));
        var provider = new FakeProvider(_ => new PriceSeries(Instrument("TSLA"), "15m",
        [
            new PriceBar(at(9), MarketSession.Regular, 41m, 50m, 40m, 41m, 49_000_000),
            new PriceBar(at(10), MarketSession.Regular, 41m, 49.5068m, 40.5916m, 41m, 73_348),
        ]));

        var body = await ClientWith(provider).GetStringAsync("/api/market/tsla/daily");

        Assert.Equal("""[{"day":"2026-11-13","lowAverage":40.2958,"highAverage":49.7534,"volume":49073348}]""", body);
    }

    [Fact]
    public async Task Daily_keeps_four_decimal_places_on_round_numbers()
    {
        var bar = new PriceBar(new DateTimeOffset(2026, 11, 13, 9, 30, 0, TimeSpan.FromHours(-5)), MarketSession.Regular, 1m, 2m, 1m, 1m, 1);
        var body = await ClientWith(new FakeProvider(_ => new PriceSeries(Instrument("TSLA"), "15m", [bar]))).GetStringAsync("/api/market/tsla/daily");

        Assert.Contains("\"lowAverage\":1.0000,\"highAverage\":2.0000", body);
    }

    [Fact]
    public async Task Daily_unknown_symbol_is_not_found()
    {
        var response = await ClientWith(new FakeProvider(_ => throw new SymbolNotFoundException("NOPE"))).GetAsync("/api/market/NOPE/daily");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Passes_validated_parameters_to_the_provider()
    {
        ChartQuery? seen = null;
        var provider = new FakeProvider(q => { seen = q; return new PriceSeries(Instrument("SPY"), "5m", []); });

        var response = await ClientWith(provider).GetAsync("/api/market/spy/bars?interval=5m&range=5d&extendedHours=true");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new ChartQuery("SPY", ChartInterval.Find("5m")!, ChartRange.Find("5d")!, true), seen);
    }

    [Fact]
    public async Task Invalid_parameters_return_validation_problem()
    {
        var response = await ClientWith(new FakeProvider(_ => throw new InvalidOperationException("not called")))
            .GetAsync("/api/market/TSLA/bars?interval=1m&range=1y");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(problem.GetProperty("errors").TryGetProperty("range", out _));
    }

    [Theory]
    [InlineData("not-found", HttpStatusCode.NotFound)]
    [InlineData("rejected", HttpStatusCode.BadRequest)]
    [InlineData("unavailable", HttpStatusCode.BadGateway)]
    public async Task Provider_failures_map_to_problem_details(string failure, HttpStatusCode expected)
    {
        Exception exception = failure switch
        {
            "not-found" => new SymbolNotFoundException("TSLA"),
            "rejected" => new MarketDataRequestRejectedException("boom"),
            _ => new MarketDataUnavailableException("boom"),
        };
        var response = await ClientWith(new FakeProvider(_ => throw exception)).GetAsync("/api/market/TSLA/bars");

        Assert.Equal(expected, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Options_lists_intervals_ranges_and_defaults()
    {
        var json = await ClientWith(new FakeProvider(_ => throw new InvalidOperationException()))
            .GetFromJsonAsync<JsonElement>("/api/market/options");

        Assert.Equal("15m", json.GetProperty("defaultInterval").GetString());
        Assert.Equal("1mo", json.GetProperty("defaultRange").GetString());
        Assert.Contains(json.GetProperty("intervals").EnumerateArray(), i => i.GetProperty("code").GetString() == "1m");
    }

    private static Instrument Instrument(string symbol) =>
        new(symbol, null, null, null, "USD", "America/New_York", null, null, null, null, null, null, null, null, null);

    private sealed class FakeProvider(Func<ChartQuery, PriceSeries> respond) : IMarketDataProvider
    {
        public Task<PriceSeries> GetPriceSeriesAsync(ChartQuery query, CancellationToken cancellationToken) =>
            Task.FromResult(respond(query));
    }
}
