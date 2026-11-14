using System.Text.Json;
using PromptLedger.Core.Services;

namespace PromptLedger.Core.Hooks;

/// <summary>
/// Handles Claude Code hook payloads (JSON on stdin).
/// UserPromptSubmit records the prompt immediately; Stop syncs the transcript so the
/// prompt gets its message uuid and Claude's reply.
/// </summary>
public sealed class HookHandler(CaptureService capture)
{
    public async Task<string> HandleAsync(string payloadJson, CancellationToken ct = default)
    {
        using var doc = JsonDocument.Parse(payloadJson);
        var root = doc.RootElement;
        var eventName = Str(root, "hook_event_name");
        var sessionId = Str(root, "session_id");

        switch (eventName)
        {
            case "UserPromptSubmit":
                var prompt = await capture.RecordHookPromptAsync(sessionId ?? "", Str(root, "prompt") ?? "", Str(root, "cwd"), ct);
                return prompt is null ? "ignored: empty prompt" : $"recorded prompt {prompt.Id}";

            case "Stop":
            case "SessionEnd":
                var transcript = Str(root, "transcript_path");
                if (transcript is null || !File.Exists(transcript)) return "ignored: transcript not found";
                var result = await capture.ImportTranscriptFileAsync(transcript, ct);
                return $"synced transcript: {result}";

            default:
                return $"ignored: unsupported event '{eventName}'";
        }
    }

    private static string? Str(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
}
