namespace PromptLedger.Core.Data;

/// <summary>Resolves where the ledger database and generated files live.</summary>
public static class LedgerPaths
{
    public const string DatabaseEnvVar = "LEDGER_DB";
    public const string RepoRootEnvVar = "LEDGER_REPO_ROOT";

    /// <summary>The repository root: $LEDGER_REPO_ROOT, else the nearest ancestor containing .git.</summary>
    public static string RepoRoot(string? startDirectory = null)
    {
        var fromEnv = Environment.GetEnvironmentVariable(RepoRootEnvVar);
        if (!string.IsNullOrWhiteSpace(fromEnv))
        {
            return Path.GetFullPath(fromEnv);
        }

        foreach (var start in new[] { startDirectory, Environment.CurrentDirectory, AppContext.BaseDirectory })
        {
            if (start is null) continue;
            for (var dir = new DirectoryInfo(start); dir is not null; dir = dir.Parent)
            {
                var git = Path.Combine(dir.FullName, ".git");
                if (Directory.Exists(git) || File.Exists(git))
                {
                    return dir.FullName;
                }
            }
        }

        throw new InvalidOperationException(
            $"Could not find the repository root. Set {RepoRootEnvVar} or run inside the git repository.");
    }

    public static string LedgerRoot(string repoRoot) => Path.Combine(repoRoot, "tools", "prompt-ledger");

    /// <summary>The SQLite file: $LEDGER_DB, else tools/prompt-ledger/data/ledger.db.</summary>
    public static string DatabaseFile(string? repoRoot = null)
    {
        var fromEnv = Environment.GetEnvironmentVariable(DatabaseEnvVar);
        if (!string.IsNullOrWhiteSpace(fromEnv))
        {
            return Path.GetFullPath(fromEnv);
        }

        return Path.Combine(LedgerRoot(repoRoot ?? RepoRoot()), "data", "ledger.db");
    }

    public static string PromptLogFile(string repoRoot) => Path.Combine(repoRoot, "PROMPT_LOG.md");

    public static string SnapshotFile(string repoRoot) => Path.Combine(LedgerRoot(repoRoot), "snapshot", "prompt-log.jsonl");

    public static string ErrorLogFile(string repoRoot) => Path.Combine(LedgerRoot(repoRoot), "data", "hook-errors.log");

    /// <summary>Where Claude Code keeps transcripts for a project directory.</summary>
    public static string ClaudeTranscriptDirectory(string projectDirectory)
    {
        // Claude Code names the folder after the project path, with every non-alphanumeric character replaced by '-'.
        var slug = new string(Path.GetFullPath(projectDirectory).TrimEnd('\\', '/')
            .Select(c => char.IsAsciiLetterOrDigit(c) ? c : '-').ToArray());
        var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        return Path.Combine(home, ".claude", "projects", slug);
    }
}
