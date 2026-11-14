using Microsoft.Data.Sqlite;
using PromptLedger.Core.Data;

namespace PromptLedger.Tests;

/// <summary>A real, migrated SQLite database in a temp file (FTS5 and triggers included), deleted on dispose.</summary>
public sealed class TestDb : IAsyncDisposable
{
    public string File { get; } = Path.Combine(Path.GetTempPath(), $"ledger-test-{Guid.NewGuid():N}.db");

    public static async Task<TestDb> CreateAsync()
    {
        var db = new TestDb();
        await using var ctx = db.Open();
        await LedgerDatabase.InitializeAsync(ctx);
        return db;
    }

    public LedgerDbContext Open() => LedgerDatabase.Open(File);

    public ValueTask DisposeAsync()
    {
        SqliteConnection.ClearAllPools();
        foreach (var suffix in new[] { "", "-wal", "-shm" })
        {
            try
            {
                System.IO.File.Delete(File + suffix);
            }
            catch (IOException)
            {
                // Best effort: a leftover temp file is harmless.
            }
        }

        return ValueTask.CompletedTask;
    }
}
