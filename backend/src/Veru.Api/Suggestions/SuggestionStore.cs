using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Veru.Api.Suggestions;

/// <summary>One piece of feedback from the in-app suggestion box.</summary>
public sealed class Suggestion
{
    public long Id { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    /// <summary>A key from <see cref="SuggestionCatalog.Features"/>.</summary>
    public required string Feature { get; set; }
    /// <summary>What the user typed when Feature is "other".</summary>
    public string? OtherFeature { get; set; }
    /// <summary>A key from <see cref="SuggestionCatalog.Kinds"/>.</summary>
    public required string Kind { get; set; }
    public required string Message { get; set; }
    /// <summary>The page the box was on when it was sent.</summary>
    public string? Page { get; set; }
}

/// <summary>The choices the suggestion box offers. The web app shows the same lists; the API accepts only these.</summary>
public static class SuggestionCatalog
{
    public const string OtherFeature = "other";

    public static readonly IReadOnlyList<string> Features = ["raw-data", "reports", "analytics", "personalize", "prompt-ledger", OtherFeature];
    public static readonly IReadOnlyList<string> Kinds = ["like", "want", "problem"];

    public const int MaxMessage = 2000;
    public const int MaxOtherFeature = 80;
    public const int MaxPage = 80;
}

public sealed class SuggestionsDbContext(DbContextOptions<SuggestionsDbContext> options) : DbContext(options)
{
    public DbSet<Suggestion> Suggestions => Set<Suggestion>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var s = modelBuilder.Entity<Suggestion>();
        s.ToTable("suggestions");
        s.Property(x => x.Feature).HasMaxLength(32);
        s.Property(x => x.OtherFeature).HasMaxLength(SuggestionCatalog.MaxOtherFeature);
        s.Property(x => x.Kind).HasMaxLength(16);
        s.Property(x => x.Message).HasMaxLength(SuggestionCatalog.MaxMessage);
        s.Property(x => x.Page).HasMaxLength(SuggestionCatalog.MaxPage);
        // SQLite can't order by DateTimeOffset; store it as UTC ticks.
        s.Property(x => x.CreatedAt).HasConversion(v => v.UtcTicks, v => new DateTimeOffset(v, TimeSpan.Zero));
        s.HasIndex(x => x.CreatedAt);
    }
}

/// <summary>
/// Reads and writes suggestions. The SQLite file and table are created on first use, so the market data
/// endpoints (and their tests) never touch the database.
/// </summary>
public sealed class SuggestionStore(IDbContextFactory<SuggestionsDbContext> factory) : IDisposable
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private volatile bool _ready;

    private async Task<SuggestionsDbContext> OpenAsync(CancellationToken ct)
    {
        var db = await factory.CreateDbContextAsync(ct);
        if (_ready) return db;
        await _gate.WaitAsync(ct);
        try
        {
            if (!_ready)
            {
                var file = new SqliteConnectionStringBuilder(db.Database.GetConnectionString()).DataSource;
                var dir = Path.GetDirectoryName(Path.GetFullPath(file));
                if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
                await db.Database.EnsureCreatedAsync(ct);
                _ready = true;
            }
        }
        finally
        {
            _gate.Release();
        }
        return db;
    }

    public void Dispose() => _gate.Dispose();

    public async Task<Suggestion> AddAsync(Suggestion suggestion, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        db.Suggestions.Add(suggestion);
        await db.SaveChangesAsync(ct);
        return suggestion;
    }

    public async Task<IReadOnlyList<Suggestion>> LatestAsync(int limit, CancellationToken ct)
    {
        await using var db = await OpenAsync(ct);
        return await db.Suggestions.AsNoTracking().OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id).Take(limit).ToListAsync(ct);
    }
}

public static class SuggestionServiceCollectionExtensions
{
    /// <summary>
    /// SQLite at Suggestions:DatabasePath, else data/suggestions.db under the API's content root.
    /// </summary>
    public static IServiceCollection AddSuggestions(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        var path = configuration["Suggestions:DatabasePath"];
        if (string.IsNullOrWhiteSpace(path)) path = Path.Combine(environment.ContentRootPath, "data", "suggestions.db");
        var connection = new SqliteConnectionStringBuilder { DataSource = path, Mode = SqliteOpenMode.ReadWriteCreate, Pooling = true }.ToString();
        services.AddDbContextFactory<SuggestionsDbContext>(o => o.UseSqlite(connection));
        services.AddSingleton<SuggestionStore>();
        return services;
    }
}
