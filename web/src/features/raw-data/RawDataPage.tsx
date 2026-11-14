import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ApiError } from '../../api/client';
import { usePriceSeries, useQueryOptions } from '../../api/hooks';
import { InstrumentSummary } from './InstrumentSummary';
import { QueryEditor } from './QueryEditor';
import { MAX_RENDERED_ROWS, ResultsTable } from './ResultsTable';
import { DEFAULT_SPEC, runQuery, toCsv, toRows, toSql, type ColumnKey, type QuerySpec, type Source } from './query';
import styles from './RawData.module.css';

const DEFAULT_INTERVAL = '15m';
const DEFAULT_RANGE = '1mo';
const QUICK_PICKS = ['TSLA', 'AAPL', 'NVDA', 'SPY', '^GSPC', 'BTC-USD'];

/** The data source lives in the URL so a query can be bookmarked, shared and survives a refresh. */
function readSource(params: URLSearchParams): Source {
  return {
    symbol: params.get('symbol') ?? '',
    interval: params.get('interval') ?? DEFAULT_INTERVAL,
    range: params.get('range') ?? DEFAULT_RANGE,
    extendedHours: params.get('ext') === '1',
  };
}

export function RawDataPage() {
  const [params, setParams] = useSearchParams();
  const source = readSource(params);
  const [draft, setDraft] = useState<Source>(source);
  const [spec, setSpec] = useState<QuerySpec>(DEFAULT_SPEC);
  const [copied, setCopied] = useState(false);

  const options = useQueryOptions();
  const series = usePriceSeries(source.symbol ? source : null);

  const rows = useMemo(() => toRows(series.data?.bars ?? []), [series.data]);
  const result = useMemo(() => runQuery(rows, spec), [rows, spec]);
  const columns: ColumnKey[] = spec.select.length ? spec.select : DEFAULT_SPEC.select;
  const sql = toSql(source.symbol ? source : draft, spec);

  const run = (next: Source = draft) => {
    const symbol = next.symbol.trim().toUpperCase();
    setDraft({ ...next, symbol });
    setParams({
      symbol,
      interval: next.interval,
      range: next.range,
      ...(next.extendedHours ? { ext: '1' } : {}),
    });
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

  const granularityChanged = series.data && series.data.granularity !== series.data.query.interval;

  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <h1>Raw data</h1>
        <p>Query the bars the market data API returns, before any aggregation.</p>
      </div>

      <div className={styles.card}>
        <QueryEditor
          draft={draft}
          onDraftChange={setDraft}
          onRun={() => run()}
          running={series.isFetching}
          options={options.data}
          spec={spec}
          onSpecChange={setSpec}
        />
        <div className={styles.sql}>
          <pre aria-label="Equivalent SQL">{sql}</pre>
          <button type="button" className={styles.linkButton} onClick={copySql}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {options.isError && (
        <div className={styles.alert} role="alert">
          {options.error.message}
        </div>
      )}

      {!source.symbol ? (
        <div className={styles.empty}>
          <p>Enter a symbol and press Run, or start with one of these:</p>
          <div className={styles.chips}>
            {QUICK_PICKS.map((symbol) => (
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
        <div className={styles.loading} aria-busy="true">Loading {source.symbol}…</div>
      ) : (
        <div className={styles.results} data-stale={series.isFetching || series.isPlaceholderData}>
          <InstrumentSummary instrument={series.data.instrument} />

          {granularityChanged && (
            <div className={styles.notice}>
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
            <ResultsTable rows={result.rows} columns={columns} orderBy={spec.orderBy} onSort={sortBy} />
          ) : (
            <div className={styles.empty}>No bars match these conditions.</div>
          )}
        </div>
      )}
    </div>
  );
}
