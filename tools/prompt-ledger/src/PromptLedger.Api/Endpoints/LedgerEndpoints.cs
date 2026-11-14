using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PromptLedger.Core.Data;
using PromptLedger.Core.Domain;
using PromptLedger.Core.Export;
using PromptLedger.Core.Services;

namespace PromptLedger.Api.Endpoints;

/// <summary>Sessions, manual changes, stats, settings, and the sync and export actions.</summary>
public static class LedgerEndpoints
{
    public static RouteGroupBuilder MapLedgerEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/sessions", ListSessions).WithTags("Sessions");

        var changes = api.MapGroup("/manual-changes").WithTags("Manual changes");
        changes.MapGet("/", ListChanges);
        changes.MapPost("/", CreateChange);
        changes.MapPut("/{id:int}", UpdateChange);
        changes.MapDelete("/{id:int}", DeleteChange);

        api.MapGet("/stats", Stats).WithTags("Stats");

        var settings = api.MapGroup("/settings").WithTags("Settings");
        settings.MapGet("/{key}", GetSetting);
        settings.MapPut("/{key}", PutSetting).WithSummary("Store any JSON value (themes, layouts, saved filters)");

        api.MapPost("/sync", Sync).WithTags("Actions").WithSummary("Import Claude Code transcripts for this repository");
        api.MapPost("/export", Export).WithTags("Actions").WithSummary("Write PROMPT_LOG.md and the JSONL snapshot");
        return api;
    }

    private static async Task<Ok<List<SessionDto>>> ListSessions(LedgerDbContext db, CancellationToken ct) =>
        TypedResults.Ok(await db.Sessions.AsNoTracking()
            .OrderByDescending(s => s.StartedAt)
            .Select(s => new SessionDto(s.Id, s.Title, s.Cwd, s.StartedAt, s.Prompts.Count, s.Prompts.Count(p => p.HumanReviewed)))
            .ToListAsync(ct));

    private static async Task<Ok<List<ManualChangeDto>>> ListChanges(LedgerDbContext db, CancellationToken ct) =>
        TypedResults.Ok(await db.ManualChanges.AsNoTracking()
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => ToDto(c))
            .ToListAsync(ct));

    private static async Task<Results<Created<ManualChangeDto>, ValidationProblem>> CreateChange(
        ManualChangeRequest request, LedgerDbContext db, CancellationToken ct)
    {
        if (await Validate(request, db, ct) is { } problem) return problem;
        var change = new ManualChange { Title = request.Title.Trim() };
        Apply(change, request);
        db.ManualChanges.Add(change);
        await db.SaveChangesAsync(ct);
        return TypedResults.Created($"/api/manual-changes/{change.Id}", ToDto(change));
    }

    private static async Task<Results<Ok<ManualChangeDto>, NotFound, ValidationProblem>> UpdateChange(
        int id, ManualChangeRequest request, LedgerDbContext db, CancellationToken ct)
    {
        if (await Validate(request, db, ct) is { } problem) return problem;
        var change = await db.ManualChanges.FindAsync([id], ct);
        if (change is null) return TypedResults.NotFound();
        change.Title = request.Title.Trim();
        Apply(change, request);
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(ToDto(change));
    }

    private static async Task<Results<NoContent, NotFound>> DeleteChange(int id, LedgerDbContext db, CancellationToken ct) =>
        await db.ManualChanges.Where(c => c.Id == id).ExecuteDeleteAsync(ct) == 0 ? TypedResults.NotFound() : TypedResults.NoContent();

    private static async Task<Ok<StatsDto>> Stats(LedgerDbContext db, CancellationToken ct)
    {
        var byOutcome = await db.Prompts.GroupBy(p => p.Outcome)
            .Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);

        // Small data set: bucket by local calendar day in memory.
        var days = (await db.Prompts.AsNoTracking().Select(p => new { p.SubmittedAt, p.HumanReviewed }).ToListAsync(ct))
            .GroupBy(p => p.SubmittedAt.ToLocalTime().ToString("yyyy-MM-dd", CultureInfo.InvariantCulture))
            .OrderBy(g => g.Key, StringComparer.Ordinal)
            .Select(g => new DayCount(g.Key, g.Count(), g.Count(x => x.HumanReviewed)))
            .ToList();

        var topTags = (await db.Tags.AsNoTracking()
                .Select(t => new TagDto(t.Name, t.Description, t.Color, t.Prompts.Count, t.CreatedAt))
                .ToListAsync(ct))
            .OrderByDescending(t => t.PromptCount).ThenBy(t => t.Name, StringComparer.Ordinal).Take(15).ToList();

        return TypedResults.Ok(new StatsDto(
            await db.Prompts.CountAsync(ct),
            await db.Prompts.CountAsync(p => p.HumanReviewed, ct),
            await db.Sessions.CountAsync(ct),
            await db.Tags.CountAsync(ct),
            await db.ManualChanges.CountAsync(ct),
            byOutcome.ToDictionary(x => x.Key.ToString(), x => x.Count),
            days,
            topTags));
    }

    private static async Task<Results<Ok<SettingDto>, NotFound>> GetSetting(string key, LedgerDbContext db, CancellationToken ct)
    {
        var setting = await db.Settings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == key, ct);
        return setting is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(new SettingDto(setting.Key, JsonDocument.Parse(setting.Json).RootElement.Clone(), setting.UpdatedAt));
    }

    private static async Task<Results<Ok<SettingDto>, ValidationProblem>> PutSetting(
        string key, JsonElement value, LedgerDbContext db, CancellationToken ct)
    {
        if (key.Length > 100)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["key"] = ["Key must be 100 characters or fewer."] });
        }

        var json = value.GetRawText();
        var setting = await db.Settings.FindAsync([key], ct);
        if (setting is null)
        {
            setting = new Setting { Key = key, Json = json };
            db.Settings.Add(setting);
        }
        else
        {
            setting.Json = json;
        }

        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(new SettingDto(key, value, setting.UpdatedAt));
    }

    private static async Task<Ok<SyncResultDto>> Sync(CaptureService capture, LedgerOptions options, CancellationToken ct)
    {
        var r = await capture.ImportDirectoryAsync(options.TranscriptDirectory, ct);
        return TypedResults.Ok(new SyncResultDto(r.Added, r.Linked, r.Updated, r.Skipped));
    }

    private static async Task<Ok<ExportResultDto>> Export(LedgerDbContext db, LedgerOptions options, CancellationToken ct)
    {
        await new PromptLogExporter(db).WriteAsync(options.PromptLogPath, ct);
        await new SnapshotExporter(db).WriteAsync(options.SnapshotPath, ct);
        return TypedResults.Ok(new ExportResultDto(options.PromptLogPath, options.SnapshotPath));
    }

    private static async Task<ValidationProblem?> Validate(ManualChangeRequest r, LedgerDbContext db, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(r.Title)) errors["title"] = ["Title is required."];
        if (r.CommitSha is { Length: > 64 }) errors["commitSha"] = ["Commit SHA is too long."];
        if (r.RelatedPromptId is { } pid && !await db.Prompts.AnyAsync(p => p.Id == pid, ct))
        {
            errors["relatedPromptId"] = [$"Prompt {pid} does not exist."];
        }

        return errors.Count == 0 ? null : TypedResults.ValidationProblem(errors);
    }

    private static void Apply(ManualChange c, ManualChangeRequest r)
    {
        c.Description = Clean(r.Description);
        c.Reasoning = Clean(r.Reasoning);
        c.Files = Clean(r.Files);
        c.CommitSha = Clean(r.CommitSha);
        c.RelatedPromptId = r.RelatedPromptId;
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static ManualChangeDto ToDto(ManualChange c) =>
        new(c.Id, c.Title, c.Description, c.Reasoning, c.Files, c.CommitSha, c.RelatedPromptId, c.CreatedAt, c.UpdatedAt);
}
