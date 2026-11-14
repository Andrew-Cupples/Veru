# Veru

A full-stack app over Yahoo Finance's public chart API: a .NET 10 market data API and a React UI.

## Requirements

- .NET 10 SDK
- Node 22+

## Run

```bash
npm install
npm run dev        # market API :5080, ledger API :5180, UI :5173 (opens the browser)
```

Open **http://localhost:5173**. **Raw data** is the home page. **Reports** builds 2D and 3D charts (Plotly) from the same
data source, with templates and a style editor. **Analytics** charts how the app itself is used (clicks, reports, exports,
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
