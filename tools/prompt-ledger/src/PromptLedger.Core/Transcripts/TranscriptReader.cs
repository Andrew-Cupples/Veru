using System.Text;
using System.Text.Json;

namespace PromptLedger.Core.Transcripts;

/// <summary>One human prompt and Claude's text replies for that turn, read from a transcript.</summary>
public sealed record TranscriptTurn(
    string Uuid,
    string SessionId,
    DateTimeOffset Timestamp,
    string Text,
    string? ResponseText,
    string? Model,
    string? Cwd);

public sealed record TranscriptSession(string SessionId, string? Title, IReadOnlyList<TranscriptTurn> Turns);

/// <summary>
/// Reads Claude Code transcript files (JSONL). The format is internal to Claude Code and not a
/// public contract, so parsing is defensive: unknown lines are skipped and nothing here throws on bad data.
/// </summary>
public static class TranscriptReader
{
    public static async Task<TranscriptSession?> ReadFileAsync(string path, CancellationToken ct = default)
    {
        // FileShare.ReadWrite: Claude Code is usually still appending to the file.
        await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        using var reader = new StreamReader(stream, Encoding.UTF8);
        var lines = new List<string>();
        while (await reader.ReadLineAsync(ct) is { } line)
        {
            lines.Add(line);
        }

        return Parse(lines);
    }

    public static TranscriptSession? Parse(IEnumerable<string> lines)
    {
        string? sessionId = null;
        string? title = null;
        var turns = new List<TurnBuilder>();
        TurnBuilder? current = null;

        foreach (var line in lines)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;

            JsonDocument doc;
            try
            {
                doc = JsonDocument.Parse(line);
            }
            catch (JsonException)
            {
                continue; // a partially written last line, or corruption
            }

            using (doc)
            {
                var root = doc.RootElement;
                if (root.ValueKind != JsonValueKind.Object) continue;

                var type = Str(root, "type");
                sessionId ??= Str(root, "sessionId");

                if (type is "custom-title" or "summary")
                {
                    title = Str(root, "customTitle") ?? Str(root, "summary") ?? title;
                    continue;
                }

                if (Bool(root, "isSidechain") || Bool(root, "isMeta")) continue;

                if (type == "user" && IsHumanPrompt(root, out var text))
                {
                    var uuid = Str(root, "uuid");
                    if (uuid is null || !TryTimestamp(root, out var ts)) continue;
                    current = new TurnBuilder(uuid, Str(root, "sessionId") ?? sessionId ?? "", ts, text, Str(root, "cwd"));
                    turns.Add(current);
                }
                else if (type == "assistant" && current is not null &&
                         root.TryGetProperty("message", out var message) && message.ValueKind == JsonValueKind.Object)
                {
                    current.Model ??= Str(message, "model");
                    foreach (var block in Blocks(message))
                    {
                        if (Str(block, "type") == "text" && Str(block, "text") is { Length: > 0 } t)
                        {
                            current.Responses.Add(t.Trim());
                        }
                    }
                }
            }
        }

        if (sessionId is null) return null;
        return new TranscriptSession(sessionId, title, turns.Select(t => t.Build()).ToList());
    }

    /// <summary>True for a prompt the human typed, false for tool results and system-injected messages.</summary>
    private static bool IsHumanPrompt(JsonElement root, out string text)
    {
        text = "";
        if (root.TryGetProperty("toolUseResult", out _)) return false;

        // Newer transcripts label the origin explicitly; when they do, trust it.
        if (Str(root, "turnOrigin") is { } turnOrigin && turnOrigin != "human") return false;
        if (root.TryGetProperty("origin", out var origin) && origin.ValueKind == JsonValueKind.Object &&
            Str(origin, "kind") is { } kind && kind != "human") return false;

        if (!root.TryGetProperty("message", out var message) || message.ValueKind != JsonValueKind.Object) return false;
        if (Str(message, "role") is { } role && role != "user") return false;

        string? content = null;
        if (message.TryGetProperty("content", out var c))
        {
            if (c.ValueKind == JsonValueKind.String)
            {
                content = c.GetString();
            }
            else if (c.ValueKind == JsonValueKind.Array)
            {
                if (c.EnumerateArray().Any(b => Str(b, "type") == "tool_result")) return false;
                content = string.Join("\n\n", c.EnumerateArray()
                    .Where(b => Str(b, "type") == "text")
                    .Select(b => Str(b, "text"))
                    .OfType<string>());
            }
        }

        if (string.IsNullOrWhiteSpace(content)) return false;
        content = content.Trim();
        if (content.StartsWith("[Request interrupted", StringComparison.Ordinal)) return false;

        text = content;
        return true;
    }

    private static IEnumerable<JsonElement> Blocks(JsonElement message) =>
        message.TryGetProperty("content", out var c) && c.ValueKind == JsonValueKind.Array
            ? c.EnumerateArray().Where(b => b.ValueKind == JsonValueKind.Object)
            : [];

    private static string? Str(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString()
            : null;

    private static bool Bool(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.True;

    private static bool TryTimestamp(JsonElement e, out DateTimeOffset ts)
    {
        ts = default;
        return Str(e, "timestamp") is { } s &&
               DateTimeOffset.TryParse(s, System.Globalization.CultureInfo.InvariantCulture,
                   System.Globalization.DateTimeStyles.AssumeUniversal, out ts);
    }

    private sealed class TurnBuilder(string uuid, string sessionId, DateTimeOffset ts, string text, string? cwd)
    {
        public List<string> Responses { get; } = [];
        public string? Model { get; set; }

        public TranscriptTurn Build() => new(
            uuid, sessionId, ts, text,
            Responses.Count == 0 ? null : string.Join("\n\n", Responses),
            Model, cwd);
    }
}
