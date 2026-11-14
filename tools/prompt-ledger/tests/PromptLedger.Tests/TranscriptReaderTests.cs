using PromptLedger.Core.Transcripts;
using static PromptLedger.Tests.TranscriptFixture;

namespace PromptLedger.Tests;

public class TranscriptReaderTests
{
    private static readonly DateTimeOffset T0 = new(2026, 11, 14, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Parses_human_turns_with_their_replies_and_ignores_noise()
    {
        var session = TranscriptReader.Parse(
        [
            Title("My session"),
            HumanPrompt("u1", "  Build the thing  ", T0),
            AssistantText("a1", "Working on it.", T0.AddSeconds(5)),
            ToolResult("u2", T0.AddSeconds(6)),
            AssistantText("a2", "Done.", T0.AddSeconds(9)),
            AssistantText("side", "subagent chatter", T0.AddSeconds(10), sidechain: true),
            HumanPrompt("u3", "[Request interrupted by user]", T0.AddSeconds(11)),
            "{ this line is truncated",
            "",
            HumanPrompt("u4", "Next", T0.AddMinutes(1)),
        ]);

        Assert.NotNull(session);
        Assert.Equal(SessionId, session.SessionId);
        Assert.Equal("My session", session.Title);
        Assert.Equal(2, session.Turns.Count);

        var first = session.Turns[0];
        Assert.Equal("u1", first.Uuid);
        Assert.Equal("Build the thing", first.Text);
        Assert.Equal("Working on it.\n\nDone.", first.ResponseText);
        Assert.Equal("claude-opus-5-5", first.Model);
        Assert.Equal(T0, first.Timestamp);

        Assert.Equal("Next", session.Turns[1].Text);
        Assert.Null(session.Turns[1].ResponseText);
    }

    [Fact]
    public void Returns_null_when_there_is_no_session()
    {
        Assert.Null(TranscriptReader.Parse(["not json", ""]));
    }
}
