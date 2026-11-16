import { useMemo, useState } from 'react';
import { useDocumentTitle } from '../../a11y/useDocumentTitle';
import { InstrumentSummary } from '../data-query/InstrumentSummary';
import { ApiAlert, GranularityNotice, SeriesGate, loadStatus } from '../data-query/SourceControls';
import { COLUMNS, runQuery, toCsv, type ColumnKey, type QuerySpec } from '../data-query/query';
import { useDataSource } from '../data-query/useDataSource';
import { downloadText } from '../../lib/download';
import { track } from '../../analytics/tracker';
import { QueryEditor } from './QueryEditor';
import { MAX_RENDERED_ROWS, ResultsTable } from './ResultsTable';
import { loadSpec, saveSpec } from './specMemory';
import { useT } from '../../i18n/I18nProvider';
import styles from '../data-query/DataQuery.module.css';

export function RawDataPage() {
  const ds = useDataSource();
  const { source, series, rows } = ds;
  const [spec, setSpecState] = useState<QuerySpec>(loadSpec);
  const t = useT();

  useDocumentTitle(source.symbol ? `${source.symbol} · ${t.raw.title}` : t.raw.title);

  const result = useMemo(() => runQuery(rows, spec), [rows, spec]);
  const columns: ColumnKey[] = spec.select;

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

  // One polite message for screen readers describing what the page is doing now.
  const status = loadStatus(ds, t.raw.status(result.rows.length, source.symbol));

  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <h1>{t.raw.title}</h1>
      </div>

      <p className="sr-only" role="status">
        {status}
      </p>

      <ApiAlert ds={ds} />

      <div className={styles.card}>
        <QueryEditor ds={ds} spec={spec} onSpecChange={setSpec} />
      </div>

      <SeriesGate ds={ds}>
        {(data) => (
          <div className={styles.results} data-stale={series.isFetching || series.isPlaceholderData} aria-busy={series.isFetching}>
            <InstrumentSummary instrument={data.instrument} />
            <GranularityNotice data={data} />

            <div className={styles.resultBar}>
              <span>
                {t.raw.rows(result.rows.length)}
                {result.rows.length !== rows.length && t.raw.ofBars(rows.length)}
                {result.matched !== result.rows.length && t.raw.matchedBeforeLimit(result.matched)}
                {result.rows.length > MAX_RENDERED_ROWS && t.raw.showingFirst(MAX_RENDERED_ROWS)}
              </span>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={downloadCsv}
                disabled={!result.rows.length || !columns.length}
              >
                {t.raw.downloadCsv}
              </button>
            </div>

            {!columns.length ? (
              <div className={styles.empty}>
                {t.raw.noColumns}{' '}
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => setSpec((s) => ({ ...s, select: COLUMNS.map((c) => c.key) }))}
                >
                  {t.raw.selectAllColumns}
                </button>
              </div>
            ) : result.rows.length ? (
              <ResultsTable
                rows={result.rows}
                columns={columns}
                orderBy={spec.orderBy}
                onSort={sortBy}
                caption={t.raw.caption(source.symbol, t.intervals[source.interval] ?? source.interval, t.ranges[source.range] ?? source.range)}
              />
            ) : (
              <div className={styles.empty}>
                {t.raw.noMatches}{' '}
                <button type="button" className={styles.linkButton} onClick={() => setSpec((s) => ({ ...s, where: [] }))}>
                  {t.raw.clearConditions}
                </button>
              </div>
            )}
          </div>
        )}
      </SeriesGate>
    </div>
  );
}
