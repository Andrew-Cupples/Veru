# Prompt Ledger

Records every prompt sent to Claude Code in this repository, lets a human annotate each one
(reviewed toggle, comment, #hashtags, why it was sent, what was kept, changed or rejected), and generates
[`PROMPT_LOG.md`](../../PROMPT_LOG.md) for the assessment.

## Running it

Requires the .NET 10 SDK and Node 22+. From the repo root:

```bash
npm install
npm run ledger      # API on :5180 + UI on :5181, opens the browser
```

Then open **http://localhost:5181**. Port 5180 is the API only.

**In VS Code:** open the repo folder and install the recommended extensions (C# Dev Kit, ESLint). In
Run and Debug (Ctrl+Shift+D), choose **Prompt Ledger (API + UI)** and press F5. This starts the API under
the .NET debugger and the UI in a debuggable Chrome window, and stopping one stops both. For no debugger, run
the task **ledger: start (no debugger)** (Terminal → Run Task).

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
- `snapshot/prompt-log.jsonl`: full data export, one record per line. **Committed** (diffs cleanly). When the API
  starts on an empty database (a fresh clone), it loads this file, so every prompt and annotation is there from
  the first run. It never touches a database that already has data.
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

## UI (`web/`, package `@veru/prompt-ledger`)

An embeddable React module: `import { PromptLedger } from '@veru/prompt-ledger'` and render
`<PromptLedger />` inside any element with a height. It owns no routing, scopes every style under
`.pl-root`, sizes its breakpoints with container queries (its own width, not the window's), and takes the
host's `QueryClient` if one is passed.

- **Left:** outline of every prompt, grouped by session; filter by words or `#tag`.
- **Middle:** the whole ledger as one continuous document. Scrolling updates the outline and the panel.
- **Right:** annotations, autosaved as you type. While a field has focus the panel stays on that
  prompt, even if the document scrolls.
- **Keys:** `j`/`k` next/previous, `r` reviewed, `s` star, `c` comment, `/` filter,
  `Ctrl+Enter` (in a field) reviewed and next, `Esc` leave the field.
- **Theming:** all visuals are CSS variables in `src/theme/tokens.css`; `colorScheme` and `preset`
  (token overrides) props are the hooks for color presets.

```bash
npm install                 # at the repo root (npm workspaces)
npm run ledger:dev          # http://localhost:5181, proxies /api to the API on :5180
npm run ledger:check        # regenerate API types, typecheck, lint, test
```

TypeScript types come from `web/openapi/openapi.json`, which the API build regenerates; run
`npm run gen:api -w @veru/prompt-ledger` after an API contract change.

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
