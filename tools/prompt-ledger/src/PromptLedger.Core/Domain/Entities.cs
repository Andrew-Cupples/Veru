namespace PromptLedger.Core.Domain;

/// <summary>A Claude Code session (one conversation).</summary>
public sealed class Session
{
    public required string Id { get; set; }
    public string? Title { get; set; }
    public string? Cwd { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public List<Prompt> Prompts { get; } = [];
}

/// <summary>One prompt the human sent, plus the human's annotations on it.</summary>
public sealed class Prompt
{
    public int Id { get; set; }
    public required string SessionId { get; set; }
    public Session? Session { get; set; }

    /// <summary>1-based order of the prompt within its session.</summary>
    public int Sequence { get; set; }

    public required string Text { get; set; }
    public DateTimeOffset SubmittedAt { get; set; }
    public CaptureSource Source { get; set; }

    /// <summary>The transcript message uuid; set once the transcript has been synced.</summary>
    public string? TranscriptUuid { get; set; }

    /// <summary>Claude's final text reply for the turn, filled in from the transcript.</summary>
    public string? ResponseText { get; set; }
    public string? Model { get; set; }

    // ---- Human annotations ----
    public bool HumanReviewed { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public string? Comment { get; set; }

    /// <summary>Why this prompt was sent (PROMPT_LOG requirement).</summary>
    public string? Rationale { get; set; }

    /// <summary>What was done with the AI output (PROMPT_LOG requirement).</summary>
    public PromptOutcome Outcome { get; set; }
    public string? OutcomeNotes { get; set; }

    /// <summary>When false the prompt stays in the ledger but is left out of PROMPT_LOG.md.</summary>
    public bool IncludeInLog { get; set; } = true;
    public bool Starred { get; set; }

    public List<Tag> Tags { get; } = [];
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public enum CaptureSource
{
    Hook = 0,
    TranscriptImport = 1,
    Manual = 2,
}

public enum PromptOutcome
{
    Unset = 0,
    Kept = 1,
    Changed = 2,
    Rejected = 3,
    Mixed = 4,
}

/// <summary>A hashtag. Names are stored normalized (lowercase, no leading '#').</summary>
public sealed class Tag
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }

    /// <summary>Optional display color (any CSS color) for UI customization.</summary>
    public string? Color { get; set; }
    public List<Prompt> Prompts { get; } = [];
    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>A change made by hand outside of AI (assessment deliverable 4).</summary>
public sealed class ManualChange
{
    public int Id { get; set; }
    public required string Title { get; set; }
    public string? Description { get; set; }
    public string? Reasoning { get; set; }

    /// <summary>Newline-separated list of affected files.</summary>
    public string? Files { get; set; }
    public string? CommitSha { get; set; }
    public int? RelatedPromptId { get; set; }
    public Prompt? RelatedPrompt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>Arbitrary JSON preference blob (themes, layouts, saved filters) keyed by name.</summary>
public sealed class Setting
{
    public required string Key { get; set; }
    public required string Json { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
