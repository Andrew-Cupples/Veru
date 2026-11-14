using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Veru.MarketData.Yahoo;

/// <summary>Reads price history from Yahoo Finance's public chart endpoint.</summary>
public sealed class YahooChartClient(HttpClient http) : IMarketDataProvider
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<PriceSeries> GetPriceSeriesAsync(ChartQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var url = string.Create(CultureInfo.InvariantCulture,
            $"v8/finance/chart/{Uri.EscapeDataString(query.Symbol)}?interval={query.Interval.Code}&range={query.Range.Code}&includePrePost={(query.IncludeExtendedHours ? "true" : "false")}");

        using var response = await SendAsync(url, cancellationToken).ConfigureAwait(false);
        var envelope = await ReadEnvelopeAsync(response, cancellationToken).ConfigureAwait(false);

        if (envelope?.Chart?.Error is { } error)
        {
            if (response.StatusCode == HttpStatusCode.NotFound || error.Code == "Not Found")
            {
                throw new SymbolNotFoundException(query.Symbol);
            }

            if (response.StatusCode == HttpStatusCode.BadRequest)
            {
                throw new MarketDataRequestRejectedException(error.Description ?? "Yahoo Finance rejected the request.");
            }
        }

        if (!response.IsSuccessStatusCode)
        {
            throw new MarketDataUnavailableException(response.StatusCode == HttpStatusCode.TooManyRequests
                ? "Yahoo Finance is rate limiting requests. Try again in a minute."
                : $"Yahoo Finance returned HTTP {(int)response.StatusCode}.");
        }

        var result = envelope?.Chart?.Result is [var first, ..] ? first : throw new SymbolNotFoundException(query.Symbol);
        return YahooChartMapper.Map(result, query);
    }

    private async Task<HttpResponseMessage> SendAsync(string url, CancellationToken cancellationToken)
    {
        try
        {
            return await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);
        }
        catch (HttpRequestException ex)
        {
            throw new MarketDataUnavailableException("Could not reach Yahoo Finance.", ex);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            throw new MarketDataUnavailableException("Yahoo Finance did not respond in time.", ex);
        }
    }

    private static async Task<YahooChartEnvelope?> ReadEnvelopeAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        // Error responses carry the same JSON envelope; anything else (e.g. a 429 HTML page) isn't ours to parse.
        if (response.Content.Headers.ContentType?.MediaType?.Contains("json", StringComparison.OrdinalIgnoreCase) != true)
        {
            return null;
        }

        try
        {
            return await response.Content.ReadFromJsonAsync<YahooChartEnvelope>(Json, cancellationToken).ConfigureAwait(false);
        }
        catch (JsonException ex)
        {
            throw new MarketDataUnavailableException("Yahoo Finance returned an unreadable response.", ex);
        }
    }
}
