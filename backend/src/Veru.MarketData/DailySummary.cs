namespace Veru.MarketData;

/// <summary>One trading day of bars, summarised.</summary>
/// <param name="Day">Calendar date in the exchange's local time zone.</param>
/// <param name="LowAverage">Mean of the day's bar lows, rounded to 4 decimal places.</param>
/// <param name="HighAverage">Mean of the day's bar highs, rounded to 4 decimal places.</param>
/// <param name="Volume">Total volume traded across the day's bars.</param>
public sealed record DailySummary(DateOnly Day, decimal LowAverage, decimal HighAverage, long Volume);

public static class DailySummaries
{
    /// <summary>Decimal places for the averages, matching the precision of the bars themselves.</summary>
    public const int Precision = 4;

    /// <summary>Groups bars by their exchange-local date, oldest day first.</summary>
    public static IReadOnlyList<DailySummary> ByDay(IEnumerable<PriceBar> bars) =>
        bars
            .GroupBy(b => DateOnly.FromDateTime(b.Time.DateTime))
            .OrderBy(g => g.Key)
            .Select(g => new DailySummary(
                g.Key,
                Round(g.Average(b => b.Low)),
                Round(g.Average(b => b.High)),
                g.Sum(b => b.Volume)))
            .ToList();

    /// <summary>
    /// Rounds to exactly <see cref="Precision"/> places. Adding 0.0000m sets the decimal's scale to 4, so JSON
    /// always shows four digits (40.2958, 41.0000), as the assessment's sample does.
    /// </summary>
    private static decimal Round(decimal value) => Math.Round(value, Precision, MidpointRounding.AwayFromZero) + 0.0000m;
}
