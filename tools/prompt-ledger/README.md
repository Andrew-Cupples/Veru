# Prompt Ledger

Records every prompt sent to Claude Code in this repository, lets a human annotate each one
(reviewed toggle, comment, #hashtags, why it was sent, what was kept, changed or rejected), and generates
[`PROMPT_LOG.md`](../../PROMPT_LOG.md) for the assessment.

## How prompts are captured

| Path | When | What it adds |
|---|---|---|
| `UserPromptSubmit` hook | the moment a prompt is sent | prompt text, session, time |
| `Stop` hook / `ledger import` | after each turn, or on demand | transcript message ID, Claude's reply, model; fills in anything the hook missed |

Both are registered in [`.claude/settings.json`](../../.claude/settings.json) and run `async`, so
Claude Code never waits on them. A hook capture and its transcript entry are matched (same session, same text,
within 5 minutes) rather than stored twice. Hook failures never interrupt Claude Code; they are written to
`data/hook-errors.log`.

## Storage

- `data/ledger.db`: SQLite in WAL mode, with an FTS5 full-text index. **Not committed.**
- `snapshot/prompt-log.jsonl`: full data export, one record per line. **Committed** (diffs cleanly).
- `PROMPT_LOG.md` (repo root): the generated deliverable. **Committed.**

Schema changes go through EF Core migrations in `src/PromptLedger.Core/Data/Migrations`.

## Layout

```
src/PromptLedger.Core   domain, DbContext and migrations, capture/import, search, exporters
src/PromptLedger.Api    ASP.NET Core minimal API on http://localhost:5180 (OpenAPI at /openapi/v1.json)
src/PromptLedger.Cli    `ledger` command used by the hooks
tests/PromptLedger.Tests  unit and API integration tests (real SQLite files)
hooks/ scripts/         hook entry point and CLI build script
```

## Usage

Requires the .NET 10 SDK.

```bash
# one-time: build the CLI the hooks call
tools/prompt-ledger/scripts/build-cli.sh

# backfill or resync from Claude Code transcripts
tools/prompt-ledger/.bin/ledger import

# regenerate PROMPT_LOG.md and the snapshot
tools/prompt-ledger/.bin/ledger export

# run the API
dotnet run --project tools/prompt-ledger/src/PromptLedger.Api

# tests
dotnet test tools/prompt-ledger
```

## API overview

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/prompts?q=&tags=a,b&reviewed=&outcome=&starred=&untagged=&from=&to=&sort=&page=&pageSize=` | search and filter |
| GET / PATCH | `/api/prompts/{id}` | read and annotate (null fields unchanged; `#tags` in the comment are added) |
| PUT | `/api/prompts/{id}/tags` | replace tags |
| GET / PATCH / DELETE | `/api/tags[/{name}]` | list with counts and prefix autocomplete; rename (merges), recolor, describe |
| GET | `/api/sessions`, `/api/stats` | overview data |
| CRUD | `/api/manual-changes` | changes made outside of AI (deliverable 4) |
| GET / PUT | `/api/settings/{key}` | any JSON: themes, layouts, saved filters |
| POST | `/api/sync`, `/api/export` | import transcripts; write PROMPT_LOG.md and the snapshot |
