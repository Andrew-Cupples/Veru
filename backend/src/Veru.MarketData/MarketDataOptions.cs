namespace Veru.MarketData;

/// <summary>Bound from the "MarketData" configuration section.</summary>
public sealed class MarketDataOptions
{
    public const string SectionName = "MarketData";

    public Uri YahooBaseUrl { get; set; } = new("https://query1.finance.yahoo.com/");

    /// <summary>Yahoo answers 429 to requests without a browser-like User-Agent.</summary>
    public string UserAgent { get; set; } = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

    public TimeSpan RequestTimeout { get; set; } = TimeSpan.FromSeconds(10);

    /// <summary>How long identical queries are served from memory. Keeps repeat queries off Yahoo's rate limit.</summary>
    public TimeSpan CacheDuration { get; set; } = TimeSpan.FromSeconds(60);
}
