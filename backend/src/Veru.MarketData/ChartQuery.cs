using System.Text.RegularExpressions;

namespace Veru.MarketData;

/// <summary>A bar size the provider can serve, and how far back it reaches.</summary>
/// <param name="MaxLookbackDays">Oldest data available at this size, in days; null means full history.</param>
public sealed record ChartInterval(string Code, string Label, bool IsIntraday, int? MaxLookbackDays)
{
    public static readonly ChartInterval FifteenMinutes = new("15m", "15 minutes", true, 60);

    public static readonly IReadOnlyList<ChartInterval> All =
    [
        new("1m", "1 minute", true, 8),
        new("2m", "2 minutes", true, 60),
        new("5m", "5 minutes", true, 60),
        FifteenMinutes,
        new("30m", "30 minutes", true, 60),
        new("60m", "1 hour", true, 730),
        new("90m", "90 minutes", true, 60),
        new("1d", "1 day", false, null),
        new("1wk", "1 week", false, null),
        new("1mo", "1 month", false, null),
    ];

    public static ChartInterval? Find(string code) =>
        All.FirstOrDefault(i => string.Equals(i.Code, code, StringComparison.OrdinalIgnoreCase));
}

/// <summary>A lookback window ending now.</summary>
/// <param name="Days">Upper bound of the window in calendar days; null means all history.</param>
public sealed record ChartRange(string Code, string Label, int? Days)
{
    public static readonly ChartRange OneMonth = new("1mo", "1 month", 31);

    public static readonly IReadOnlyList<ChartRange> All =
    [
        new("1d", "1 day", 1),
        new("5d", "5 days", 5),
        OneMonth,
        new("3mo", "3 months", 92),
        new("6mo", "6 months", 183),
        new("ytd", "Year to date", 366),
        new("1y", "1 year", 366),
        new("2y", "2 years", 730),
        new("5y", "5 years", 1827),
        new("10y", "10 years", 3653),
        new("max", "All history", null),
    ];

    public static ChartRange? Find(string code) =>
        All.FirstOrDefault(r => string.Equals(r.Code, code, StringComparison.OrdinalIgnoreCase));

    /// <summary>Whether the provider can serve this whole window at the given bar size.</summary>
    public bool FitsWithin(ChartInterval interval) =>
        interval.MaxLookbackDays is not { } max || Days is { } days && days <= max;
}

/// <summary>A validated request for a symbol's price bars.</summary>
public sealed partial record ChartQuery(string Symbol, ChartInterval Interval, ChartRange Range, bool IncludeExtendedHours)
{
    /// <summary>
    /// Validates raw input. Defaults match the assessment: 15-minute bars over the last month.
    /// Returns null and fills <paramref name="errors"/> (keyed by parameter name) when anything is invalid.
    /// </summary>
    public static ChartQuery? TryCreate(
        string? symbol, string? interval, string? range, bool includeExtendedHours,
        out Dictionary<string, string[]> errors)
    {
        errors = [];

        var normalized = symbol?.Trim().ToUpperInvariant() ?? "";
        if (!SymbolPattern().IsMatch(normalized))
        {
            errors["symbol"] = ["Enter a stock ticker such as TSLA, BRK-B, ^GSPC or BTC-USD (up to 20 characters)."];
        }

        var chartInterval = string.IsNullOrWhiteSpace(interval) ? ChartInterval.FifteenMinutes : ChartInterval.Find(interval.Trim());
        if (chartInterval is null)
        {
            errors["interval"] = [$"Interval must be one of: {string.Join(", ", ChartInterval.All.Select(i => i.Code))}."];
        }

        var chartRange = string.IsNullOrWhiteSpace(range) ? ChartRange.OneMonth : ChartRange.Find(range.Trim());
        if (chartRange is null)
        {
            errors["range"] = [$"Range must be one of: {string.Join(", ", ChartRange.All.Select(r => r.Code))}."];
        }

        if (chartInterval is not null && chartRange is not null && !chartRange.FitsWithin(chartInterval))
        {
            errors["range"] = [$"{chartInterval.Label} bars only go back {chartInterval.MaxLookbackDays} days; choose a shorter range or a larger interval."];
        }

        return errors.Count == 0 ? new ChartQuery(normalized, chartInterval!, chartRange!, includeExtendedHours) : null;
    }

    // Yahoo symbols: letters/digits plus . - = ^ (BRK-B, RDS.A, EURUSD=X, ^GSPC).
    [GeneratedRegex(@"^[A-Z0-9^][A-Z0-9.\-=^]{0,19}$")]
    private static partial Regex SymbolPattern();
}
