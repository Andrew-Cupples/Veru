using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace PromptLedger.Core.Data;

public static class LedgerDatabase
{
    public static string ConnectionString(string databaseFile) => new SqliteConnectionStringBuilder
    {
        DataSource = databaseFile,
        Mode = SqliteOpenMode.ReadWriteCreate,
        DefaultTimeout = 10,
        Pooling = true,
    }.ToString();

    public static void Configure(DbContextOptionsBuilder options, string databaseFile)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(databaseFile))!);
        options.UseSqlite(ConnectionString(databaseFile));
    }

    public static LedgerDbContext Open(string databaseFile)
    {
        var builder = new DbContextOptionsBuilder<LedgerDbContext>();
        Configure(builder, databaseFile);
        return new LedgerDbContext(builder.Options);
    }

    /// <summary>Applies migrations and switches on WAL so the hook and the API can write at the same time.</summary>
    public static async Task InitializeAsync(LedgerDbContext db, CancellationToken ct = default)
    {
        // Fast path for the hook, which runs on every prompt: a plain read of the migration
        // history is much cheaper than MigrateAsync's locking and diffing when nothing is pending.
        if (await IsUpToDateAsync(db, ct)) return;

        await db.Database.MigrateAsync(ct);
        await db.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;", ct);
    }

    private static async Task<bool> IsUpToDateAsync(LedgerDbContext db, CancellationToken ct)
    {
        var latest = db.Database.GetMigrations().LastOrDefault();
        if (latest is null) return false;

        var connection = (SqliteConnection)db.Database.GetDbConnection();
        if (connection.DataSource is { Length: > 0 } file && file != ":memory:" && !File.Exists(file)) return false;

        await db.Database.OpenConnectionAsync(ct);
        try
        {
            await using var cmd = connection.CreateCommand();
            cmd.CommandText = """
                SELECT MigrationId FROM __EFMigrationsHistory
                WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__EFMigrationsHistory')
                ORDER BY MigrationId DESC LIMIT 1
                """;
            return await cmd.ExecuteScalarAsync(ct) is string applied && applied == latest;
        }
        catch (SqliteException)
        {
            return false;
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }
}

/// <summary>Used by `dotnet ef` at design time only.</summary>
internal sealed class DesignTimeFactory : IDesignTimeDbContextFactory<LedgerDbContext>
{
    public LedgerDbContext CreateDbContext(string[] args) =>
        LedgerDatabase.Open(Path.Combine(Path.GetTempPath(), "ledger-design.db"));
}
