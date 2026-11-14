using Microsoft.EntityFrameworkCore;
using PromptLedger.Core.Domain;
using PromptLedger.Core.Export;
using PromptLedger.Core.Services;

namespace PromptLedger.Tests;

public class QueryAndExportTests
{
    private static readonly DateTimeOffset T0 = new(2026, 11, 14, 12, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData("migr", "\"migr\"*")]
    [InlineData("db  schema", "\"db\"* AND \"schema\"*")]
    [InlineData("\" OR 1=1 NEAR(", "\"OR\"* AND \"1\"* AND \"1\"* AND \"NEAR\"*")]
    [InlineData("  ** ", null)]
    public void Fts_query_is_sanitized(string input, string? expected) =>
        Assert.Equal(expected, PromptQuery.ToFtsQuery(input));

    [Fact]
    public async Task Search_and_tag_filters_combine()
    {
        await using var testDb = await TestDb.CreateAsync();
        await using var db = testDb.Open();
        await Seed(db);

        var query = new PromptQuery(db);
        var byText = await query.Build(new PromptFilter { Search = "migrat" }).Select(p => p.Text).ToListAsync();
        Assert.Equal(["Write the database migration"], byText);

        var byComment = await query.Build(new PromptFilter { Search = "flaky" }).Select(p => p.Id).CountAsync();
        Assert.Equal(1, byComment);

        var byTags = await query.Build(new PromptFilter { Tags = ["#DB", "backend"] }).Select(p => p.Text).ToListAsync();
        Assert.Equal(["Write the database migration"], byTags);

        Assert.Equal(1, await query.Build(new PromptFilter { Reviewed = true }).CountAsync());
        Assert.Equal(1, await query.Build(new PromptFilter { Untagged = true }).CountAsync());
        Assert.Equal(0, await query.Build(new PromptFilter { Search = "\" OR *" }).CountAsync());
    }

    [Fact]
    public async Task Fts_index_follows_updates()
    {
        await using var testDb = await TestDb.CreateAsync();
        await using var db = testDb.Open();
        await Seed(db);

        var prompt = await db.Prompts.FirstAsync(p => p.Text.StartsWith("Style"));
        prompt.Comment = "now mentions zeppelins";
        await db.SaveChangesAsync();

        Assert.Equal(1, await new PromptQuery(db).Build(new PromptFilter { Search = "zeppelin" }).CountAsync());
    }

    [Fact]
    public async Task Prompt_log_contains_annotations_and_skips_excluded_prompts()
    {
        await using var testDb = await TestDb.CreateAsync();
        await using var db = testDb.Open();
        await Seed(db);

        var md = await new PromptLogExporter(db).RenderAsync();

        Assert.Contains("### 1. Write the database migration", md, StringComparison.Ordinal);
        Assert.Contains("**Why I sent it**\n\nNeed a schema", md, StringComparison.Ordinal);
        Assert.Contains("outcome: **changed**", md, StringComparison.Ordinal);
        Assert.Contains("`#backend` `#db`", md, StringComparison.Ordinal);
        Assert.DoesNotContain("Secret scratch prompt", md, StringComparison.Ordinal);
        Assert.Contains("### Renamed the endpoint", md, StringComparison.Ordinal);
        Assert.Equal(md, await new PromptLogExporter(db).RenderAsync()); // deterministic
    }

    private static async Task Seed(PromptLedger.Core.Data.LedgerDbContext db)
    {
        var tags = new TagService(db);
        db.Sessions.Add(new Session { Id = "s1", Title = "Session one", StartedAt = T0 });

        var migration = new Prompt
        {
            SessionId = "s1", Sequence = 1, Text = "Write the database migration", SubmittedAt = T0,
            HumanReviewed = true, Rationale = "Need a schema", Outcome = PromptOutcome.Changed,
            OutcomeNotes = "Renamed columns",
        };
        await tags.SetTagsAsync(migration, ["db", "backend"]);

        var style = new Prompt
        {
            SessionId = "s1", Sequence = 2, Text = "Style the header", SubmittedAt = T0.AddMinutes(1),
            Comment = "tests were flaky",
        };
        var excluded = new Prompt
        {
            SessionId = "s1", Sequence = 3, Text = "Secret scratch prompt", SubmittedAt = T0.AddMinutes(2), IncludeInLog = false,
        };
        await tags.SetTagsAsync(excluded, ["scratch"]);

        db.Prompts.AddRange(migration, style, excluded);
        db.ManualChanges.Add(new ManualChange { Title = "Renamed the endpoint", Reasoning = "Clearer", CreatedAt = T0 });
        await db.SaveChangesAsync();
    }
}
