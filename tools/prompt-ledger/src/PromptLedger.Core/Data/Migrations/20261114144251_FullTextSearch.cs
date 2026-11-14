using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PromptLedger.Core.Data.Migrations;

/// <summary>
/// FTS5 index over prompt text, Claude's reply and the human annotations.
/// It is an external-content table kept in sync by triggers, so the text isn't stored twice.
/// </summary>
public partial class FullTextSearch : Migration
{
    private const string Columns = "Text, ResponseText, Comment, Rationale, OutcomeNotes";

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql($"""
            CREATE VIRTUAL TABLE PromptsFts USING fts5(
                {Columns},
                content='Prompts', content_rowid='Id',
                tokenize='porter unicode61 remove_diacritics 2'
            );
            """);

        migrationBuilder.Sql($"""
            CREATE TRIGGER Prompts_ai AFTER INSERT ON Prompts BEGIN
                INSERT INTO PromptsFts(rowid, {Columns})
                VALUES (new.Id, new.Text, new.ResponseText, new.Comment, new.Rationale, new.OutcomeNotes);
            END;
            """);

        migrationBuilder.Sql($"""
            CREATE TRIGGER Prompts_ad AFTER DELETE ON Prompts BEGIN
                INSERT INTO PromptsFts(PromptsFts, rowid, {Columns})
                VALUES ('delete', old.Id, old.Text, old.ResponseText, old.Comment, old.Rationale, old.OutcomeNotes);
            END;
            """);

        migrationBuilder.Sql($"""
            CREATE TRIGGER Prompts_au AFTER UPDATE OF {Columns} ON Prompts BEGIN
                INSERT INTO PromptsFts(PromptsFts, rowid, {Columns})
                VALUES ('delete', old.Id, old.Text, old.ResponseText, old.Comment, old.Rationale, old.OutcomeNotes);
                INSERT INTO PromptsFts(rowid, {Columns})
                VALUES (new.Id, new.Text, new.ResponseText, new.Comment, new.Rationale, new.OutcomeNotes);
            END;
            """);

        migrationBuilder.Sql("INSERT INTO PromptsFts(PromptsFts) VALUES ('rebuild');");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP TRIGGER IF EXISTS Prompts_au;");
        migrationBuilder.Sql("DROP TRIGGER IF EXISTS Prompts_ad;");
        migrationBuilder.Sql("DROP TRIGGER IF EXISTS Prompts_ai;");
        migrationBuilder.Sql("DROP TABLE IF EXISTS PromptsFts;");
    }
}
