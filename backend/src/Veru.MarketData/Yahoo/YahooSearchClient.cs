using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;

namespace Veru.MarketData.Yahoo;

/// <summary>
/// Yahoo Finance's public search endpoint (the one behind its own search box). Matches tickers and company
/// names, ranked by popularity, and needs no cookie or crumb, just the browser User-Agent.
/// </summary>
public sealed class YahooSearchClient(HttpClient http) : ISymbolSearch
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<IReadOnlyList<SymbolMatch>> SearchAsync(string query, int limit, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var url = string.Create(CultureInfo.InvariantCulture,
            $"v1/finance/search?q={Uri.EscapeDataString(query.Trim())}&quotesCount={limit}&newsCount=0&listsCount=0&enableFuzzyQuery=false");

        YahooSearchResponse? body;
        try
        {
            using var response = await http.GetAsync(url, cancellationToken).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                throw new MarketDataUnavailableException($"Yahoo Finance search returned HTTP {(int)response.StatusCode}.");
            }

            body = await response.Content.ReadFromJsonAsync<YahooSearchResponse>(Json, cancellationToken).ConfigureAwait(false);
        }
        catch (HttpRequestException ex)
        {
            throw new MarketDataUnavailableException("Could not reach Yahoo Finance.", ex);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            throw new MarketDataUnavailableException("Yahoo Finance did not respond in time.", ex);
        }
        catch (JsonException ex)
        {
            throw new MarketDataUnavailableException("Yahoo Finance returned an unreadable search response.", ex);
        }

        return (body?.Quotes ?? [])
            .Where(q => !string.IsNullOrWhiteSpace(q.Symbol))
            .Select(q => new SymbolMatch(
                q.Symbol!.Trim().ToUpperInvariant(),
                Blank(q.LongName) ?? Blank(q.ShortName),
                Blank(q.ExchDisp) ?? Blank(q.Exchange),
                Blank(q.TypeDisp) ?? Blank(q.QuoteType)))
            .DistinctBy(m => m.Symbol)
            .Take(limit)
            .ToList();
    }

    private static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

// Wire format of v1/finance/search; only the fields autocomplete shows.
internal sealed record YahooSearchResponse(IReadOnlyList<YahooSearchQuote>? Quotes);

internal sealed record YahooSearchQuote(
    string? Symbol,
    string? ShortName,
    string? LongName,
    string? Exchange,
    string? ExchDisp,
    string? QuoteType,
    string? TypeDisp);
