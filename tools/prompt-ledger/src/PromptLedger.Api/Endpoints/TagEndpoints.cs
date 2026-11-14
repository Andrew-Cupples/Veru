using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PromptLedger.Core.Data;
using PromptLedger.Core.Services;

namespace PromptLedger.Api.Endpoints;

public static class TagEndpoints
{
    public static RouteGroupBuilder MapTagEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/tags").WithTags("Tags");
        group.MapGet("/", List).WithSummary("All tags with usage counts; optional prefix filter for autocomplete");
        group.MapPatch("/{name}", Update).WithSummary("Rename (merging into an existing tag), recolor or describe a tag");
        group.MapDelete("/{name}", Delete).WithSummary("Delete a tag and remove it from all prompts");
        return api;
    }

    private static async Task<Ok<List<TagDto>>> List(LedgerDbContext db, string? prefix, CancellationToken ct)
    {
        var q = db.Tags.AsNoTracking();
        var normalizedPrefix = prefix?.Trim().TrimStart('#').ToLowerInvariant();
        if (!string.IsNullOrEmpty(normalizedPrefix)) q = q.Where(t => t.Name.StartsWith(normalizedPrefix));

        var tags = await q
            .Select(t => new TagDto(t.Name, t.Description, t.Color, t.Prompts.Count, t.CreatedAt))
            .ToListAsync(ct);
        return TypedResults.Ok(tags.OrderByDescending(t => t.PromptCount).ThenBy(t => t.Name, StringComparer.Ordinal).ToList());
    }

    private static async Task<Results<Ok<TagDto>, NotFound, ValidationProblem>> Update(
        string name, UpdateTagRequest request, LedgerDbContext db, CancellationToken ct)
    {
        var tag = await db.Tags.Include(t => t.Prompts).FirstOrDefaultAsync(t => t.Name == TagNames.Normalize(name), ct);
        if (tag is null) return TypedResults.NotFound();

        if (request.Color is { Length: > 64 })
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["color"] = ["Color must be 64 characters or fewer."] });
        }

        if (request.Name is not null)
        {
            var newName = TagNames.Normalize(request.Name);
            if (newName is null)
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["name"] = ["Tags start with a letter and contain only letters, digits, '-' or '_' (max 50)."],
                });
            }

            if (newName != tag.Name)
            {
                var target = await db.Tags.Include(t => t.Prompts).FirstOrDefaultAsync(t => t.Name == newName, ct);
                if (target is null)
                {
                    tag.Name = newName;
                }
                else
                {
                    // Merge: move every prompt onto the existing tag, then drop this one.
                    foreach (var prompt in tag.Prompts.Where(p => !target.Prompts.Contains(p)).ToList())
                    {
                        target.Prompts.Add(prompt);
                    }

                    target.Description ??= tag.Description;
                    target.Color ??= tag.Color;
                    db.Tags.Remove(tag);
                    tag = target;
                }
            }
        }

        if (request.Description is not null) tag.Description = request.Description.Length == 0 ? null : request.Description.Trim();
        if (request.Color is not null) tag.Color = request.Color.Length == 0 ? null : request.Color.Trim();

        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(new TagDto(tag.Name, tag.Description, tag.Color, tag.Prompts.Count, tag.CreatedAt));
    }

    private static async Task<Results<NoContent, NotFound>> Delete(string name, LedgerDbContext db, CancellationToken ct)
    {
        var deleted = await db.Tags.Where(t => t.Name == TagNames.Normalize(name)).ExecuteDeleteAsync(ct);
        return deleted == 0 ? TypedResults.NotFound() : TypedResults.NoContent();
    }
}
