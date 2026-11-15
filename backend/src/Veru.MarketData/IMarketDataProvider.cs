namespace Veru.MarketData;

/// <summary>Source of price history. The Yahoo implementation is one of potentially several.</summary>
public interface IMarketDataProvider
{
    /// <exception cref="SymbolNotFoundException">The provider has no data for the symbol.</exception>
    /// <exception cref="MarketDataRequestRejectedException">The provider refused the query parameters.</exception>
    /// <exception cref="MarketDataUnavailableException">The provider could not be reached or answered unusably.</exception>
    Task<PriceSeries> GetPriceSeriesAsync(ChartQuery query, CancellationToken cancellationToken);
}

public abstract class MarketDataException(string message, Exception? inner = null) : Exception(message, inner);

public sealed class SymbolNotFoundException(string symbol)
    : MarketDataException($"No market data found for '{symbol}'. Check the ticker; it may be misspelled or delisted.")
{
    public string Symbol { get; } = symbol;
}

public sealed class MarketDataRequestRejectedException(string message) : MarketDataException(message);

public sealed class MarketDataUnavailableException(string message, Exception? inner = null) : MarketDataException(message, inner);
