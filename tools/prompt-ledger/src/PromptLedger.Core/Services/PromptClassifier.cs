using System.Text.RegularExpressions;

namespace PromptLedger.Core.Services;

/// <summary>
/// Recognizes messages that reach the prompt-submit hook but were not typed by the human,
/// such as background-task notices and app events. The Claude Code desktop app delivers these
/// as XML-like envelopes, e.g. &lt;task-notification&gt; or &lt;ci-monitor-event&gt;.
/// </summary>
public static partial class PromptClassifier
{
    // An envelope whose tag ends in -notification or -event, or a bare system reminder.
    [GeneratedRegex(@"^<(?:[a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:notification|event)|system-reminder)>", RegexOptions.CultureInvariant)]
    private static partial Regex SystemEnvelope();

    public static bool IsSystemEvent(string? text) =>
        text is not null && SystemEnvelope().IsMatch(text.TrimStart());
}
