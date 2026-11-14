using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PromptLedger.Core.Data;
using PromptLedger.Core.Domain;
using PromptLedger.Core.Services;

namespace PromptLedger.Api.Endpoints;

public static class PromptEndpoints
{
    public const int MaxPageSize = 200;

    public static RouteGroupBuilder MapPromptEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/prompts").WithTags("Prompts");
        group.MapGet("/", List).WithSummary("Search and filter prompts");
        group.MapGet("/document", Document)
            .WithSummary("Every prompt with full text and annotations, in reading order (session start, then sequence)");
        group.MapGet("/{id:int}", Get).WithName("GetPrompt");
        group.MapPatch("/{id:int}", Update).WithSummary("Update annotations (null fields are left unchanged)");
        group.MapPut("/{id:int}/tags", SetTags).WithSummary("Replace the prompt's tags");
        group.MapDelete("/{id:int}", Delete).WithSummary("Permanently remove a prompt (e.g. a stray or duplicate capture)");
        return api;
    }

    private static async Task<Results<Ok<PagedResult<PromptSummaryDto>>, ValidationProblem>> List(
        PromptQuery query,
        string? q,
        string? tags,
        bool? reviewed,
        PromptOutcome? outcome,
        string? sessionId,
        bool? starred,
        bool? includeInLog,
        bool? untagged,
        DateTimeOffset? from,
        DateTimeOffset? to,
        PromptSort sort = PromptSort.Newest,
        int page = 1,
        int pageSize = 50,
        CancellationToken ct = default)
    {
        if (page < 1 || pageSize < 1 || pageSize > MaxPageSize)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["paging"] = [$"page must be >= 1 and pageSize between 1 and {MaxPageSize}."],
            });
        }

        var filter = new PromptFilter
        {
            Search = q,
            Tags = (tags ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
            Reviewed = reviewed,
            Outcome = outcome,
            SessionId = sessionId,
            Starred = starred,
            IncludeInLog = includeInLog,
            Untagged = untagged,
            From = from,
            To = to,
            Sort = sort,
        };

        var source = query.Build(filter);
        var total = await source.CountAsync(ct);
        var items = await source
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(p => new PromptSummaryDto(
                p.Id, p.SessionId, p.Sequence, p.Text, p.SubmittedAt, p.Source, p.Model,
                p.HumanReviewed, p.Outcome, p.Starred, p.IncludeInLog,
                p.Comment != null && p.Comment != "",
                p.ResponseText != null,
                p.Tags.OrderBy(t => t.Name).Select(t => t.Name).ToList()))
            .ToListAsync(ct);

        return TypedResults.Ok(new PagedResult<PromptSummaryDto>(items, total, page, pageSize));
    }

    private static async Task<Ok<List<PromptDetailDto>>> Document(LedgerDbContext db, string? sessionId, CancellationToken ct)
    {
        var q = db.Prompts.AsNoTracking().Include(p => p.Tags).Include(p => p.Session).AsQueryable();
        if (!string.IsNullOrEmpty(sessionId)) q = q.Where(p => p.SessionId == sessionId);

        var prompts = await q
            .OrderBy(p => p.Session!.StartedAt).ThenBy(p => p.SessionId).ThenBy(p => p.Sequence)
            .AsSplitQuery()
            .ToListAsync(ct);
        return TypedResults.Ok(prompts.Select(ToDetail).ToList());
    }

    private static async Task<Results<Ok<PromptDetailDto>, NotFound>> Get(int id, LedgerDbContext db, CancellationToken ct)
    {
        var prompt = await Load(db, id, ct);
        return prompt is null ? TypedResults.NotFound() : TypedResults.Ok(ToDetail(prompt));
    }

    private static async Task<Results<Ok<PromptDetailDto>, NotFound, ValidationProblem>> Update(
        int id, UpdatePromptRequest request, LedgerDbContext db, TagService tags, TimeProvider clock, CancellationToken ct)
    {
        if (request.Outcome is { } o && !Enum.IsDefined(o))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["outcome"] = ["Unknown outcome."] });
        }

        var prompt = await Load(db, id, ct, tracking: true);
        if (prompt is null) return TypedResults.NotFound();

        if (request.HumanReviewed is { } reviewed && reviewed != prompt.HumanReviewed)
        {
            prompt.HumanReviewed = reviewed;
            prompt.ReviewedAt = reviewed ? clock.GetUtcNow() : null;
        }

        if (request.Comment is not null)
        {
            prompt.Comment = NullIfEmpty(request.Comment);
            await tags.AddFromTextAsync(prompt, prompt.Comment, ct);
        }

        if (request.Rationale is not null) prompt.Rationale = NullIfEmpty(request.Rationale);
        if (request.OutcomeNotes is not null) prompt.OutcomeNotes = NullIfEmpty(request.OutcomeNotes);
        if (request.Outcome is { } outcome) prompt.Outcome = outcome;
        if (request.Starred is { } starred) prompt.Starred = starred;
        if (request.IncludeInLog is { } include) prompt.IncludeInLog = include;

        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(ToDetail(prompt));
    }

    private static async Task<Results<Ok<PromptDetailDto>, NotFound>> SetTags(
        int id, SetTagsRequest request, LedgerDbContext db, TagService tags, CancellationToken ct)
    {
        var prompt = await Load(db, id, ct, tracking: true);
        if (prompt is null) return TypedResults.NotFound();

        await tags.SetTagsAsync(prompt, request.Tags ?? [], ct);
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(ToDetail(prompt));
    }

    private static async Task<Results<NoContent, NotFound>> Delete(int id, LedgerDbContext db, CancellationToken ct) =>
        await db.Prompts.Where(p => p.Id == id).ExecuteDeleteAsync(ct) == 0 ? TypedResults.NotFound() : TypedResults.NoContent();

    private static Task<Prompt?> Load(LedgerDbContext db, int id, CancellationToken ct, bool tracking = false)
    {
        var q = db.Prompts.Include(p => p.Tags).Include(p => p.Session).AsQueryable();
        if (!tracking) q = q.AsNoTracking();
        return q.FirstOrDefaultAsync(p => p.Id == id, ct);
    }

    private static string? NullIfEmpty(string s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    internal static PromptDetailDto ToDetail(Prompt p) => new(
        p.Id, p.SessionId, p.Session?.Title, p.Sequence, p.Text, p.SubmittedAt, p.Source, p.TranscriptUuid, p.Model,
        p.ResponseText, p.HumanReviewed, p.ReviewedAt, p.Comment, p.Rationale, p.Outcome, p.OutcomeNotes,
        p.Starred, p.IncludeInLog, p.Tags.Select(t => t.Name).Order(StringComparer.Ordinal).ToList(),
        p.CreatedAt, p.UpdatedAt);
}
