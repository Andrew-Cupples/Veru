using System.Text.Json;

namespace Veru.MarketData.Yahoo;

/// <summary>Turns Yahoo's column-oriented chart payload into clean, row-oriented <see cref="PriceSeries"/>.</summary>
internal static class YahooChartMapper
{
    private const int PricePrecision = 4;

    public static PriceSeries Map(YahooChartResult result, ChartQuery query)
    {
        var meta = result.Meta ?? throw new MarketDataUnavailableException("Yahoo Finance returned a chart without metadata.");
        var zone = ResolveTimeZone(meta);
        var instrument = MapInstrument(meta, query.Symbol, zone);
        var bars = MapBars(result, query, meta, zone);
        return new PriceSeries(instrument, meta.DataGranularity ?? query.Interval.Code, bars);
    }

    private static List<PriceBar> MapBars(YahooChartResult result, ChartQuery query, YahooMeta meta, TimeZoneInfo zone)
    {
        var timestamps = result.Timestamp ?? [];
        var quote = result.Indicators?.Quote is [var first, ..] ? first : null;
        if (quote is null || timestamps.Count == 0)
        {
            return [];
        }

        var periods = query.Interval.IsIntraday ? ReadTradingPeriods(meta, query.IncludeExtendedHours) : [];
        var bars = new List<PriceBar>(timestamps.Count);

        for (var i = 0; i < timestamps.Count; i++)
        {
            // Yahoo pads gaps (halts, missing prints) with nulls.
            if (At(quote.Open, i) is not { } open || At(quote.High, i) is not { } high ||
                At(quote.Low, i) is not { } low || At(quote.Close, i) is not { } close)
            {
                continue;
            }

            var unix = timestamps[i];
            MarketSession? session = null;
            if (query.Interval.IsIntraday)
            {
                session = Classify(unix, periods);
                // Outside every session: the "live" bar Yahoo appends at the close, not real trading.
                if (session is null)
                {
                    continue;
                }
            }

            bars.Add(new PriceBar(
                ToLocal(unix, zone),
                session,
                Round(open),
                Round(high),
                Round(low),
                Round(close),
                At(quote.Volume, i) ?? 0));
        }

        DropTrailingSnapshotBar(bars, query);
        return bars;
    }

    /// <summary>
    /// With extended hours on, Yahoo ends the series with a snapshot bar stamped at an off-grid time
    /// (e.g. 19:59:59). It duplicates the previous bar's close, so drop it.
    /// </summary>
    private static void DropTrailingSnapshotBar(List<PriceBar> bars, ChartQuery query)
    {
        if (!query.Interval.IsIntraday || bars.Count < 2)
        {
            return;
        }

        var step = IntervalSeconds(query.Interval.Code);
        var last = bars[^1].Time.ToUnixTimeSeconds();
        var previous = bars[^2].Time.ToUnixTimeSeconds();
        if (step > 0 && (last - previous) % step != 0)
        {
            bars.RemoveAt(bars.Count - 1);
        }
    }

    private static long IntervalSeconds(string code) => code switch
    {
        _ when code.EndsWith('m') && int.TryParse(code[..^1], out var minutes) => minutes * 60L,
        _ => 0,
    };

    private readonly record struct Period(long Start, long End, MarketSession Session);

    private static MarketSession? Classify(long unix, List<Period> periods)
    {
        if (periods.Count == 0)
        {
            return MarketSession.Regular; // No schedule (e.g. some 24h markets): treat everything as regular.
        }

        foreach (var p in periods)
        {
            if (unix >= p.Start && unix < p.End)
            {
                return p.Session;
            }
        }

        return null;
    }

    private static List<Period> ReadTradingPeriods(YahooMeta meta, bool includeExtendedHours)
    {
        var periods = new List<Period>();

        if (meta.TradingPeriods is { } tp)
        {
            if (tp.ValueKind == JsonValueKind.Array)
            {
                AddDays(periods, tp, MarketSession.Regular);
            }
            else if (tp.ValueKind == JsonValueKind.Object)
            {
                if (tp.TryGetProperty("pre", out var pre)) AddDays(periods, pre, MarketSession.Pre);
                if (tp.TryGetProperty("regular", out var regular)) AddDays(periods, regular, MarketSession.Regular);
                if (tp.TryGetProperty("post", out var post)) AddDays(periods, post, MarketSession.Post);
            }
        }

        // tradingPeriods can stop a day short; the current day's schedule is always in currentTradingPeriod.
        // Without extended hours only the regular session counts, so the bar Yahoo stamps at the close is excluded.
        if (meta.CurrentTradingPeriod is { } current)
        {
            if (current.Regular is { } regular) periods.Add(new(regular.Start, regular.End, MarketSession.Regular));
            if (includeExtendedHours && current.Pre is { } pre) periods.Add(new(pre.Start, pre.End, MarketSession.Pre));
            if (includeExtendedHours && current.Post is { } post) periods.Add(new(post.Start, post.End, MarketSession.Post));
        }

        return periods;
    }

    private static void AddDays(List<Period> periods, JsonElement days, MarketSession session)
    {
        if (days.ValueKind != JsonValueKind.Array) return;
        foreach (var day in days.EnumerateArray())
        {
            if (day.ValueKind != JsonValueKind.Array) continue;
            foreach (var p in day.EnumerateArray())
            {
                if (p.TryGetProperty("start", out var s) && p.TryGetProperty("end", out var e) &&
                    s.TryGetInt64(out var start) && e.TryGetInt64(out var end))
                {
                    periods.Add(new(start, end, session));
                }
            }
        }
    }

    private static Instrument MapInstrument(YahooMeta meta, string requestedSymbol, TimeZoneInfo zone) => new(
        Symbol: meta.Symbol ?? requestedSymbol,
        Name: meta.LongName ?? meta.ShortName,
        Exchange: meta.FullExchangeName ?? meta.ExchangeName,
        InstrumentType: meta.InstrumentType,
        Currency: meta.Currency,
        TimeZone: meta.ExchangeTimezoneName ?? zone.Id,
        FirstTradeDate: meta.FirstTradeDate is { } first ? ToLocal(first, zone) : null,
        RegularMarketPrice: Round(meta.RegularMarketPrice),
        RegularMarketTime: meta.RegularMarketTime is { } time ? ToLocal(time, zone) : null,
        PreviousClose: Round(meta.PreviousClose ?? meta.ChartPreviousClose),
        DayHigh: Round(meta.RegularMarketDayHigh),
        DayLow: Round(meta.RegularMarketDayLow),
        DayVolume: meta.RegularMarketVolume,
        FiftyTwoWeekHigh: Round(meta.FiftyTwoWeekHigh),
        FiftyTwoWeekLow: Round(meta.FiftyTwoWeekLow));

    private static TimeZoneInfo ResolveTimeZone(YahooMeta meta)
    {
        if (meta.ExchangeTimezoneName is { Length: > 0 } id && TimeZoneInfo.TryFindSystemTimeZoneById(id, out var zone))
        {
            return zone;
        }

        var offset = TimeSpan.FromSeconds(meta.Gmtoffset ?? 0);
        return TimeZoneInfo.CreateCustomTimeZone($"UTC{offset:+hh\\:mm;-hh\\:mm}", offset, null, null);
    }

    private static DateTimeOffset ToLocal(long unixSeconds, TimeZoneInfo zone) =>
        TimeZoneInfo.ConvertTime(DateTimeOffset.FromUnixTimeSeconds(unixSeconds), zone);

    private static T? At<T>(IReadOnlyList<T?>? values, int index) where T : struct =>
        values is not null && index < values.Count ? values[index] : null;

    private static decimal Round(double value) =>
        Math.Round((decimal)value, PricePrecision, MidpointRounding.AwayFromZero);

    private static decimal? Round(double? value) => value is { } v ? Round(v) : null;
}
