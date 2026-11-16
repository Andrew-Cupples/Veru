using Veru.MarketData;

namespace Veru.Tests;

public class DailySummaryTests
{
    private static readonly TimeSpan NewYork = TimeSpan.FromHours(-5);

    private static PriceBar Bar(int day, int hour, decimal low, decimal high, long volume) =>
        new(new DateTimeOffset(2026, 11, day, hour, 0, 0, NewYork), MarketSession.Regular, low, high, low, high, volume);

    [Fact]
    public void Groups_bars_by_exchange_local_day_oldest_first()
    {
        var days = DailySummaries.ByDay([Bar(14, 10, 3m, 4m, 5), Bar(13, 9, 1m, 2m, 10), Bar(13, 15, 3m, 6m, 20)]);

        Assert.Equal(
            [new DailySummary(new DateOnly(2026, 11, 13), 2m, 4m, 30), new DailySummary(new DateOnly(2026, 11, 14), 3m, 4m, 5)],
            days);
    }

    [Fact]
    public void Averages_round_to_four_decimal_places_half_away_from_zero()
    {
        // Lows average to 40.29585 exactly, highs to 49.753366...
        var day = Assert.Single(DailySummaries.ByDay([Bar(13, 9, 40.2958m, 49.7534m, 1), Bar(13, 10, 40.2959m, 49.7533m, 1), Bar(13, 11, 40.29585m, 49.75336m, 1)]));

        Assert.Equal(40.2959m, day.LowAverage);
        Assert.Equal(49.7534m, day.HighAverage);
    }

    [Fact]
    public void Late_evening_bars_stay_on_their_local_day()
    {
        // 19:45 in New York is 00:45 UTC the next day; it belongs to the 13th.
        var day = Assert.Single(DailySummaries.ByDay([Bar(13, 19, 1m, 2m, 1)]));

        Assert.Equal(new DateOnly(2026, 11, 13), day.Day);
    }

    [Fact]
    public void No_bars_means_no_days() => Assert.Empty(DailySummaries.ByDay([]));
}
