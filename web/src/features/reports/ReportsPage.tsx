import { useCallback } from 'react';
import { useDocumentTitle } from '../../a11y/useDocumentTitle';
import { ApiAlert, Clause, ConditionsEditor, GranularityNotice, SeriesGate, SourceFields, loadStatus } from '../data-query/SourceControls';
import { filterRows, type Condition } from '../data-query/query';
import { useDataSource } from '../data-query/useDataSource';
import { toReportRows } from './fields';
import { ReportWorkspace } from './ReportWorkspace';
import { useReports } from './useReports';
import styles from './Reports.module.css';
import dq from '../data-query/DataQuery.module.css';

/** Reports on market data: pick a symbol (FROM), filter its bars (WHERE), chart them. */
export function ReportsPage() {
  const ds = useDataSource();
  const reports = useReports();
  const { active } = reports;

  useDocumentTitle(`${reports.comparing ? 'Compare' : active.name}${ds.source.symbol ? ` · ${ds.source.symbol}` : ''} · Reports`);

  // Derived measures are computed after WHERE, so "return" starts at the first bar shown.
  const rowsFor = useCallback((where: readonly Condition[]) => toReportRows(filterRows(ds.rows, where)), [ds.rows]);

  return (
    <div className={styles.page}>
      <div className={dq.heading}>
        <h1>Reports</h1>
      </div>

      <ApiAlert ds={ds} />

      <div className={dq.card}>
        <form className={dq.editor} onSubmit={ds.submit} aria-label="Report data">
          <Clause keyword="FROM">
            <SourceFields ds={ds} hint={false} />
          </Clause>
          {/* Each compared report keeps its own conditions, so WHERE belongs to the editor only. */}
          {!reports.comparing && (
            <Clause keyword="WHERE">
              <ConditionsEditor where={active.where} onChange={(where) => reports.update((r) => ({ ...r, where }))} />
            </Clause>
          )}
        </form>
      </div>

      <ReportWorkspace
        reports={reports}
        rowsFor={rowsFor}
        hasData={!!ds.series.data}
        subject={ds.source.symbol}
        noun="bars"
        status={(text) => loadStatus(ds, text)}
        gate={(content, mode) => (
          <SeriesGate ds={ds}>
            {(data) =>
              mode === 'compare' ? (
                content()
              ) : (
                <div className={dq.results} data-stale={ds.series.isFetching || ds.series.isPlaceholderData} aria-busy={ds.series.isFetching}>
                  <GranularityNotice data={data} />
                  {content()}
                </div>
              )
            }
          </SeriesGate>
        )}
      />
    </div>
  );
}
