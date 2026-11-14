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

        market.MapGet("/{symbol}/bars", GetBars)
            .WithName("GetPriceBars")
            .WithSummary("Raw OHLCV bars for a symbol (defaults: 15-minute bars over the last month)");

        return api;
    }

    private static Ok<QueryOptionsResponse> GetOptions() => TypedResults.Ok(new QueryOptionsResponse(
        ChartInterval.All.Select(i => new IntervalOptionDto(i.Code, i.Label, i.IsIntraday, i.MaxLookbackDays)).ToList(),
        ChartRange.All.Select(r => new RangeOptionDto(r.Code, r.Label, r.Days)).ToList(),
        ChartInterval.FifteenMinutes.Code,
        ChartRange.OneMonth.Code));

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

        try
        {
            var series = await provider.GetPriceSeriesAsync(query, cancellationToken);
            return TypedResults.Ok(series.ToResponse(query));
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
