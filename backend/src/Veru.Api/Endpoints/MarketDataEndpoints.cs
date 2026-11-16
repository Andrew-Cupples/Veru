using Microsoft.AspNetCore.Http.HttpResults;
using Veru.MarketData;

namespace Veru.Api.Endpoints;

public static class MarketDataEndpoints
{
    public static RouteGroupBuilder MapMarketDataEndpoints(this RouteGroupBuilder api)
    {
        var market = api.MapGroup("/market").WithTags("Market data");

        market.MapGet("/options", GetOptions)
            .WithName("GetQueryOptions")
            .WithSummary("Supported intervals and ranges, with how far back each interval reaches");

        market.MapGet("/search", Search)
            .WithName("SearchSymbols")
            .WithSummary("Symbols matching a ticker or company name, most popular first, for autocomplete");

        market.MapGet("/{symbol}/bars", GetBars)
            .WithName("GetPriceBars")
            .WithSummary("Raw OHLCV bars for a symbol (defaults: 15-minute bars over the last month)");

        market.MapGet("/{symbol}/daily", GetDaily)
            .WithName("GetDailySummary")
            .WithSummary("Intraday bars grouped by day: average low, average high (4 decimal places) and total volume per day (defaults: 15-minute bars over the last month)");

        return api;
    }

    private static Ok<QueryOptionsResponse> GetOptions() => TypedResults.Ok(new QueryOptionsResponse(
        ChartInterval.All.Select(i => new IntervalOptionDto(i.Code, i.Label, i.IsIntraday, i.MaxLookbackDays)).ToList(),
        ChartRange.All.Select(r => new RangeOptionDto(r.Code, r.Label, r.Days)).ToList(),
        ChartInterval.FifteenMinutes.Code,
        ChartRange.OneMonth.Code));

    private const int MaxSearchLength = 40;
    private const int DefaultSearchLimit = 8;
    private const int MaxSearchLimit = 20;

    private static async Task<Results<Ok<SymbolSearchResponse>, ValidationProblem, ProblemHttpResult>> Search(
        string? q,
        int? limit,
        ISymbolSearch search,
        CancellationToken cancellationToken)
    {
        var query = q?.Trim() ?? "";
        if (query.Length > MaxSearchLength)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["q"] = [$"Search for at most {MaxSearchLength} characters."] });
        }

        var take = limit ?? DefaultSearchLimit;
        if (take is < 1 or > MaxSearchLimit)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["limit"] = [$"Limit must be between 1 and {MaxSearchLimit}."] });
        }

        // Nothing typed yet: answer straight away instead of asking Yahoo for everything.
        if (query.Length == 0)
        {
            return TypedResults.Ok(new SymbolSearchResponse(query, []));
        }

        try
        {
            var matches = await search.SearchAsync(query, take, cancellationToken);
            return TypedResults.Ok(new SymbolSearchResponse(query, matches.Select(m => new SymbolMatchDto(m.Symbol, m.Name, m.Exchange, m.Type)).ToList()));
        }
        catch (MarketDataUnavailableException ex)
        {
            return TypedResults.Problem(ex.Message, statusCode: StatusCodes.Status502BadGateway, title: "Symbol search unavailable");
        }
    }

    private static async Task<Results<Ok<PriceSeriesResponse>, ValidationProblem, ProblemHttpResult>> GetBars(
        string symbol,
        string? interval,
        string? range,
        bool? extendedHours,
        IMarketDataProvider provider,
        CancellationToken cancellationToken)
    {
        var query = ChartQuery.TryCreate(symbol, interval, range, extendedHours ?? false, out var errors);
        if (query is null)
        {
            return TypedResults.ValidationProblem(errors);
        }

        return await Fetch(provider, query, series => series.ToResponse(query), cancellationToken);
    }

    private static async Task<Results<Ok<List<DailySummaryDto>>, ValidationProblem, ProblemHttpResult>> GetDaily(
        string symbol,
        string? interval,
        string? range,
        bool? extendedHours,
        IMarketDataProvider provider,
        CancellationToken cancellationToken)
    {
        var query = ChartQuery.TryCreate(symbol, interval, range, extendedHours ?? false, out var errors);
        if (query is null)
        {
            return TypedResults.ValidationProblem(errors);
        }

        return await Fetch(provider, query, series => DailySummaries.ByDay(series.Bars).Select(d => d.ToDto()).ToList(), cancellationToken);
    }

    /// <summary>Fetches the series and shapes it, turning provider failures into problem details.</summary>
    private static async Task<Results<Ok<T>, ValidationProblem, ProblemHttpResult>> Fetch<T>(
        IMarketDataProvider provider,
        ChartQuery query,
        Func<PriceSeries, T> shape,
        CancellationToken cancellationToken)
    {
        try
        {
            var series = await provider.GetPriceSeriesAsync(query, cancellationToken);
            return TypedResults.Ok(shape(series));
        }
        catch (SymbolNotFoundException ex)
        {
            return TypedResults.Problem(ex.Message, statusCode: StatusCodes.Status404NotFound, title: "Symbol not found");
        }
        catch (MarketDataRequestRejectedException ex)
        {
            return TypedResults.Problem(ex.Message, statusCode: StatusCodes.Status400BadRequest, title: "Query not supported");
        }
        catch (MarketDataUnavailableException ex)
        {
            return TypedResults.Problem(ex.Message, statusCode: StatusCodes.Status502BadGateway, title: "Market data unavailable");
        }
    }
}
