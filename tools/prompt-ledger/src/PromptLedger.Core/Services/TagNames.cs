using System.Text.RegularExpressions;

namespace PromptLedger.Core.Services;

/// <summary>Normalization and #hashtag extraction rules, shared by every write path.</summary>
public static partial class TagNames
{
    public const int MaxLength = 50;

    // A hashtag starts with a letter and may contain letters, digits, '-' and '_'.
    // It must not be glued to a preceding word character (so "C#" and "abc#def" are not tags).
    [GeneratedRegex(@"(?<![\w#&])#([\p{L}][\p{L}\p{N}_-]*)", RegexOptions.CultureInvariant)]
    private static partial Regex HashtagPattern();

    [GeneratedRegex(@"^[\p{L}][\p{L}\p{N}_-]*$", RegexOptions.CultureInvariant)]
    private static partial Regex ValidName();

    /// <summary>Returns the canonical form of a tag ("#Bug-Fix " becomes "bug-fix"), or null if it is not a valid tag.</summary>
    public static string? Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var name = raw.Trim().TrimStart('#').Trim().ToLowerInvariant();
        name = name.TrimEnd('-', '_');
        if (name.Length is 0 or > MaxLength || !ValidName().IsMatch(name)) return null;
        return name;
    }

    /// <summary>Distinct normalized hashtags appearing in free text, in first-seen order.</summary>
    public static IReadOnlyList<string> Extract(string? text)
    {
        if (string.IsNullOrEmpty(text)) return [];
        var seen = new List<string>();
        foreach (Match m in HashtagPattern().Matches(text))
        {
            var name = Normalize(m.Groups[1].Value);
            if (name is not null && !seen.Contains(name)) seen.Add(name);
        }

        return seen;
    }

    /// <summary>Normalizes a list of user-supplied names, dropping invalid ones and duplicates.</summary>
    public static IReadOnlyList<string> NormalizeAll(IEnumerable<string?> raw) =>
        raw.Select(Normalize).OfType<string>().Distinct(StringComparer.Ordinal).ToList();
}
