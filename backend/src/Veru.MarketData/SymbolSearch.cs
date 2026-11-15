using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Veru.MarketData;

/// <summary>One instrument matching a search, e.g. TSLA · Tesla, Inc. · NASDAQ · Equity.</summary>
public sealed record SymbolMatch(string Symbol, string? Name, string? Exchange, string? Type);

/// <summary>Finds symbols by ticker or company name, for autocomplete.</summary>
public interface ISymbolSearch
{
    /// <exception cref="MarketDataUnavailableException">The provider could not be reached or answered unusably.</exception>
    Task<IReadOnlyList<SymbolMatch>> SearchAsync(string query, int limit, CancellationToken cancellationToken);
}

/// <summary>
/// Caches search results per (query, limit). Typing "tes" then backspacing and retyping is served from memory,
/// and every user's "a", "ap", "app" share one upstream call each.
/// </summary>
public sealed class CachingSymbolSearch(ISymbolSearch inner, IMemoryCache cache, IOptions<MarketDataOptions> options) : ISymbolSearch
{
    public async Task<IReadOnlyList<SymbolMatch>> SearchAsync(string query, int limit, CancellationToken cancellationToken)
    {
        var key = (nameof(CachingSymbolSearch), query.Trim().ToUpperInvariant(), limit);
        if (cache.TryGetValue(key, out IReadOnlyList<SymbolMatch>? cached) && cached is not null)
        {
            return cached;
        }

        var matches = await inner.SearchAsync(query, limit, cancellationToken).ConfigureAwait(false);
        cache.Set(key, matches, options.Value.SearchCacheDuration);
        return matches;
    }
}
