using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Veru.MarketData;

/// <summary>Decorator that briefly caches successful results per query.</summary>
public sealed class CachingMarketDataProvider(IMarketDataProvider inner, IMemoryCache cache, IOptions<MarketDataOptions> options)
    : IMarketDataProvider
{
    public async Task<PriceSeries> GetPriceSeriesAsync(ChartQuery query, CancellationToken cancellationToken)
    {
        var key = (nameof(CachingMarketDataProvider), query.Symbol, query.Interval.Code, query.Range.Code, query.IncludeExtendedHours);
        if (cache.TryGetValue(key, out PriceSeries? cached) && cached is not null)
        {
            return cached;
        }

        var series = await inner.GetPriceSeriesAsync(query, cancellationToken).ConfigureAwait(false);
        cache.Set(key, series, options.Value.CacheDuration);
        return series;
    }
}
