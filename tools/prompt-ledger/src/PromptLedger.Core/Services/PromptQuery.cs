using System.Text;
using Microsoft.EntityFrameworkCore;
using PromptLedger.Core.Data;
using PromptLedger.Core.Domain;

namespace PromptLedger.Core.Services;

public enum PromptSort
{
    Newest,
    Oldest,
}

/// <summary>Filters for listing prompts. Every filter is optional and they combine with AND.</summary>
public sealed record PromptFilter
{
    /// <summary>Full-text query (words are matched as prefixes, e.g. "migr" matches "migration").</summary>
    public string? Search { get; init; }

    /// <summary>Prompts must have every one of these tags.</summary>
    public IReadOnlyList<string> Tags { get; init; } = [];

    public bool? Reviewed { get; init; }
    public PromptOutcome? Outcome { get; init; }
    public string? SessionId { get; init; }
    public bool? Starred { get; init; }
    public bool? IncludeInLog { get; init; }
    public bool? Untagged { get; init; }
    public DateTimeOffset? From { get; init; }
    public DateTimeOffset? To { get; init; }
    public PromptSort Sort { get; init; } = PromptSort.Newest;
}

public sealed class PromptQuery(LedgerDbContext db)
{
    public IQueryable<Prompt> Build(PromptFilter f)
    {
        IQueryable<Prompt> q = db.Prompts.AsNoTracking();

        var ftsQuery = ToFtsQuery(f.Search);
        if (ftsQuery is not null)
        {
            q = q.Where(p => db.Database
                .SqlQuery<int>($"SELECT rowid AS Value FROM PromptsFts WHERE PromptsFts MATCH {ftsQuery}")
                .Contains(p.Id));
        }

        foreach (var tag in TagNames.NormalizeAll(f.Tags))
        {
            q = q.Where(p => p.Tags.Any(t => t.Name == tag));
        }

        if (f.Reviewed is { } reviewed) q = q.Where(p => p.HumanReviewed == reviewed);
        if (f.Outcome is { } outcome) q = q.Where(p => p.Outcome == outcome);
        if (f.SessionId is { Length: > 0 } sid) q = q.Where(p => p.SessionId == sid);
        if (f.Starred is { } starred) q = q.Where(p => p.Starred == starred);
        if (f.IncludeInLog is { } inLog) q = q.Where(p => p.IncludeInLog == inLog);
        if (f.Untagged is true) q = q.Where(p => !p.Tags.Any());
        if (f.From is { } from) q = q.Where(p => p.SubmittedAt >= from);
        if (f.To is { } to) q = q.Where(p => p.SubmittedAt < to);

        return f.Sort == PromptSort.Oldest
            ? q.OrderBy(p => p.SubmittedAt).ThenBy(p => p.Id)
            : q.OrderByDescending(p => p.SubmittedAt).ThenByDescending(p => p.Id);
    }

    /// <summary>
    /// Turns free text into a safe FTS5 query: each word becomes a quoted prefix term, so
    /// user input can never inject FTS operators or cause a syntax error.
    /// </summary>
    internal static string? ToFtsQuery(string? search)
    {
        if (string.IsNullOrWhiteSpace(search)) return null;
        var terms = new List<string>();
        var current = new StringBuilder();

        void Flush()
        {
            if (current.Length > 0) terms.Add("\"" + current + "\"*");
            current.Clear();
        }

        foreach (var ch in search)
        {
            if (char.IsLetterOrDigit(ch)) current.Append(ch);
            else Flush();
        }

        Flush();
        return terms.Count == 0 ? null : string.Join(" AND ", terms);
    }
}
