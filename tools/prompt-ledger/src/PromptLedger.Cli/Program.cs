using System.Diagnostics;
using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using PromptLedger.Core.Data;
using PromptLedger.Core.Export;
using PromptLedger.Core.Hooks;
using PromptLedger.Core.Services;

// `ledger` is the command-line side of the Prompt Ledger. Commands:
//   ledger hook                    read a Claude Code hook payload from stdin (always exits 0)
//   ledger import [--file F|--dir D]  sync Claude Code transcripts into the ledger
//   ledger export                  write PROMPT_LOG.md and the JSONL snapshot
//   ledger stats                   print a short summary
//   ledger migrate                 create or upgrade the database

var command = args.Length > 0 ? args[0] : "help";
var options = ParseOptions(args.Skip(1).ToArray());

if (command == "hook")
{
    return await RunHookAsync();
}

try
{
    return command switch
    {
        "import" => await ImportAsync(),
        "export" => await ExportAsync(),
        "stats" => await StatsAsync(),
        "migrate" => await WithDb(async _ => { Console.WriteLine($"Database ready: {LedgerPaths.DatabaseFile()}"); return 0; }),
        _ => Help(),
    };
}
catch (Exception ex) when (ex is InvalidOperationException or IOException or DbUpdateException)
{
    await Console.Error.WriteLineAsync($"error: {ex.Message}");
    return 1;
}

// A hook must never break the user's Claude Code session: failures are logged to a file and swallowed.
async Task<int> RunHookAsync()
{
    var sw = Stopwatch.StartNew();
    string? repoRoot = null;
    try
    {
        var payload = await Console.In.ReadToEndAsync();
        repoRoot = LedgerPaths.RepoRoot(Environment.GetEnvironmentVariable("CLAUDE_PROJECT_DIR"));
        await using var db = LedgerDatabase.Open(LedgerPaths.DatabaseFile(repoRoot));
        await LedgerDatabase.InitializeAsync(db);
        var result = await new HookHandler(new CaptureService(db)).HandleAsync(payload);
        if (options.ContainsKey("verbose")) await Console.Error.WriteLineAsync($"{result} ({sw.ElapsedMilliseconds} ms)");
    }
#pragma warning disable CA1031 // Deliberately catch everything: see comment above.
    catch (Exception ex)
#pragma warning restore CA1031
    {
        try
        {
            var log = repoRoot is null ? Path.Combine(Path.GetTempPath(), "prompt-ledger-hook-errors.log") : LedgerPaths.ErrorLogFile(repoRoot);
            Directory.CreateDirectory(Path.GetDirectoryName(log)!);
            await File.AppendAllTextAsync(log, $"[{DateTimeOffset.UtcNow:O}] {ex}\n\n", Encoding.UTF8);
        }
#pragma warning disable CA1031
        catch
#pragma warning restore CA1031
        {
            // Nowhere left to report to.
        }
    }

    return 0;
}

async Task<int> ImportAsync() => await WithDb(async db =>
{
    var capture = new CaptureService(db);
    ImportResult result;
    if (options.TryGetValue("file", out var file))
    {
        result = await capture.ImportTranscriptFileAsync(file);
    }
    else
    {
        var dir = options.GetValueOrDefault("dir") ?? LedgerPaths.ClaudeTranscriptDirectory(LedgerPaths.RepoRoot());
        Console.WriteLine($"Importing transcripts from {dir}");
        result = await capture.ImportDirectoryAsync(dir);
    }

    Console.WriteLine($"Added {result.Added}, linked {result.Linked} hook captures, updated {result.Updated}, unchanged {result.Skipped}.");
    return 0;
});

async Task<int> ExportAsync() => await WithDb(async db =>
{
    var root = LedgerPaths.RepoRoot();
    var logPath = options.GetValueOrDefault("log") ?? LedgerPaths.PromptLogFile(root);
    var snapshotPath = options.GetValueOrDefault("snapshot") ?? LedgerPaths.SnapshotFile(root);
    await new PromptLogExporter(db).WriteAsync(logPath);
    await new SnapshotExporter(db).WriteAsync(snapshotPath);
    Console.WriteLine($"Wrote {logPath}");
    Console.WriteLine($"Wrote {snapshotPath}");
    return 0;
});

async Task<int> StatsAsync() => await WithDb(async db =>
{
    var total = await db.Prompts.CountAsync();
    var reviewed = await db.Prompts.CountAsync(p => p.HumanReviewed);
    var sessions = await db.Sessions.CountAsync();
    var tags = await db.Tags.Select(t => new { t.Name, Count = t.Prompts.Count })
        .OrderByDescending(t => t.Count).ThenBy(t => t.Name).Take(10).ToListAsync();
    Console.WriteLine(string.Create(CultureInfo.InvariantCulture, $"{total} prompts in {sessions} sessions, {reviewed} reviewed ({(total == 0 ? 0 : reviewed * 100 / total)}%)"));
    if (tags.Count > 0) Console.WriteLine("Top tags: " + string.Join(", ", tags.Select(t => $"#{t.Name} ({t.Count})")));
    return 0;
});

async Task<int> WithDb(Func<LedgerDbContext, Task<int>> action)
{
    await using var db = LedgerDatabase.Open(LedgerPaths.DatabaseFile());
    await LedgerDatabase.InitializeAsync(db);
    return await action(db);
}

static int Help()
{
    Console.WriteLine("""
        Prompt Ledger CLI

          ledger hook [--verbose]          Handle a Claude Code hook payload from stdin
          ledger import [--file F | --dir D]  Sync Claude Code transcripts (default: this repo's transcript folder)
          ledger export [--log P] [--snapshot P]  Write PROMPT_LOG.md and the JSONL snapshot
          ledger stats                     Print a summary
          ledger migrate                   Create or upgrade the database

        Environment: LEDGER_DB (database file), LEDGER_REPO_ROOT (repository root)
        """);
    return 0;
}

static Dictionary<string, string> ParseOptions(string[] args)
{
    var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    for (var i = 0; i < args.Length; i++)
    {
        if (!args[i].StartsWith("--", StringComparison.Ordinal)) continue;
        var key = args[i][2..];
        var hasValue = i + 1 < args.Length && !args[i + 1].StartsWith("--", StringComparison.Ordinal);
        result[key] = hasValue ? args[++i] : "true";
    }

    return result;
}
