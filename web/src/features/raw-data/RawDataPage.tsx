import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ApiError } from '../../api/client';
import { usePriceSeries, useQueryOptions } from '../../api/hooks';
import { useDocumentTitle } from '../../a11y/useDocumentTitle';
import { InstrumentSummary } from './InstrumentSummary';
import { QueryEditor } from './QueryEditor';
import { MAX_RENDERED_ROWS, ResultsTable } from './ResultsTable';
import { DEFAULT_SPEC, runQuery, toCsv, toRows, toSql, type ColumnKey, type QuerySpec, type Source } from './query';
import { loadLastSource, loadRecentSymbols, loadSpec, rememberRun, saveSpec } from './memory';
import styles from './RawData.module.css';

const DEFAULT_INTERVAL = '15m';
const DEFAULT_RANGE = '1mo';
const QUICK_PICKS = ['TSLA', 'AAPL', 'NVDA', 'SPY', '^GSPC', 'BTC-USD'];

/**
 * The data source lives in the URL so a query can be bookmarked, shared and survives a refresh.
 * With no symbol in the URL (e.g. arriving from the nav), the last query run is shown again.
 */
function readSource(params: URLSearchParams, last: Source | null): Source {
  if (!params.get('symbol') && last) return last;
  return {
    symbol: params.get('symbol') ?? '',
    interval: params.get('interval') ?? DEFAULT_INTERVAL,
    range: params.get('range') ?? DEFAULT_RANGE,
    extendedHours: params.get('ext') === '1',
  };
}

const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

export function RawDataPage() {
  const [params, setParams] = useSearchParams();
  const [lastSource] = useState(loadLastSource);
  const source = readSource(params, lastSource);
  const [draft, setDraft] = useState<Source>(source);
  const [spec, setSpecState] = useState<QuerySpec>(loadSpec);
  const [recent, setRecent] = useState(loadRecentSymbols);
  const [copied, setCopied] = useState(false);
  const symbolRef = useRef<HTMLInputElement>(null);

  useDocumentTitle(source.symbol ? `${source.symbol} · Raw data` : 'Raw data');

  const options = useQueryOptions();
  const series = usePriceSeries(source.symbol ? source : null);

  const rows = useMemo(() => toRows(series.data?.bars ?? []), [series.data]);
  const result = useMemo(() => runQuery(rows, spec), [rows, spec]);
  const columns: ColumnKey[] = spec.select.length ? spec.select : DEFAULT_SPEC.select;
  const sql = toSql(source.symbol ? source : draft, spec);

  // "/" jumps to the symbol box from anywhere on the page, the quickest way to start a new query.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      e.preventDefault();
      symbolRef.current?.focus();
      symbolRef.current?.select();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const setSpec = (next: QuerySpec | ((s: QuerySpec) => QuerySpec)) =>
    setSpecState((current) => {
      const value = typeof next === 'function' ? next(current) : next;
      saveSpec(value);
      return value;
    });

  const run = (next: Source = draft) => {
    const symbol = next.symbol.trim().toUpperCase();
    const ran = { ...next, symbol };
    setDraft(ran);
    setRecent(rememberRun(ran));
    setParams({
      symbol,
      interval: ran.interval,
      range: ran.range,
      ...(ran.extendedHours ? { ext: '1' } : {}),
    });
  };

  // Changing interval, range or pre/post re-runs straight away once something is loaded: no extra Run click.
  const changeSourceOption = (next: Source) => {
    if (source.symbol && next.symbol.trim()) run(next);
    else setDraft(next);
  };

  const sortBy = (column: ColumnKey) =>
    setSpec((s) => ({
      ...s,
      orderBy: { column, direction: s.orderBy?.column === column && s.orderBy.direction === 'asc' ? 'desc' : 'asc' },
    }));

  const downloadCsv = () => {
    const blob = new Blob([toCsv(result.rows, columns)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `${source.symbol}_${source.interval}_${source.range}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (permissions, insecure context); the SQL stays visible to copy by hand.
    }
  };

  // Yahoo labels 60-minute bars "1h"; that's the same thing, not a change worth a notice.
  const sameBars = (a: string, b: string) => a === b || (a === '1h' && b === '60m') || (a === '60m' && b === '1h');
  const granularityChanged = series.data && !sameBars(series.data.granularity, series.data.query.interval);
  const picks = [...recent, ...QUICK_PICKS.filter((s) => !recent.includes(s))].slice(0, 10);

  // One polite message for screen readers describing what the page is doing now.
  let status = '';
  if (copied) status = 'SQL copied';
  else if (source.symbol && !series.isError) {
    if (!series.data || series.isFetching) status = `Loading ${source.symbol}`;
    else status = `${result.rows.length.toLocaleString()} rows for ${source.symbol}`;
  }

  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <h1>Raw data</h1>
        <p>
          Query the bars the market data API returns, before any aggregation. Press <kbd>/</kbd> to jump to the symbol.
        </p>
      </div>

      <p className="sr-only" role="status">
        {status}
      </p>

      {options.isError && (
        <div className={styles.alert} role="alert">
          <span>
            <strong>Market data API not reachable.</strong> Start it with <code>npm run api</code> (or everything with{' '}
            <code>npm run dev</code>). This page reconnects automatically.
          </span>
        </div>
      )}

      <div className={styles.card}>
        <QueryEditor
          draft={draft}
          onDraftChange={setDraft}
          onSourceOptionChange={changeSourceOption}
          onRun={() => run()}
          running={series.isFetching}
          ready={options.isSuccess}
          options={options.data}
          spec={spec}
          onSpecChange={setSpec}
          recentSymbols={recent}
          symbolRef={symbolRef}
        />
        <div className={styles.sql}>
          <pre aria-label="Equivalent SQL">{sql}</pre>
          <button type="button" className={styles.linkButton} onClick={copySql} aria-label="Copy SQL">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {!source.symbol ? (
        <div className={styles.empty}>
          <p id="quick-picks-label">Enter a symbol and press Enter, or pick one to load it now:</p>
          <div className={styles.chips} role="group" aria-labelledby="quick-picks-label">
            {picks.map((symbol) => (
              <button key={symbol} type="button" className={styles.chip} onClick={() => run({ ...draft, symbol })}>
                {symbol}
              </button>
            ))}
          </div>
        </div>
      ) : series.isError ? (
        <div className={styles.alert} role="alert">
          <strong>{series.error instanceof ApiError && series.error.status === 404 ? 'Symbol not found. ' : 'Query failed. '}</strong>
          {series.error.message}
          <button type="button" className={styles.linkButton} onClick={() => series.refetch()}>
            Try again
          </button>
        </div>
      ) : !series.data ? (
        <div className={styles.loading} aria-busy="true">
          Loading {source.symbol}…
        </div>
      ) : (
        <div className={styles.results} data-stale={series.isFetching || series.isPlaceholderData} aria-busy={series.isFetching}>
          <InstrumentSummary instrument={series.data.instrument} />

          {granularityChanged && (
            <div className={styles.notice} role="note">
              Yahoo returned <strong>{series.data.granularity}</strong> bars instead of {series.data.query.interval} for this
              range.
            </div>
          )}

          <div className={styles.resultBar}>
            <span>
              <strong>{result.rows.length.toLocaleString()}</strong> rows
              {result.rows.length !== rows.length && <> of {rows.length.toLocaleString()} bars</>}
              {result.matched !== result.rows.length && <> · {result.matched.toLocaleString()} matched before LIMIT</>}
              {result.rows.length > MAX_RENDERED_ROWS && <> · showing the first {MAX_RENDERED_ROWS.toLocaleString()}</>}
            </span>
            <button type="button" className={styles.secondaryButton} onClick={downloadCsv} disabled={!result.rows.length}>
              Download CSV
            </button>
          </div>

          {result.rows.length ? (
            <ResultsTable
              rows={result.rows}
              columns={columns}
              orderBy={spec.orderBy}
              onSort={sortBy}
              caption={`${source.symbol} ${source.interval} bars over ${source.range}`}
            />
          ) : (
            <div className={styles.empty}>
              No bars match these conditions.{' '}
              <button type="button" className={styles.linkButton} onClick={() => setSpec((s) => ({ ...s, where: [] }))}>
                Clear conditions
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
