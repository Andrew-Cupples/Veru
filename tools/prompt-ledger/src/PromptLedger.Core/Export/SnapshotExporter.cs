using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using PromptLedger.Core.Data;

namespace PromptLedger.Core.Export;

/// <summary>
/// Writes the whole ledger as JSON Lines, one record per line in a stable order.
/// This is the committed, diff-friendly copy of the data; the SQLite file itself stays out of git.
/// </summary>
public sealed class SnapshotExporter(LedgerDbContext db)
{
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    public async Task WriteAsync(string path, CancellationToken ct = default)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var sb = new StringBuilder();

        foreach (var s in await db.Sessions.AsNoTracking().OrderBy(s => s.StartedAt).ThenBy(s => s.Id).ToListAsync(ct))
        {
            Line(sb, new { kind = "session", s.Id, s.Title, s.Cwd, s.StartedAt });
        }

        foreach (var t in await db.Tags.AsNoTracking().OrderBy(t => t.Name).ToListAsync(ct))
        {
            Line(sb, new { kind = "tag", t.Name, t.Description, t.Color, t.CreatedAt });
        }

        var prompts = await db.Prompts.AsNoTracking().Include(p => p.Tags)
            .OrderBy(p => p.SubmittedAt).ThenBy(p => p.Id).ToListAsync(ct);
        foreach (var p in prompts)
        {
            Line(sb, new
            {
                kind = "prompt",
                p.SessionId,
                p.Sequence,
                p.TranscriptUuid,
                p.SubmittedAt,
                p.Source,
                p.Text,
                p.ResponseText,
                p.Model,
                p.HumanReviewed,
                p.ReviewedAt,
                p.Comment,
                p.Rationale,
                p.Outcome,
                p.OutcomeNotes,
                p.IncludeInLog,
                p.Starred,
                tags = p.Tags.Select(t => t.Name).Order(StringComparer.Ordinal).ToArray(),
            });
        }

        foreach (var c in await db.ManualChanges.AsNoTracking().Include(c => c.RelatedPrompt).OrderBy(c => c.CreatedAt).ToListAsync(ct))
        {
            Line(sb, new
            {
                kind = "manualChange",
                c.Title,
                c.Description,
                c.Reasoning,
                c.Files,
                c.CommitSha,
                relatedPromptUuid = c.RelatedPrompt?.TranscriptUuid,
                c.CreatedAt,
            });
        }

        await File.WriteAllTextAsync(path, sb.ToString(), new UTF8Encoding(false), ct);
    }

    private static void Line(StringBuilder sb, object record) =>
        sb.Append(JsonSerializer.Serialize(record, Json)).Append('\n');
}
