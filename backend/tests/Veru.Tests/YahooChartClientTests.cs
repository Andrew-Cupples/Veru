using System.Net;
using System.Text;
using Veru.MarketData;
using Veru.MarketData.Yahoo;

namespace Veru.Tests;

public class YahooChartClientTests
{
    // 2026-11-13 (EST, UTC-5): pre 04:00, regular 09:30-16:00, post 16:00-20:00.
    private const long Pre0400 = 1794560400;
    private const long Open0930 = 1794580200;
    private const long Close1600 = 1794603600;

    private static ChartQuery Query(bool extended = false, string interval = "15m") =>
        ChartQuery.TryCreate("TSLA", interval, "1mo", extended, out _)!;

    [Fact]
    public async Task Requests_the_chart_endpoint_with_query_parameters()
    {
        var handler = new StubHandler(HttpStatusCode.OK, Chart(timestamps: [Open0930], closes: [1]));
        var client = Client(handler);

        await client.GetPriceSeriesAsync(Query(extended: true), CancellationToken.None);

        Assert.Equal(
            "https://query1.finance.yahoo.com/v8/finance/chart/TSLA?interval=15m&range=1mo&includePrePost=true",
            handler.LastRequest!.RequestUri!.ToString());
    }

    [Fact]
    public async Task Maps_bars_to_exchange_time_with_four_decimal_precision()
    {
        var json = Chart(timestamps: [Open0930], closes: [392.9259948730469]);

        var series = await Client(new StubHandler(HttpStatusCode.OK, json)).GetPriceSeriesAsync(Query(), CancellationToken.None);

        var bar = Assert.Single(series.Bars);
        Assert.Equal(new DateTimeOffset(2026, 11, 13, 9, 30, 0, TimeSpan.FromHours(-5)), bar.Time);
        Assert.Equal(TimeSpan.FromHours(-5), bar.Time.Offset);
        Assert.Equal(392.9260m, bar.Close);
        Assert.Equal(MarketSession.Regular, bar.Session);
        Assert.Equal("Tesla, Inc.", series.Instrument.Name);
        Assert.Equal("America/New_York", series.Instrument.TimeZone);
    }

    [Fact]
    public async Task Drops_null_bars_and_the_snapshot_bar_stamped_at_the_close()
    {
        var json = Chart(timestamps: [Open0930, Open0930 + 900, Close1600], closes: [1, null, 3]);

        var series = await Client(new StubHandler(HttpStatusCode.OK, json)).GetPriceSeriesAsync(Query(), CancellationToken.None);

        Assert.Equal([Open0930], series.Bars.Select(b => b.Time.ToUnixTimeSeconds()));
    }

    [Fact]
    public async Task Labels_extended_hours_sessions_and_drops_the_off_grid_trailing_bar()
    {
        var json = Chart(
            timestamps: [Pre0400, Open0930, Close1600, Close1600 + 900, Close1600 + 1799],
            closes: [1, 2, 3, 4, 4],
            extended: true);

        var series = await Client(new StubHandler(HttpStatusCode.OK, json)).GetPriceSeriesAsync(Query(extended: true), CancellationToken.None);

        Assert.Equal(
            [MarketSession.Pre, MarketSession.Regular, MarketSession.Post, MarketSession.Post],
            series.Bars.Select(b => b.Session!.Value));
    }

    [Fact]
    public async Task Daily_bars_have_no_session()
    {
        var json = Chart(timestamps: [Open0930], closes: [1]);

        var series = await Client(new StubHandler(HttpStatusCode.OK, json)).GetPriceSeriesAsync(Query(interval: "1d"), CancellationToken.None);

        Assert.Null(Assert.Single(series.Bars).Session);
    }

    [Fact]
    public async Task Not_found_symbol_throws_SymbolNotFound()
    {
        const string body = """{"chart":{"result":null,"error":{"code":"Not Found","description":"No data found, symbol may be delisted"}}}""";

        await Assert.ThrowsAsync<SymbolNotFoundException>(() =>
            Client(new StubHandler(HttpStatusCode.NotFound, body)).GetPriceSeriesAsync(Query(), CancellationToken.None));
    }

    [Fact]
    public async Task Bad_request_surfaces_yahoos_reason()
    {
        const string body = """{"chart":{"result":null,"error":{"code":"Bad Request","description":"Only 8 days worth of 1m granularity data are allowed"}}}""";

        var ex = await Assert.ThrowsAsync<MarketDataRequestRejectedException>(() =>
            Client(new StubHandler(HttpStatusCode.BadRequest, body)).GetPriceSeriesAsync(Query(), CancellationToken.None));
        Assert.Contains("8 days", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Rate_limit_page_is_reported_as_unavailable()
    {
        var handler = new StubHandler(HttpStatusCode.TooManyRequests, "Too Many Requests", "text/html");

        var ex = await Assert.ThrowsAsync<MarketDataUnavailableException>(() =>
            Client(handler).GetPriceSeriesAsync(Query(), CancellationToken.None));
        Assert.Contains("rate limiting", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Network_failure_is_reported_as_unavailable()
    {
        var handler = new StubHandler(new HttpRequestException("connection refused"));

        await Assert.ThrowsAsync<MarketDataUnavailableException>(() =>
            Client(handler).GetPriceSeriesAsync(Query(), CancellationToken.None));
    }

    private static YahooChartClient Client(HttpMessageHandler handler) =>
        new(new HttpClient(handler) { BaseAddress = new Uri("https://query1.finance.yahoo.com/") });

    /// <summary>A trimmed-down copy of a real 2026-11-13 TSLA response.</summary>
    private static string Chart(long[] timestamps, double?[] closes, bool extended = false)
    {
        static string Arr(IEnumerable<string> v) => "[" + string.Join(",", v) + "]";
        var prices = Arr(closes.Select(c => c?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "null"));
        var volumes = Arr(closes.Select(c => c is null ? "null" : "1000"));
        const string regular = """[[{"timezone":"EST","start":1794580200,"end":1794603600,"gmtoffset":-18000}]]""";
        var tradingPeriods = extended
            ? $$"""{"pre":[[{"start":1794560400,"end":1794580200}]],"regular":{{regular}},"post":[[{"start":1794603600,"end":1794618000}]]}"""
            : regular;

        return $$"""
            {"chart":{"result":[{
              "meta":{"currency":"USD","symbol":"TSLA","fullExchangeName":"NasdaqGS","instrumentType":"EQUITY",
                "longName":"Tesla, Inc.","exchangeTimezoneName":"America/New_York","gmtoffset":-18000,
                "regularMarketTime":1794603600,"regularMarketPrice":390.22,"dataGranularity":"15m",
                "tradingPeriods":{{tradingPeriods}} },
              "timestamp":{{Arr(timestamps.Select(t => t.ToString(System.Globalization.CultureInfo.InvariantCulture)))}},
              "indicators":{"quote":[{"open":{{prices}},"high":{{prices}},"low":{{prices}},"close":{{prices}},"volume":{{volumes}} }]}
            }],"error":null} }
            """;
    }

    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly HttpStatusCode _status;
        private readonly string _body = "";
        private readonly string _mediaType = "application/json";
        private readonly Exception? _exception;

        public StubHandler(HttpStatusCode status, string body, string mediaType = "application/json")
        {
            _status = status;
            _body = body;
            _mediaType = mediaType;
        }

        public StubHandler(Exception exception) => _exception = exception;

        public HttpRequestMessage? LastRequest { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            if (_exception is not null) throw _exception;
            return Task.FromResult(new HttpResponseMessage(_status) { Content = new StringContent(_body, Encoding.UTF8, _mediaType) });
        }
    }
}
