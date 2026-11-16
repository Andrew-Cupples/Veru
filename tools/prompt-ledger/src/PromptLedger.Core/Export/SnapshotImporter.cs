using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using PromptLedger.Core.Data;
using PromptLedger.Core.Domain;

namespace PromptLedger.Core.Export;

/// <summary>
/// Loads a JSONL snapshot written by <see cref="SnapshotExporter"/> back into the database.
/// The SQLite file isn't committed, so this is how a fresh clone gets the annotated ledger.
/// It only ever fills an empty database: it never overwrites or merges into existing data.
/// </summary>
public sealed class SnapshotImporter(LedgerDbContext db)
{
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    /// <summary>Imports the snapshot when the file exists and the database holds no sessions or prompts.</summary>
    /// <returns>The number of prompts imported (0 when skipped).</returns>
    public async Task<int> ImportIfEmptyAsync(string path, CancellationToken ct = default)
    {
        if (!File.Exists(path)) return 0;
        if (await db.Sessions.AnyAsync(ct) || await db.Prompts.AnyAsync(ct)) return 0;

        var sessions = new Dictionary<string, Session>(StringComparer.Ordinal);
        var tags = new Dictionary<string, Tag>(StringComparer.Ordinal);
        var prompts = new List<Prompt>();
        var promptsByUuid = new Dictionary<string, Prompt>(StringComparer.Ordinal);
        var changes = new List<(ManualChange Change, string? PromptUuid)>();

        var lineNumber = 0;
        foreach (var line in await File.ReadAllLinesAsync(path, ct))
        {
            lineNumber++;
            if (string.IsNullOrWhiteSpace(line)) continue;

            Record record;
            try
            {
                record = JsonSerializer.Deserialize<Record>(line, Json)
                    ?? throw new InvalidDataException("empty record");
            }
            catch (JsonException ex)
            {
                throw new InvalidDataException($"{path}:{lineNumber}: {ex.Message}", ex);
            }

            switch (record.Kind)
            {
                case "session":
                    var id = Required(record.Id, "id", path, lineNumber);
                    sessions[id] = new Session { Id = id, Title = record.Title, Cwd = record.Cwd, StartedAt = record.StartedAt ?? default };
                    break;

                case "tag":
                    var name = Required(record.Name, "name", path, lineNumber);
                    tags[name] = new Tag { Name = name, Description = record.Description, Color = record.Color, CreatedAt = record.CreatedAt ?? default };
                    break;

                case "prompt":
                    var sessionId = Required(record.SessionId, "sessionId", path, lineNumber);
                    if (!sessions.TryGetValue(sessionId, out var session))
                    {
                        throw new InvalidDataException($"{path}:{lineNumber}: prompt refers to unknown session {sessionId}");
                    }

                    var submitted = record.SubmittedAt ?? default;
                    var prompt = new Prompt
                    {
                        SessionId = sessionId,
                        Session = session,
                        Sequence = record.Sequence,
                        TranscriptUuid = record.TranscriptUuid,
                        SubmittedAt = submitted,
                        Source = record.Source,
                        Text = record.Text ?? "",
                        ResponseText = record.ResponseText,
                        Model = record.Model,
                        HumanReviewed = record.HumanReviewed,
                        ReviewedAt = record.ReviewedAt,
                        Comment = record.Comment,
                        Rationale = record.Rationale,
                        Outcome = record.Outcome,
                        OutcomeNotes = record.OutcomeNotes,
                        IncludeInLog = record.IncludeInLog ?? true,
                        Starred = record.Starred,
                        CreatedAt = submitted,
                        UpdatedAt = record.ReviewedAt ?? submitted,
                    };
                    foreach (var tagName in record.Tags ?? [])
                    {
                        if (!tags.TryGetValue(tagName, out var tag))
                        {
                            tag = new Tag { Name = tagName, CreatedAt = submitted };
                            tags[tagName] = tag;
                        }

                        prompt.Tags.Add(tag);
                    }

                    prompts.Add(prompt);
                    if (prompt.TranscriptUuid is { Length: > 0 } uuid) promptsByUuid[uuid] = prompt;
                    break;

                case "manualChange":
                    var created = record.CreatedAt ?? default;
                    changes.Add((new ManualChange
                    {
                        Title = Required(record.Title, "title", path, lineNumber),
                        Description = record.Description,
                        Reasoning = record.Reasoning,
                        Files = record.Files,
                        CommitSha = record.CommitSha,
                        CreatedAt = created,
                        UpdatedAt = created,
                    }, record.RelatedPromptUuid));
                    break;

                // Unknown kinds come from a newer exporter; skip them rather than refuse the whole file.
            }
        }

        foreach (var (change, uuid) in changes)
        {
            if (uuid is not null && promptsByUuid.TryGetValue(uuid, out var related)) change.RelatedPrompt = related;
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        db.Sessions.AddRange(sessions.Values);
        db.Tags.AddRange(tags.Values);
        db.Prompts.AddRange(prompts);
        db.ManualChanges.AddRange(changes.Select(c => c.Change));
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return prompts.Count;
    }

    private static string Required(string? value, string field, string path, int line) =>
        value is { Length: > 0 } ? value : throw new InvalidDataException($"{path}:{line}: missing \"{field}\"");

    /// <summary>The union of every record shape <see cref="SnapshotExporter"/> writes.</summary>
    private sealed record Record
    {
        public string? Kind { get; init; }
        public string? Id { get; init; }
        public string? Title { get; init; }
        public string? Cwd { get; init; }
        public DateTimeOffset? StartedAt { get; init; }
        public string? Name { get; init; }
        public string? Description { get; init; }
        public string? Color { get; init; }
        public DateTimeOffset? CreatedAt { get; init; }
        public string? SessionId { get; init; }
        public int Sequence { get; init; }
        public string? TranscriptUuid { get; init; }
        public DateTimeOffset? SubmittedAt { get; init; }
        public CaptureSource Source { get; init; }
        public string? Text { get; init; }
        public string? ResponseText { get; init; }
        public string? Model { get; init; }
        public bool HumanReviewed { get; init; }
        public DateTimeOffset? ReviewedAt { get; init; }
        public string? Comment { get; init; }
        public string? Rationale { get; init; }
        public PromptOutcome Outcome { get; init; }
        public string? OutcomeNotes { get; init; }
        public bool? IncludeInLog { get; init; }
        public bool Starred { get; init; }
        public string[]? Tags { get; init; }
        public string? Reasoning { get; init; }
        public string? Files { get; init; }
        public string? CommitSha { get; init; }
        public string? RelatedPromptUuid { get; init; }
    }
}
