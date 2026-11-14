using PromptLedger.Core.Data;

namespace PromptLedger.Api;

/// <summary>File locations used by the API. Every value can be overridden in configuration under "Ledger".</summary>
public sealed record LedgerOptions(string DatabaseFile, string TranscriptDirectory, string PromptLogPath, string SnapshotPath)
{
    public static LedgerOptions Resolve(IConfiguration config)
    {
        var section = config.GetSection("Ledger");
        var repoRoot = section["RepoRoot"] is { Length: > 0 } r ? Path.GetFullPath(r) : LedgerPaths.RepoRoot();

        return new LedgerOptions(
            section["DatabaseFile"] ?? LedgerPaths.DatabaseFile(repoRoot),
            section["TranscriptDirectory"] ?? LedgerPaths.ClaudeTranscriptDirectory(repoRoot),
            section["PromptLogPath"] ?? LedgerPaths.PromptLogFile(repoRoot),
            section["SnapshotPath"] ?? LedgerPaths.SnapshotFile(repoRoot));
    }
}
