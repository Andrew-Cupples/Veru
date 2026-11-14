using System.Text.Json;
using PromptLedger.Core.Domain;

namespace PromptLedger.Api;

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public sealed record PromptSummaryDto(
    int Id,
    string SessionId,
    int Sequence,
    string Text,
    DateTimeOffset SubmittedAt,
    CaptureSource Source,
    string? Model,
    bool HumanReviewed,
    PromptOutcome Outcome,
    bool Starred,
    bool IncludeInLog,
    bool HasComment,
    bool HasResponse,
    IReadOnlyList<string> Tags);

public sealed record PromptDetailDto(
    int Id,
    string SessionId,
    string? SessionTitle,
    int Sequence,
    string Text,
    DateTimeOffset SubmittedAt,
    CaptureSource Source,
    string? TranscriptUuid,
    string? Model,
    string? ResponseText,
    bool HumanReviewed,
    DateTimeOffset? ReviewedAt,
    string? Comment,
    string? Rationale,
    PromptOutcome Outcome,
    string? OutcomeNotes,
    bool Starred,
    bool IncludeInLog,
    IReadOnlyList<string> Tags,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

/// <summary>
/// Partial update: a null field is left unchanged. Send an empty string to clear a text field.
/// #hashtags in <see cref="Comment"/> are added to the prompt's tags automatically.
/// </summary>
public sealed record UpdatePromptRequest(
    bool? HumanReviewed = null,
    string? Comment = null,
    string? Rationale = null,
    PromptOutcome? Outcome = null,
    string? OutcomeNotes = null,
    bool? Starred = null,
    bool? IncludeInLog = null);

public sealed record SetTagsRequest(IReadOnlyList<string> Tags);

public sealed record TagDto(string Name, string? Description, string? Color, int PromptCount, DateTimeOffset CreatedAt);

/// <summary>Renaming to a tag that already exists merges the two.</summary>
public sealed record UpdateTagRequest(string? Name = null, string? Description = null, string? Color = null);

public sealed record SessionDto(string Id, string? Title, string? Cwd, DateTimeOffset StartedAt, int PromptCount, int ReviewedCount);

public sealed record ManualChangeDto(
    int Id,
    string Title,
    string? Description,
    string? Reasoning,
    string? Files,
    string? CommitSha,
    int? RelatedPromptId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record ManualChangeRequest(
    string Title,
    string? Description = null,
    string? Reasoning = null,
    string? Files = null,
    string? CommitSha = null,
    int? RelatedPromptId = null);

public sealed record StatsDto(
    int Prompts,
    int Reviewed,
    int Sessions,
    int Tags,
    int ManualChanges,
    IReadOnlyDictionary<string, int> ByOutcome,
    IReadOnlyList<DayCount> PerDay,
    IReadOnlyList<TagDto> TopTags);

public sealed record DayCount(string Day, int Prompts, int Reviewed);

public sealed record SyncResultDto(int Added, int Linked, int Updated, int Unchanged);

public sealed record ExportResultDto(string PromptLogPath, string SnapshotPath);

public sealed record SettingDto(string Key, JsonElement Value, DateTimeOffset UpdatedAt);
