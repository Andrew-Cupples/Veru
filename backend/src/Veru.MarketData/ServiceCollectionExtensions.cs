using System.Net.Http.Headers;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Veru.MarketData.Yahoo;

namespace Veru.MarketData;

public static class ServiceCollectionExtensions
{
    /// <summary>Registers <see cref="IMarketDataProvider"/> backed by Yahoo Finance, with a short in-memory cache.</summary>
    public static IServiceCollection AddMarketData(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<MarketDataOptions>().Bind(configuration.GetSection(MarketDataOptions.SectionName));
        services.AddMemoryCache();

        services.AddHttpClient<YahooChartClient>((sp, http) =>
        {
            var options = sp.GetRequiredService<IOptions<MarketDataOptions>>().Value;
            http.BaseAddress = options.YahooBaseUrl;
            http.Timeout = options.RequestTimeout;
            http.DefaultRequestHeaders.UserAgent.ParseAdd(options.UserAgent);
            http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        });

        services.AddTransient<IMarketDataProvider>(sp => new CachingMarketDataProvider(
            sp.GetRequiredService<YahooChartClient>(),
            sp.GetRequiredService<IMemoryCache>(),
            sp.GetRequiredService<IOptions<MarketDataOptions>>()));

        return services;
    }
}
