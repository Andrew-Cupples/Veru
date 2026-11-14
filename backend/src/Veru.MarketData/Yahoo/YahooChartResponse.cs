using System.Text.Json;

namespace Veru.MarketData.Yahoo;

// Wire format of https://query1.finance.yahoo.com/v8/finance/chart/{symbol}.
// Everything is nullable: the API is undocumented and omits fields freely.

internal sealed record YahooChartEnvelope(YahooChart? Chart);

internal sealed record YahooChart(IReadOnlyList<YahooChartResult>? Result, YahooError? Error);

internal sealed record YahooError(string? Code, string? Description);

internal sealed record YahooChartResult(YahooMeta? Meta, IReadOnlyList<long>? Timestamp, YahooIndicators? Indicators);

internal sealed record YahooIndicators(IReadOnlyList<YahooQuote>? Quote);

internal sealed record YahooQuote(
    IReadOnlyList<double?>? Open,
    IReadOnlyList<double?>? High,
    IReadOnlyList<double?>? Low,
    IReadOnlyList<double?>? Close,
    IReadOnlyList<long?>? Volume);

internal sealed record YahooMeta(
    string? Symbol,
    string? Currency,
    string? FullExchangeName,
    string? ExchangeName,
    string? InstrumentType,
    string? LongName,
    string? ShortName,
    string? ExchangeTimezoneName,
    int? Gmtoffset,
    long? FirstTradeDate,
    long? RegularMarketTime,
    double? RegularMarketPrice,
    double? PreviousClose,
    double? ChartPreviousClose,
    double? RegularMarketDayHigh,
    double? RegularMarketDayLow,
    long? RegularMarketVolume,
    double? FiftyTwoWeekHigh,
    double? FiftyTwoWeekLow,
    string? DataGranularity,
    YahooCurrentTradingPeriod? CurrentTradingPeriod,
    // Either [[period]] per day (regular hours only) or { pre: [[..]], regular: [[..]], post: [[..]] }.
    JsonElement? TradingPeriods);

internal sealed record YahooCurrentTradingPeriod(YahooPeriod? Pre, YahooPeriod? Regular, YahooPeriod? Post);

internal sealed record YahooPeriod(long Start, long End);
