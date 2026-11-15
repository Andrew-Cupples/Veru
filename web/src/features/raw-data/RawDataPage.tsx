import { useMemo, useState } from 'react';
import { useDocumentTitle } from '../../a11y/useDocumentTitle';
import { InstrumentSummary } from '../data-query/InstrumentSummary';
import { ApiAlert, GranularityNotice, SeriesGate, loadStatus } from '../data-query/SourceControls';
import { COLUMNS, runQuery, toCsv, toSql, type ColumnKey, type QuerySpec } from '../data-query/query';
import { useDataSource } from '../data-query/useDataSource';
import { downloadText } from '../../lib/download';
import { track } from '../../analytics/tracker';
import { QueryEditor } from './QueryEditor';
import { MAX_RENDERED_ROWS, ResultsTable } from './ResultsTable';
import { loadSpec, saveSpec } from './specMemory';
import styles from '../data-query/DataQuery.module.css';

export function RawDataPage() {
  const ds = useDataSource();
  const { source, draft, series, rows } = ds;
  const [spec, setSpecState] = useState<QuerySpec>(loadSpec);
  const [copied, setCopied] = useState(false);

  useDocumentTitle(source.symbol ? `${source.symbol} · Raw data` : 'Raw data');

  const result = useMemo(() => runQuery(rows, spec), [rows, spec]);
  const columns: ColumnKey[] = spec.select;
  const sql = toSql(source.symbol ? source : draft, spec);

  const setSpec = (next: QuerySpec | ((s: QuerySpec) => QuerySpec)) =>
    setSpecState((current) => {
      const value = typeof next === 'function' ? next(current) : next;
      saveSpec(value);
      return value;
    });

  const sortBy = (column: ColumnKey) =>
    setSpec((s) => ({
      ...s,
      orderBy: { column, direction: s.orderBy?.column === column && s.orderBy.direction === 'asc' ? 'desc' : 'asc' },
    }));

  const downloadCsv = () => {
    track('export', { target: 'CSV', detail: 'raw data', subject: source.symbol, value: result.rows.length });
    downloadText(toCsv(result.rows, columns), `${source.symbol}_${source.interval}_${source.range}.csv`, 'text/csv');
  };

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      track('export', { target: 'SQL', detail: 'copied', subject: source.symbol });
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (permissions, insecure context); the SQL stays visible to copy by hand.
    }
  };

  // One polite message for screen readers describing what the page is doing now.
  const status = copied ? 'SQL copied' : loadStatus(ds, `${result.rows.length.toLocaleString()} rows for ${source.symbol}`);

  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <h1>Raw data</h1>
        <p>
          Query the bars the market data API returns, before any aggregation. Press <kbd>/</kbd> to jump to the stock.
        </p>
      </div>

      <p className="sr-only" role="status">
        {status}
      </p>

      <ApiAlert ds={ds} />

      <div className={styles.card}>
        <QueryEditor ds={ds} spec={spec} onSpecChange={setSpec} />
        <div className={styles.sql}>
          <pre aria-label="Equivalent SQL">{sql}</pre>
          <button type="button" className={styles.linkButton} onClick={copySql} aria-label="Copy SQL">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <SeriesGate ds={ds}>
        {(data) => (
          <div className={styles.results} data-stale={series.isFetching || series.isPlaceholderData} aria-busy={series.isFetching}>
            <InstrumentSummary instrument={data.instrument} />
            <GranularityNotice data={data} />

            <div className={styles.resultBar}>
              <span>
                <strong>{result.rows.length.toLocaleString()}</strong> rows
                {result.rows.length !== rows.length && <> of {rows.length.toLocaleString()} bars</>}
                {result.matched !== result.rows.length && <> · {result.matched.toLocaleString()} matched before LIMIT</>}
                {result.rows.length > MAX_RENDERED_ROWS && <> · showing the first {MAX_RENDERED_ROWS.toLocaleString()}</>}
              </span>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={downloadCsv}
                disabled={!result.rows.length || !columns.length}
              >
                Download CSV
              </button>
            </div>

            {!columns.length ? (
              <div className={styles.empty}>
                No columns selected.{' '}
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => setSpec((s) => ({ ...s, select: COLUMNS.map((c) => c.key) }))}
                >
                  Select all columns
                </button>
              </div>
            ) : result.rows.length ? (
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
      </SeriesGate>
    </div>
  );
}
