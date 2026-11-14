using Microsoft.EntityFrameworkCore;
using PromptLedger.Core.Hooks;
using PromptLedger.Core.Services;

namespace PromptLedger.Tests;

public class PromptClassifierTests
{
    [Theory]
    [InlineData("<task-notification>\n<task-id>x</task-id>", true)]
    [InlineData("  <ci-monitor-event>pr 12</ci-monitor-event>", true)]
    [InlineData("<side-sessions-event>done", true)]
    [InlineData("<system-reminder>hi", true)]
    [InlineData("<create-pr-command>\n## Overview", false)] // sent when the user clicks Create PR: a real request
    [InlineData("Why does <task-notification> show up?", false)]
    [InlineData("Fix the bug", false)]
    public void Detects_app_injected_envelopes(string text, bool expected) =>
        Assert.Equal(expected, PromptClassifier.IsSystemEvent(text));

    [Fact]
    public async Task Hook_does_not_record_system_events()
    {
        await using var testDb = await TestDb.CreateAsync();
        await using var db = testDb.Open();
        var result = await new HookHandler(new CaptureService(db)).HandleAsync(
            """{"hook_event_name":"UserPromptSubmit","session_id":"s","prompt":"<task-notification>\n<status>failed</status>"}""");

        Assert.StartsWith("ignored", result, StringComparison.Ordinal);
        Assert.Equal(0, await db.Prompts.CountAsync());
    }

    [Fact]
    public async Task Non_ascii_prompts_from_the_hook_link_to_the_transcript()
    {
        // Matching must be exact on non-ASCII text. (The original bug, the CLI decoding stdin with the
        // console code page, lives in the CLI and was verified by piping UTF-8 into the published exe.)
        await using var testDb = await TestDb.CreateAsync();
        await using var db = testDb.Open();
        var now = DateTimeOffset.UtcNow;
        var capture = new CaptureService(db);
        await capture.RecordHookPromptAsync(TranscriptFixture.SessionId, "Use “smart quotes” — and émoji 🎉", null);

        var result = await capture.ImportAsync(PromptLedger.Core.Transcripts.TranscriptReader.Parse(
            [TranscriptFixture.HumanPrompt("u1", "Use “smart quotes” — and émoji 🎉", now)])!);

        Assert.Equal(1, result.Linked);
        Assert.Equal(1, await db.Prompts.CountAsync());
    }
}
