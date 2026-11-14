using Veru.MarketData;

namespace Veru.Tests;

public class ChartQueryTests
{
    [Fact]
    public void Defaults_to_15_minute_bars_over_one_month()
    {
        var query = ChartQuery.TryCreate("tsla", null, null, false, out var errors);

        Assert.Empty(errors);
        Assert.NotNull(query);
        Assert.Equal("TSLA", query.Symbol);
        Assert.Equal("15m", query.Interval.Code);
        Assert.Equal("1mo", query.Range.Code);
    }

    [Theory]
    [InlineData("BRK-B")]
    [InlineData("^GSPC")]
    [InlineData("EURUSD=X")]
    [InlineData("rds.a")]
    [InlineData(" btc-usd ")]
    public void Accepts_yahoo_symbol_formats(string symbol)
    {
        Assert.NotNull(ChartQuery.TryCreate(symbol, null, null, false, out _));
    }

    [Theory]
    [InlineData("")]
    [InlineData("TS LA")]
    [InlineData("TSLA;DROP")]
    [InlineData("-TSLA")]
    [InlineData("ABCDEFGHIJKLMNOPQRSTU")]
    public void Rejects_malformed_symbols(string symbol)
    {
        Assert.Null(ChartQuery.TryCreate(symbol, null, null, false, out var errors));
        Assert.Contains("symbol", errors.Keys);
    }

    [Fact]
    public void Rejects_unknown_interval_and_range()
    {
        Assert.Null(ChartQuery.TryCreate("TSLA", "7m", "forever", false, out var errors));
        Assert.Contains("interval", errors.Keys);
        Assert.Contains("range", errors.Keys);
    }

    [Theory]
    [InlineData("1m", "5d", true)]
    [InlineData("1m", "1mo", false)]
    [InlineData("15m", "1mo", true)]
    [InlineData("15m", "3mo", false)]
    [InlineData("60m", "2y", true)]
    [InlineData("60m", "5y", false)]
    [InlineData("1d", "max", true)]
    public void Enforces_how_far_back_each_interval_reaches(string interval, string range, bool valid)
    {
        var query = ChartQuery.TryCreate("TSLA", interval, range, false, out var errors);
        Assert.Equal(valid, query is not null);
        Assert.Equal(!valid, errors.ContainsKey("range"));
    }
}
