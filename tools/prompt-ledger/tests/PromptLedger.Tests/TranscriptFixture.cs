using System.Text.Json;

namespace PromptLedger.Tests;

/// <summary>Builds transcript JSONL lines in the shape Claude Code writes them.</summary>
internal static class TranscriptFixture
{
    public const string SessionId = "11111111-2222-3333-4444-555555555555";

    public static string HumanPrompt(string uuid, string text, DateTimeOffset at) => Line(new
    {
        type = "user",
        uuid,
        sessionId = SessionId,
        timestamp = at.ToString("O"),
        isSidechain = false,
        turnOrigin = "human",
        origin = new { kind = "human" },
        cwd = "C:\\repo",
        message = new { role = "user", content = text },
    });

    public static string ToolResult(string uuid, DateTimeOffset at) => Line(new
    {
        type = "user",
        uuid,
        sessionId = SessionId,
        timestamp = at.ToString("O"),
        isSidechain = false,
        toolUseResult = new { stdout = "ok" },
        message = new { role = "user", content = new object[] { new { type = "tool_result", tool_use_id = "t1", content = "ok" } } },
    });

    public static string AssistantText(string uuid, string text, DateTimeOffset at, bool sidechain = false) => Line(new
    {
        type = "assistant",
        uuid,
        sessionId = SessionId,
        timestamp = at.ToString("O"),
        isSidechain = sidechain,
        message = new
        {
            role = "assistant",
            model = "claude-opus-5-5",
            content = new object[] { new { type = "thinking", thinking = "hmm" }, new { type = "text", text } },
        },
    });

    public static string Title(string title) => Line(new { type = "custom-title", customTitle = title, sessionId = SessionId });

    private static string Line(object o) => JsonSerializer.Serialize(o);
}
