using Microsoft.EntityFrameworkCore;
using PromptLedger.Core.Data;
using PromptLedger.Core.Domain;
using PromptLedger.Core.Transcripts;

namespace PromptLedger.Core.Services;

public sealed record ImportResult(int Added, int Linked, int Updated, int Skipped)
{
    public static ImportResult operator +(ImportResult a, ImportResult b) =>
        new(a.Added + b.Added, a.Linked + b.Linked, a.Updated + b.Updated, a.Skipped + b.Skipped);

    public static ImportResult Empty { get; } = new(0, 0, 0, 0);
}

/// <summary>
/// The two ways prompts enter the ledger:
/// the live hook (prompt text only, the instant it is sent) and the transcript sync
/// (adds the stable message uuid and Claude's reply, and backfills anything the hook missed).
/// </summary>
public sealed class CaptureService(LedgerDbContext db, TimeProvider? clock = null)
{
    /// <summary>How far apart a hook capture and its transcript entry can be and still be treated as the same prompt.</summary>
    public static readonly TimeSpan MatchWindow = TimeSpan.FromMinutes(5);

    private readonly TimeProvider _clock = clock ?? TimeProvider.System;

    public async Task<Prompt?> RecordHookPromptAsync(string sessionId, string text, string? cwd, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(sessionId) || string.IsNullOrWhiteSpace(text)) return null;
        if (PromptClassifier.IsSystemEvent(text)) return null;

        var now = _clock.GetUtcNow();
        await EnsureSessionAsync(sessionId, cwd, now, ct);

        var prompt = new Prompt
        {
            SessionId = sessionId,
            Text = text.Trim(),
            SubmittedAt = now,
            Source = CaptureSource.Hook,
            Sequence = await NextSequenceAsync(sessionId, ct),
        };
        db.Prompts.Add(prompt);
        await db.SaveChangesAsync(ct);
        return prompt;
    }

    public async Task<ImportResult> ImportTranscriptFileAsync(string path, CancellationToken ct = default)
    {
        var session = await TranscriptReader.ReadFileAsync(path, ct);
        return session is null ? ImportResult.Empty : await ImportAsync(session, ct);
    }

    /// <summary>Imports every transcript in a Claude Code project folder.</summary>
    public async Task<ImportResult> ImportDirectoryAsync(string directory, CancellationToken ct = default)
    {
        if (!Directory.Exists(directory)) return ImportResult.Empty;
        var total = ImportResult.Empty;
        foreach (var file in Directory.EnumerateFiles(directory, "*.jsonl", SearchOption.TopDirectoryOnly).Order(StringComparer.Ordinal))
        {
            total += await ImportTranscriptFileAsync(file, ct);
        }

        return total;
    }

    public async Task<ImportResult> ImportAsync(TranscriptSession transcript, CancellationToken ct = default)
    {
        if (transcript.Turns.Count == 0) return ImportResult.Empty;

        var sessionId = transcript.SessionId;
        var session = await EnsureSessionAsync(sessionId, transcript.Turns[0].Cwd, transcript.Turns[0].Timestamp, ct);
        if (transcript.Title is { Length: > 0 } title) session.Title = title;
        if (transcript.Turns[0].Timestamp < session.StartedAt) session.StartedAt = transcript.Turns[0].Timestamp;

        var existing = await db.Prompts.Where(p => p.SessionId == sessionId).ToListAsync(ct);
        int added = 0, linked = 0, updated = 0, skipped = 0;

        foreach (var turn in transcript.Turns)
        {
            var prompt = existing.FirstOrDefault(p => p.TranscriptUuid == turn.Uuid);
            var known = prompt is not null;
            if (prompt is null)
            {
                // A hook capture of this same prompt that hasn't been linked to the transcript yet.
                prompt = existing
                    .Where(p => p.TranscriptUuid is null && SameText(p.Text, turn.Text) &&
                                (p.SubmittedAt - turn.Timestamp).Duration() <= MatchWindow)
                    .OrderBy(p => (p.SubmittedAt - turn.Timestamp).Duration())
                    .FirstOrDefault();

                if (prompt is not null)
                {
                    prompt.TranscriptUuid = turn.Uuid;
                    prompt.SubmittedAt = turn.Timestamp; // the transcript clock is authoritative
                    linked++;
                }
                else
                {
                    prompt = new Prompt
                    {
                        SessionId = sessionId,
                        Text = turn.Text,
                        SubmittedAt = turn.Timestamp,
                        Source = CaptureSource.TranscriptImport,
                        TranscriptUuid = turn.Uuid,
                    };
                    db.Prompts.Add(prompt);
                    existing.Add(prompt);
                    added++;
                }
            }

            var changed = (turn.ResponseText is not null && prompt.ResponseText != turn.ResponseText) ||
                          (turn.Model is not null && prompt.Model != turn.Model);
            if (changed)
            {
                prompt.ResponseText = turn.ResponseText ?? prompt.ResponseText;
                prompt.Model = turn.Model ?? prompt.Model;
            }

            if (known)
            {
                if (changed) updated++;
                else skipped++;
            }
        }

        Resequence(existing);
        await db.SaveChangesAsync(ct);
        return new ImportResult(added, linked, updated, skipped);
    }

    private static void Resequence(List<Prompt> prompts)
    {
        var i = 1;
        foreach (var p in prompts.OrderBy(p => p.SubmittedAt).ThenBy(p => p.Id))
        {
            if (p.Sequence != i) p.Sequence = i;
            i++;
        }
    }

    private static bool SameText(string a, string b) =>
        string.Equals(Canonical(a), Canonical(b), StringComparison.Ordinal);

    private static string Canonical(string s) => s.ReplaceLineEndings("\n").Trim();

    private async Task<Session> EnsureSessionAsync(string id, string? cwd, DateTimeOffset startedAt, CancellationToken ct)
    {
        var session = await db.Sessions.FindAsync([id], ct);
        if (session is null)
        {
            session = new Session { Id = id, Cwd = cwd, StartedAt = startedAt };
            db.Sessions.Add(session);
        }

        session.Cwd ??= cwd;
        return session;
    }

    private async Task<int> NextSequenceAsync(string sessionId, CancellationToken ct) =>
        (await db.Prompts.Where(p => p.SessionId == sessionId).MaxAsync(p => (int?)p.Sequence, ct) ?? 0) + 1;
}
