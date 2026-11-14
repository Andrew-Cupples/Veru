namespace Veru.MarketData;

/// <summary>Which part of the trading day a bar belongs to.</summary>
public enum MarketSession
{
    Pre,
    Regular,
    Post,
}

/// <summary>One OHLCV bar. Prices are rounded to 4 decimal places.</summary>
/// <param name="Time">Bar start, in the exchange's local time zone.</param>
/// <param name="Session">Trading session for intraday bars; null for daily and longer bars.</param>
public sealed record PriceBar(
    DateTimeOffset Time,
    MarketSession? Session,
    decimal Open,
    decimal High,
    decimal Low,
    decimal Close,
    long Volume);

/// <summary>Descriptive and summary data the provider returns alongside the bars.</summary>
public sealed record Instrument(
    string Symbol,
    string? Name,
    string? Exchange,
    string? InstrumentType,
    string? Currency,
    string TimeZone,
    DateTimeOffset? FirstTradeDate,
    decimal? RegularMarketPrice,
    DateTimeOffset? RegularMarketTime,
    decimal? PreviousClose,
    decimal? DayHigh,
    decimal? DayLow,
    long? DayVolume,
    decimal? FiftyTwoWeekHigh,
    decimal? FiftyTwoWeekLow);

/// <param name="Granularity">The bar size actually returned, which can be coarser than requested.</param>
public sealed record PriceSeries(Instrument Instrument, string Granularity, IReadOnlyList<PriceBar> Bars);
