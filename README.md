# Veru

A full-stack app over Yahoo Finance's public chart API: a .NET 10 market data API and a React UI.

## Requirements

- .NET 10 SDK
- Node 22+

## Run

From the repo root, in any terminal (PowerShell, cmd, bash, zsh):

```bash
npm start          # start everything; opens http://localhost:5173 when it's ready
```

```bash
npm stop           # stop everything (or press Ctrl+C in the window running npm start)
```

That's all you need. `npm start` checks for Node 22+ and the .NET 10 SDK (and says where to get them if they're
missing), installs packages on the first run, stops anything left over from an earlier run so ports are never
"already in use", then waits until all servers are healthy before opening the browser. If a server crashes, the rest
are stopped too, so it's never half-running. `npm stop` works from any other terminal, including after the original
window was closed. Set `VERU_NO_BROWSER=1` to skip opening the browser.

Everything is reached through the one address, **http://localhost:5173**. Behind it the UI's dev server forwards `/api`
calls to the market data API (:5080) and the Prompt Ledger API (:5180); you never need to open those directly.

The **Start** page shows the flow as a picture (pick a stock, choose a chart, compare stocks, export). **Reports** builds 2D and 3D charts (Plotly) with templates and a style editor. **Raw data**
queries the same bars as a table, before any aggregation. **Analytics** charts how the app itself is used (clicks, reports, exports,
page time, API latency, errors...) with the same report framework; events stay in the browser and nothing typed is recorded.
The **Prompt ledger** is in the header.

Run the pieces on their own with `npm run api` (market data API) or `npm run web` (UI only).
In VS Code, pick **Veru (Market API + Ledger API + UI)** in Run and Debug and press F5.

## Test

```bash
npm test           # backend xUnit tests, then web codegen + typecheck + lint + vitest
```

## Layout

```
backend/
  src/Veru.MarketData   domain (ChartQuery, PriceSeries), IMarketDataProvider, Yahoo client + mapper, cache decorator
  src/Veru.Api          minimal API: GET /api/market/options, GET /api/market/{symbol}/bars
  tests/Veru.Tests      query validation, Yahoo mapping/error handling, API integration tests
web/                    React app (@veru/web); TypeScript API types are generated from web/openapi/openapi.json
tools/prompt-ledger/    prompt capture + annotation tool that produces PROMPT_LOG.md (see its README)
```

## API

`GET /api/market/{symbol}/bars?interval=15m&range=1mo&extendedHours=false`

Returns raw OHLCV bars in exchange-local time, with prices rounded to 4 decimals and a `session` (pre, regular
or post) on each intraday bar, plus the instrument's descriptive fields. The defaults follow the assessment:
15-minute bars over the last month. Errors come back as RFC 9457 problem details: 400 for invalid parameters
(including interval/range combinations Yahoo can't serve), 404 for an unknown symbol, 502 when Yahoo fails.
Identical queries are cached for 60 seconds (`MarketData:CacheDuration`).

`POST /api/suggestions` saves a suggestion from the box on the Analytics page (feature, type, message; validated, 400 on
missing fields) and `GET /api/suggestions?limit=50` lists the latest. They're stored in SQLite at
`backend/src/Veru.Api/data/suggestions.db` (created on first use; set `Suggestions:DatabasePath` to move it).
