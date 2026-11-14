import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useDocumentTitle } from '../../a11y/useDocumentTitle';
import { useCalmSwitch } from '../../motion/MotionProvider';
import { downloadText } from '../../lib/download';
import { ApiAlert, Clause, ConditionsEditor, GranularityNotice, SeriesGate, SourceFields, loadStatus } from '../data-query/SourceControls';
import { filterRows } from '../data-query/query';
import { useDataSource } from '../data-query/useDataSource';
import { DataPanel } from './DataPanel';
import { FIELD_BY_KEY, toReportRows } from './fields';
import { paletteColors } from './figure';
import { CHART_BY_TYPE, switchChart, type Report } from './model';
import { PlotlyChart, type ChartHandle } from './PlotlyChart';
import { ReportLibrary } from './ReportLibrary';
import { pointCount, shape } from './shape';
import { StylePanel } from './StylePanel';
import { tableToCsv, toTable } from './table';
import { useReports } from './useReports';
import { useThemeColors } from './themeColors';
import styles from './Reports.module.css';
import dq from '../data-query/DataQuery.module.css';

const TABLE_PREVIEW_ROWS = 500;
const TABS = ['data', 'style'] as const;
type Tab = (typeof TABS)[number];

/** One sentence describing the chart, for its accessible name and the status line. */
function describe(report: Report, points: number, symbol: string): string {
  const def = CHART_BY_TYPE[report.chart];
  const { enc } = report;
  const label = (k: keyof typeof FIELD_BY_KEY) => FIELD_BY_KEY[k].label.toLowerCase();
  let what: string;
  if (def.slots.series) what = `${enc.series.map((s) => label(s.field)).join(', ') || 'nothing'}${def.slots.x ? ` by ${label(enc.x)}` : ''}`;
  else if (def.slots.z) what = `${label(enc.z)} over ${label(enc.x)} and ${label(enc.y)}`;
  else if (report.chart === 'histogram') what = `distribution of ${label(enc.x)}`;
  else what = `open, high, low, close by ${label(enc.x)}`;
  const split = enc.color ? `, coloured by ${label(enc.color)}` : '';
  return `${def.label} chart of ${symbol} ${what}${split}. ${points.toLocaleString()} values.`;
}

export function ReportsPage() {
  const ds = useDataSource();
  const reports = useReports();
  const { active } = reports;
  const colors = useThemeColors();
  const chartRef = useRef<ChartHandle>(null);
  // `arrived` is the side the shown panel slid in from; null at first so nothing animates on load.
  const [{ tab, arrived }, setTabState] = useState<{ tab: Tab; arrived: 'left' | 'right' | null }>({ tab: 'data', arrived: null });
  const calmSwitch = useCalmSwitch();
  const setTab = (next: Tab) => {
    if (next === tab) return;
    const arrived = !calmSwitch() ? null : TABS.indexOf(next) > TABS.indexOf(tab) ? 'right' : 'left';
    setTabState({ tab: next, arrived });
  };
  const tabIds = useId();

  useDocumentTitle(`${active.name}${ds.source.symbol ? ` · ${ds.source.symbol}` : ''} · Reports`);

  const rows = useMemo(() => toReportRows(filterRows(ds.rows, active.where)), [ds.rows, active.where]);
  const shaped = useMemo(() => shape(rows, active), [rows, active]);
  const table = useMemo(() => toTable(shaped, active), [shaped, active]);
  const points = pointCount(shaped);
  const description = describe(active, points, ds.source.symbol);
  const fileBase = `${ds.source.symbol}_${active.name}`.replace(/[^\w.-]+/g, '_');
  const needsSeries = !!CHART_BY_TYPE[active.chart].slots.series && !active.enc.series.length;

  const onTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const next: Tab = e.key === 'Home' ? 'data' : e.key === 'End' ? 'style' : tab === 'data' ? 'style' : 'data';
    setTab(next);
    document.getElementById(`${tabIds}-${next}-tab`)?.focus();
  };

  const notice = reports.notice;
  const status =
    notice?.kind === 'forked'
      ? `Saved your changes as a new report, ${notice.name}, in My reports`
      : notice?.kind === 'deleted'
        ? `Deleted ${notice.report.name}`
        : loadStatus(ds, description);

  return (
    <div className={styles.page}>
      <div className={dq.heading}>
        <h1>Reports</h1>
        <p>
          Pick a template or build your own 2D and 3D charts. Every change draws at once and saves automatically. Press{' '}
          <kbd>/</kbd> to jump to the symbol.
        </p>
      </div>

      <p className="sr-only" role="status">
        {status}
      </p>

      <ApiAlert ds={ds} />

      <div className={dq.card}>
        <form className={dq.editor} onSubmit={ds.submit} aria-label="Report data">
          <Clause keyword="FROM">
            <SourceFields ds={ds} hint={false} />
          </Clause>
          <Clause keyword="WHERE">
            <ConditionsEditor where={active.where} onChange={(where) => reports.update((r) => ({ ...r, where }))} />
          </Clause>
        </form>
      </div>

      <div className={styles.workspace}>
        <ReportLibrary mine={reports.mine} activeId={active.id} onOpen={reports.open} onCreate={reports.create} />

        <section className={styles.canvas} aria-labelledby="report-name-label">
          <div className={styles.toolbar}>
            <label className={styles.nameField}>
              <span id="report-name-label" className="sr-only">
                Report name
              </span>
              <input
                className={styles.nameInput}
                value={active.name}
                onChange={(e) => reports.update((r) => ({ ...r, name: e.target.value }))}
                onBlur={(e) => !e.target.value.trim() && reports.update((r) => ({ ...r, name: 'Untitled report' }))}
                aria-describedby={active.template ? 'template-note' : undefined}
              />
            </label>
            {active.template && (
              <span id="template-note" className={styles.badge}>
                Template · edits save a copy
              </span>
            )}
            <div className={styles.toolbarActions} role="group" aria-label="Report actions">
              <button type="button" className={dq.linkButton} onClick={reports.duplicate}>
                Duplicate
              </button>
              {!active.template && (
                <button type="button" className={dq.linkButton} onClick={reports.remove}>
                  Delete
                </button>
              )}
              <span className={styles.toolbarDivider} aria-hidden="true" />
              <span className={styles.exportLabel} aria-hidden="true">
                Export
              </span>
              <button type="button" className={dq.linkButton} aria-label="Export image as PNG" disabled={!ds.series.data} onClick={() => chartRef.current?.download('png', fileBase)}>
                PNG
              </button>
              <button type="button" className={dq.linkButton} aria-label="Export image as SVG" disabled={!ds.series.data} onClick={() => chartRef.current?.download('svg', fileBase)}>
                SVG
              </button>
              <button
                type="button"
                className={dq.linkButton}
                aria-label="Export chart data as CSV"
                disabled={!ds.series.data}
                onClick={() => downloadText(tableToCsv(table), `${fileBase}.csv`, 'text/csv')}
              >
                CSV
              </button>
            </div>
          </div>

          {notice && (
            <div className={dq.notice} role="note">
              {notice.kind === 'forked' ? (
                <>
                  Your changes were saved as a new report, <strong>{notice.name}</strong>, in My reports. The template is unchanged.
                  <button type="button" className={dq.linkButton} onClick={() => reports.open(notice.templateId)}>
                    Back to template
                  </button>
                </>
              ) : (
                <>
                  Deleted <strong>{notice.report.name}</strong>.
                  <button type="button" className={dq.linkButton} onClick={reports.undoDelete}>
                    Undo
                  </button>
                </>
              )}
              <button type="button" className={dq.iconButton} aria-label="Dismiss" onClick={reports.dismissNotice}>
                ×
              </button>
            </div>
          )}

          <SeriesGate ds={ds}>
            {(data) => (
              <div className={dq.results} data-stale={ds.series.isFetching || ds.series.isPlaceholderData} aria-busy={ds.series.isFetching}>
                <GranularityNotice data={data} />
                {needsSeries ? (
                  <div className={dq.empty}>Pick at least one value to plot in the Data panel.</div>
                ) : !rows.length ? (
                  <div className={dq.empty}>
                    No bars match these conditions.{' '}
                    <button type="button" className={dq.linkButton} onClick={() => reports.update((r) => ({ ...r, where: [] }))}>
                      Clear conditions
                    </button>
                  </div>
                ) : (
                  <div className={styles.chartCard}>
                    <PlotlyChart ref={chartRef} shaped={shaped} report={active} colors={colors} label={description} />
                  </div>
                )}

                {rows.length > 0 && !needsSeries && (
                  <details className={styles.dataTable}>
                    <summary>
                      Data table ({table.rows.length.toLocaleString()} rows
                      {table.rows.length > TABLE_PREVIEW_ROWS && `, first ${TABLE_PREVIEW_ROWS} shown`})
                    </summary>
                    <div className={dq.tableWrap} tabIndex={0} role="region" aria-label={`${active.name} data (scrollable)`}>
                      <table className={dq.table}>
                        <caption className="sr-only">{description}</caption>
                        <thead>
                          <tr>
                            {table.columns.map((c) => (
                              <th key={c} scope="col">
                                <span className={styles.th}>{c}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.slice(0, TABLE_PREVIEW_ROWS).map((r, i) => (
                            <tr key={i}>
                              {r.map((v, j) => (
                                <td key={j} className={typeof v === 'number' ? dq.numeric : undefined}>
                                  {v === null ? '—' : typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 4 }) : v}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </div>
            )}
          </SeriesGate>
        </section>

        <aside className={styles.inspector} aria-label="Report settings">
          <div role="tablist" aria-label="Settings" className={styles.tabs} onKeyDown={onTabKey}>
            {TABS.map((t) => (
              <button
                key={t}
                id={`${tabIds}-${t}-tab`}
                type="button"
                role="tab"
                aria-selected={tab === t}
                aria-controls={`${tabIds}-${t}-panel`}
                tabIndex={tab === t ? 0 : -1}
                className={styles.tab}
                onClick={() => setTab(t)}
              >
                {t === 'data' ? 'Data' : 'Style'}
              </button>
            ))}
            <span
              className={styles.tabIndicator}
              style={{ width: `${100 / TABS.length}%`, transform: `translateX(${TABS.indexOf(tab) * 100}%)` }}
              aria-hidden="true"
            />
          </div>
          <div
            key={tab}
            id={`${tabIds}-${tab}-panel`}
            role="tabpanel"
            aria-labelledby={`${tabIds}-${tab}-tab`}
            className={arrived ? (arrived === 'right' ? styles.panelFromRight : styles.panelFromLeft) : undefined}
          >
            {tab === 'data' ? (
              <DataPanel
                report={active}
                onChange={reports.update}
                onChartChange={(chart) => reports.update((r) => switchChart(r, chart))}
                autoColors={paletteColors(active.style.palette, colors)}
              />
            ) : (
              <StylePanel report={active} onChange={reports.update} colors={colors} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

