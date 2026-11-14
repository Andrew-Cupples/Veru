using PromptLedger.Core.Services;

namespace PromptLedger.Tests;

public class TagNamesTests
{
    [Theory]
    [InlineData("#Bug-Fix", "bug-fix")]
    [InlineData("  ui ", "ui")]
    [InlineData("##double", "double")]
    [InlineData("trailing-", "trailing")]
    [InlineData("café", "café")]
    [InlineData("1abc", null)]
    [InlineData("has space", null)]
    [InlineData("", null)]
    [InlineData("#", null)]
    public void Normalize_produces_canonical_names(string raw, string? expected) =>
        Assert.Equal(expected, TagNames.Normalize(raw));

    [Fact]
    public void Normalize_rejects_names_over_the_limit() =>
        Assert.Null(TagNames.Normalize(new string('a', TagNames.MaxLength + 1)));

    [Fact]
    public void Extract_finds_hashtags_but_not_language_names_or_mid_word_hashes()
    {
        var tags = TagNames.Extract("Great #Refactor, wrote it in C# and F#. See abc#def and #refactor again. (#UI) #2fast");
        Assert.Equal(["refactor", "ui"], tags);
    }

    [Fact]
    public void Extract_handles_line_starts_and_punctuation()
    {
        var tags = TagNames.Extract("#first\n- #second.\n#third-tag!");
        Assert.Equal(["first", "second", "third-tag"], tags);
    }
}
