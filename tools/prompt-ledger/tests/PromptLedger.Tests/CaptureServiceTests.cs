using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;
using PromptLedger.Core.Domain;
using PromptLedger.Core.Hooks;
using PromptLedger.Core.Services;
using PromptLedger.Core.Transcripts;
using static PromptLedger.Tests.TranscriptFixture;

namespace PromptLedger.Tests;

public class CaptureServiceTests
{
    private static readonly DateTimeOffset T0 = new(2026, 11, 14, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Hook_capture_is_linked_to_its_transcript_entry_instead_of_duplicated()
    {
        await using var testDb = await TestDb.CreateAsync();
        var clock = new FakeTimeProvider(T0.AddSeconds(1));

        await using (var db = testDb.Open())
        {
            await new HookHandler(new CaptureService(db, clock)).HandleAsync(
                $$"""{"hook_event_name":"UserPromptSubmit","session_id":"{{SessionId}}","prompt":"Build the thing","cwd":"C:\\repo"}""");
        }

        await using (var db = testDb.Open())
        {
            var result = await new CaptureService(db, clock).ImportAsync(Transcript(
                HumanPrompt("u1", "Build the thing", T0),
                AssistantText("a1", "Done.", T0.AddSeconds(3))));
            Assert.Equal(new ImportResult(Added: 0, Linked: 1, Updated: 0, Skipped: 0), result);
        }

        await using (var db = testDb.Open())
        {
            var prompt = Assert.Single(await db.Prompts.ToListAsync());
            Assert.Equal("u1", prompt.TranscriptUuid);
            Assert.Equal(CaptureSource.Hook, prompt.Source);
            Assert.Equal("Done.", prompt.ResponseText);
            Assert.Equal(T0, prompt.SubmittedAt);
        }
    }

    [Fact]
    public async Task Import_is_idempotent_and_updates_replies_that_grew()
    {
        await using var testDb = await TestDb.CreateAsync();

        await using (var db = testDb.Open())
        {
            var first = await new CaptureService(db).ImportAsync(Transcript(HumanPrompt("u1", "Hi", T0)));
            Assert.Equal(1, first.Added);
        }

        await using (var db = testDb.Open())
        {
            var second = await new CaptureService(db).ImportAsync(Transcript(
                HumanPrompt("u1", "Hi", T0), AssistantText("a1", "Hello!", T0.AddSeconds(2))));
            Assert.Equal(new ImportResult(0, 0, 1, 0), second);

            var third = await new CaptureService(db).ImportAsync(Transcript(
                HumanPrompt("u1", "Hi", T0), AssistantText("a1", "Hello!", T0.AddSeconds(2))));
            Assert.Equal(new ImportResult(0, 0, 0, 1), third);
        }

        await using (var check = testDb.Open())
        {
            Assert.Equal(1, await check.Prompts.CountAsync());
        }
    }

    [Fact]
    public async Task Identical_short_prompts_far_apart_are_not_merged()
    {
        await using var testDb = await TestDb.CreateAsync();
        await using var db = testDb.Open();
        var capture = new CaptureService(db, new FakeTimeProvider(T0));
        await capture.RecordHookPromptAsync(SessionId, "yes", null);

        // The transcript's "yes" was sent an hour later, so it is a different prompt.
        var result = await capture.ImportAsync(Transcript(HumanPrompt("u9", "yes", T0.AddHours(1))));
        Assert.Equal(1, result.Added);
        Assert.Equal([1, 2], await db.Prompts.OrderBy(p => p.SubmittedAt).Select(p => p.Sequence).ToListAsync());
    }

    [Fact]
    public async Task Hook_ignores_unknown_events_and_empty_prompts()
    {
        await using var testDb = await TestDb.CreateAsync();
        await using var db = testDb.Open();
        var hook = new HookHandler(new CaptureService(db));

        Assert.StartsWith("ignored", await hook.HandleAsync("""{"hook_event_name":"PreToolUse","session_id":"s"}"""), StringComparison.Ordinal);
        Assert.StartsWith("ignored", await hook.HandleAsync("""{"hook_event_name":"UserPromptSubmit","session_id":"s","prompt":"   "}"""), StringComparison.Ordinal);
        Assert.Equal(0, await db.Prompts.CountAsync());
    }

    private static TranscriptSession Transcript(params string[] lines) => TranscriptReader.Parse(lines)!;
}
