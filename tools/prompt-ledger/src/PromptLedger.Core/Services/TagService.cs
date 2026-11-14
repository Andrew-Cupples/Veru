using Microsoft.EntityFrameworkCore;
using PromptLedger.Core.Data;
using PromptLedger.Core.Domain;

namespace PromptLedger.Core.Services;

public sealed class TagService(LedgerDbContext db)
{
    /// <summary>Loads the named tags, creating any that don't exist yet (not saved until SaveChanges).</summary>
    public async Task<List<Tag>> EnsureAsync(IEnumerable<string?> rawNames, CancellationToken ct = default)
    {
        var names = TagNames.NormalizeAll(rawNames);
        if (names.Count == 0) return [];

        var existing = await db.Tags.Where(t => names.Contains(t.Name)).ToListAsync(ct);
        var pending = db.ChangeTracker.Entries<Tag>()
            .Where(e => e.State == EntityState.Added)
            .Select(e => e.Entity);

        var result = new List<Tag>(names.Count);
        foreach (var name in names)
        {
            var tag = existing.FirstOrDefault(t => t.Name == name)
                      ?? pending.FirstOrDefault(t => t.Name == name);
            if (tag is null)
            {
                tag = new Tag { Name = name };
                db.Tags.Add(tag);
            }

            result.Add(tag);
        }

        return result;
    }

    /// <summary>Replaces a prompt's tags with exactly the given set.</summary>
    public async Task SetTagsAsync(Prompt prompt, IEnumerable<string?> rawNames, CancellationToken ct = default)
    {
        var tags = await EnsureAsync(rawNames, ct);
        prompt.Tags.Clear();
        prompt.Tags.AddRange(tags);
    }

    /// <summary>Adds any #hashtags written in the text without removing existing tags.</summary>
    public async Task AddFromTextAsync(Prompt prompt, string? text, CancellationToken ct = default)
    {
        var found = TagNames.Extract(text);
        if (found.Count == 0) return;
        foreach (var tag in await EnsureAsync(found, ct))
        {
            if (!prompt.Tags.Contains(tag)) prompt.Tags.Add(tag);
        }
    }
}
