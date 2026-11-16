import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useDocumentTitle } from '../../a11y/useDocumentTitle';
import { compareLink } from '../compare/compareState';
import { ApiAlert, Clause, ConditionsEditor, GranularityNotice, SeriesGate, SourceFields, loadStatus } from '../data-query/SourceControls';
import { filterRows, type Condition } from '../data-query/query';
import { useDataSource } from '../data-query/useDataSource';
import { toReportRows } from './fields';
import { ReportWorkspace } from './ReportWorkspace';
import { useReports } from './useReports';
import styles from './Reports.module.css';
import dq from '../data-query/DataQuery.module.css';
import { useT } from '../../i18n/I18nProvider';

/**
 * Reports on market data: pick a stock (FROM), filter its bars (WHERE), chart them. Editing only:
 * comparing reports across stocks happens on the Compare page.
 */
export function ReportsPage() {
  const ds = useDataSource();
  const reports = useReports();
  const navigate = useNavigate();
  const { active } = reports;
  const t = useT();

  useDocumentTitle(`${active.name}${ds.source.symbol ? ` · ${ds.source.symbol}` : ''} · ${t.nav.reports}`);

  // Derived measures are computed after WHERE, so "return" starts at the first bar shown.
  const rowsFor = useCallback((where: readonly Condition[]) => toReportRows(filterRows(ds.rows, where)), [ds.rows]);

  return (
    <div className={styles.page}>
      <div className={dq.heading}>
        <h1>{t.nav.reports}</h1>
      </div>

      <ApiAlert ds={ds} />

      <div className={dq.card}>
        <form className={dq.editor} onSubmit={ds.submit} aria-label={t.reports.reportData}>
          <Clause keyword={t.query.from}>
            <SourceFields ds={ds} />
          </Clause>
          <Clause keyword={t.query.where}>
            <ConditionsEditor where={active.where} onChange={(where) => reports.update((r) => ({ ...r, where }))} />
          </Clause>
        </form>
      </div>

      <ReportWorkspace
        reports={reports}
        rowsFor={rowsFor}
        hasData={!!ds.series.data}
        subject={ds.source.symbol}
        noun="bars"
        status={(text) => loadStatus(ds, text)}
        compare={false}
        onCompareStocks={(report) => navigate(compareLink(report.id, ds.source))}
        gate={(content) => (
          <SeriesGate ds={ds}>
            {(data) => (
              <div className={dq.results} data-stale={ds.series.isFetching || ds.series.isPlaceholderData} aria-busy={ds.series.isFetching}>
                <GranularityNotice data={data} />
                {content()}
              </div>
            )}
          </SeriesGate>
        )}
      />
    </div>
  );
}
