using Veru.MarketData;

namespace Veru.Api;

// Public JSON contract. Kept separate from the domain records so the domain can change without breaking clients.

public sealed record PriceSeriesResponse(
    InstrumentDto Instrument,
    PriceQueryDto Query,
    /// <summary>Bar size actually returned; can be coarser than requested for long ranges.</summary>
    string Granularity,
    IReadOnlyList<PriceBarDto> Bars);

public sealed record PriceQueryDto(string Symbol, string Interval, string Range, bool ExtendedHours);

public sealed record PriceBarDto(
    /// <summary>Bar start in the exchange's local time, with its UTC offset.</summary>
    DateTimeOffset Time,
    MarketSession? Session,
    decimal Open,
    decimal High,
    decimal Low,
    decimal Close,
    long Volume);

public sealed record InstrumentDto(
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

public sealed record QueryOptionsResponse(
    IReadOnlyList<IntervalOptionDto> Intervals,
    IReadOnlyList<RangeOptionDto> Ranges,
    string DefaultInterval,
    string DefaultRange);

public sealed record IntervalOptionDto(string Code, string Label, bool Intraday, int? MaxLookbackDays);

public sealed record RangeOptionDto(string Code, string Label, int? Days);

internal static class ContractMapping
{
    public static PriceSeriesResponse ToResponse(this PriceSeries series, ChartQuery query)
    {
        var i = series.Instrument;
        return new PriceSeriesResponse(
            new InstrumentDto(i.Symbol, i.Name, i.Exchange, i.InstrumentType, i.Currency, i.TimeZone, i.FirstTradeDate,
                i.RegularMarketPrice, i.RegularMarketTime, i.PreviousClose, i.DayHigh, i.DayLow, i.DayVolume,
                i.FiftyTwoWeekHigh, i.FiftyTwoWeekLow),
            new PriceQueryDto(query.Symbol, query.Interval.Code, query.Range.Code, query.IncludeExtendedHours),
            series.Granularity,
            series.Bars.Select(b => new PriceBarDto(b.Time, b.Session, b.Open, b.High, b.Low, b.Close, b.Volume)).ToList());
    }
}

/// <summary>Sent by the suggestion box. Feature and kind must be one of the box's choices.</summary>
public sealed record SuggestionRequest(
    /// <summary>raw-data, reports, analytics, personalize, prompt-ledger or other.</summary>
    string? Feature,
    /// <summary>Required when feature is "other".</summary>
    string? OtherFeature,
    /// <summary>like, want or problem.</summary>
    string? Kind,
    string? Message,
    /// <summary>The page the box was on.</summary>
    string? Page);

public sealed record SuggestionResponse(
    long Id,
    DateTimeOffset CreatedAt,
    string Feature,
    string? OtherFeature,
    string Kind,
    string Message,
    string? Page);
