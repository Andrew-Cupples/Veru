import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { track } from '../../analytics/tracker';
import { useCalmSwitch, useMotion } from '../../motion/MotionProvider';
import { downloadText } from '../../lib/download';
import type { Condition } from '../data-query/query';
import { DataPanel } from './DataPanel';
import { FIELD_BY_KEY, type ChartRow } from './fields';
import { paletteColors } from './figure';
import { CHART_BY_TYPE, switchChart, type Report } from './model';
import { PlotlyChart, type ChartHandle } from './PlotlyChart';
import { ReportLibrary } from './ReportLibrary';
import { pointCount, shape } from './shape';
import { StylePanel } from './StylePanel';
import { tableToCsv, toTable } from './table';
import type { ReportsState } from './useReports';
import { useThemeColors } from './themeColors';
import { CompareView, type CompareItem } from './CompareView';
import { usePins } from './pins';
import { thumbnailOf, type Thumb } from './thumbGeometry';
import styles from './Reports.module.css';
import dq from '../data-query/DataQuery.module.css';

const TABLE_PREVIEW_ROWS = 500;
const TABS = ['data', 'style'] as const;
type Tab = (typeof TABS)[number];

/** One sentence describing the chart, for its accessible name and the status line. */
export function describe(report: Report, points: number, subject: string): string {
  const def = CHART_BY_TYPE[report.chart];
  const { enc } = report;
  const label = (k: keyof typeof FIELD_BY_KEY) => FIELD_BY_KEY[k].label.toLowerCase();
  let what: string;
  if (def.slots.series) what = `${enc.series.map((s) => label(s.field)).join(', ') || 'nothing'}${def.slots.x ? ` by ${label(enc.x)}` : ''}`;
  else if (def.slots.z) what = `${label(enc.z)} over ${label(enc.x)} and ${label(enc.y)}`;
  else if (report.chart === 'histogram') what = `distribution of ${label(enc.x)}`;
  else what = `open, high, low, close by ${label(enc.x)}`;
  const split = enc.color ? `, coloured by ${label(enc.color)}` : '';
  return `${def.label} chart of ${subject} ${what}${split}. ${points.toLocaleString()} values.`;
}

interface Props {
  reports: ReportsState;
  /** Chart-ready rows for a report's WHERE conditions. Memoise it: a new function redraws every thumbnail. */
  rowsFor: (where: readonly Condition[]) => ChartRow[];
  /** Whether there is any data at all (thumbnails and exports wait for it). */
  hasData: boolean;
  /** Names the data in descriptions and file names: the symbol, or "app usage". */
  subject: string;
  /** What one row is, for empty states: "bars", "events". */
  noun: string;
  /** Wraps the chart area with the page's loading, error and empty states. */
  gate: (content: () => ReactNode, mode: 'editor' | 'compare') => ReactNode;
  /** The page's polite status line, given what the chart area would say. */
  status: (text: string) => string;
}

/**
 * The report framework: a library of templates and saved reports, the chart canvas with export, the
 * Data / Style inspector, and the compare view. Pages supply the rows and their own FROM / WHERE card.
 */
export function ReportWorkspace({ reports, rowsFor, hasData, subject, noun, gate, status: statusFor }: Props) {
  const { active, templates } = reports;
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

  // Opening a report drifts the canvas in from the side of the library it came from: further down the list
  // arrives from below, further up from above. Only opening counts, not an edit that saves a template as a copy.
  const canvasRef = useRef<HTMLElement>(null);
  const pendingDrift = useRef<1 | -1 | null>(null);
  const calmOpen = useCalmSwitch();
  const { duration } = useMotion();
  const openReport = (id: string) => {
    if (id === active.id && !reports.comparing) return;
    const order = [...reports.mine.map((r) => r.id), ...templates.map((t) => t.id)];
    // Leaving the compare view mounts a fresh canvas; no drift needed for that.
    pendingDrift.current = !reports.comparing && calmOpen() ? (order.indexOf(id) > order.indexOf(active.id) ? 1 : -1) : null;
    reports.open(id);
  };

  const { pins, toggle } = usePins(reports.pinsKey);
  const togglePin = (id: string) => {
    const r = reports.mine.find((m) => m.id === id) ?? reports.templateById.get(id);
    track('report', { target: pins.includes(id) ? 'remove from compare' : 'add to compare', detail: r ? CHART_BY_TYPE[r.chart].label : '', subject: r?.name ?? '' });
    toggle(id);
  };
  const pinned = useMemo(
    () =>
      pins
        .map((id) => reports.mine.find((r) => r.id === id) ?? reports.templateById.get(id))
        .filter((r): r is Report => r !== undefined),
    [pins, reports.mine, reports.templateById],
  );

  // Library thumbnails: each report's chart in miniature, on the current data. Templates only redraw when
  // the data changes; your own reports also when you edit them.
  const templateThumbs = useMemo(() => thumbsFor(templates, hasData, rowsFor), [templates, hasData, rowsFor]);
  const mineThumbs = useMemo(() => thumbsFor(reports.mine, hasData, rowsFor), [reports.mine, hasData, rowsFor]);
  const thumbFor = (r: Report) => (r.template ? templateThumbs : mineThumbs).get(r.id) ?? null;

  const compareItems = useMemo<CompareItem[]>(
    () =>
      pinned.map((r) => {
        const reportRows = rowsFor(r.where);
        const needs = !!CHART_BY_TYPE[r.chart].slots.series && !r.enc.series.length;
        if (needs) return { report: r, shaped: null, label: r.name, message: 'Nothing to plot yet. Open it to pick values.' };
        if (!reportRows.length) return { report: r, shaped: null, label: r.name, message: `No ${noun} match this report's conditions.` };
        const s = shape(reportRows, r);
        return { report: r, shaped: s, label: describe(r, pointCount(s), subject) };
      }),
    [pinned, rowsFor, subject, noun],
  );
  useLayoutEffect(() => {
    const dir = pendingDrift.current;
    pendingDrift.current = null;
    const el = canvasRef.current;
    if (!dir || !el || typeof el.animate !== 'function') return;
    el.animate([{ opacity: 0, transform: `translateY(${dir * 24}px)` }, { opacity: 1, transform: 'none' }], {
      duration,
      easing: 'cubic-bezier(0.05, 0.7, 0.1, 1)', // --motion-ease-in
    });
  }, [active.id, duration]);

  const rows = useMemo(() => rowsFor(active.where), [rowsFor, active.where]);
  const shaped = useMemo(() => shape(rows, active), [rows, active]);
  const table = useMemo(() => toTable(shaped, active), [shaped, active]);
  const points = pointCount(shaped);
  const description = describe(active, points, subject);
  const fileBase = `${subject}_${active.name}`.replace(/[^\w.-]+/g, '_');
  const needsSeries = !!CHART_BY_TYPE[active.chart].slots.series && !active.enc.series.length;
  const chartLabel = CHART_BY_TYPE[active.chart].label;

  const exportAs = (format: 'PNG' | 'SVG' | 'CSV') => {
    track('export', { target: format, detail: chartLabel, subject: active.name, value: format === 'CSV' ? table.rows.length : null });
    if (format === 'CSV') downloadText(tableToCsv(table), `${fileBase}.csv`, 'text/csv');
    else chartRef.current?.download(format === 'PNG' ? 'png' : 'svg', fileBase);
  };

  const changeChart = (chart: Report['chart']) => {
    track('report', { target: 'chart type', detail: CHART_BY_TYPE[chart].label, subject: active.name });
    reports.update((r) => switchChart(r, chart));
  };

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
        : statusFor(reports.comparing ? `Comparing ${pinned.length} reports` : description);

  return (
    <>
      <p className="sr-only" role="status">
        {status}
      </p>

      <div className={reports.comparing ? `${styles.workspace} ${styles.workspaceCompare}` : styles.workspace}>
        <ReportLibrary
          mine={reports.mine}
          templates={templates}
          activeId={active.id}
          onOpen={openReport}
          onCreate={reports.create}
          thumbFor={thumbFor}
          pins={pins}
          onTogglePin={togglePin}
          comparing={reports.comparing}
          onCompare={reports.setComparing}
        />

        {reports.comparing ? (
          gate(
            () =>
              compareItems.length && colors ? (
                <CompareView items={compareItems} colors={colors} onOpen={openReport} onUnpin={togglePin} />
              ) : (
                <div className={dq.empty}>
                  Nothing to compare yet. Add reports with the + button in the list.{' '}
                  <button type="button" className={dq.linkButton} onClick={() => reports.setComparing(false)}>
                    Back to editor
                  </button>
                </div>
              ),
            'compare',
          )
        ) : (
          <>
            <section ref={canvasRef} className={styles.canvas} aria-labelledby="report-name-label">
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
                  <button type="button" className={dq.linkButton} aria-label="Export image as PNG" disabled={!hasData} onClick={() => exportAs('PNG')}>
                    PNG
                  </button>
                  <button type="button" className={dq.linkButton} aria-label="Export image as SVG" disabled={!hasData} onClick={() => exportAs('SVG')}>
                    SVG
                  </button>
                  <button type="button" className={dq.linkButton} aria-label="Export chart data as CSV" disabled={!hasData} onClick={() => exportAs('CSV')}>
                    CSV
                  </button>
                </div>
              </div>

              {notice && (
                <div className={dq.notice} role="note">
                  {notice.kind === 'forked' ? (
                    <>
                      Your changes were saved as a new report, <strong>{notice.name}</strong>, in My reports. The template is unchanged.
                      <button type="button" className={dq.linkButton} onClick={() => openReport(notice.templateId)}>
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

              {gate(
                () => (
                  <>
                    {needsSeries ? (
                      <div className={dq.empty}>Pick at least one value to plot in the Data panel.</div>
                    ) : !rows.length ? (
                      <div className={dq.empty}>
                        No {noun} match these conditions.{' '}
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
                  </>
                ),
                'editor',
              )}
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
                  <DataPanel report={active} onChange={reports.update} onChartChange={changeChart} autoColors={paletteColors(active.style.palette, colors)} />
                ) : (
                  <StylePanel report={active} onChange={reports.update} colors={colors} />
                )}
              </div>
            </aside>
          </>
        )}
      </div>
    </>
  );
}

/** Thumbnails for a set of reports on the given data; a report that can't be drawn keeps its chart-type icon. */
function thumbsFor(list: readonly Report[], hasData: boolean, rowsFor: Props['rowsFor']): Map<string, Thumb | null> {
  const thumbs = new Map<string, Thumb | null>();
  if (!hasData) return thumbs;
  for (const r of list) {
    try {
      thumbs.set(r.id, thumbnailOf(shape(rowsFor(r.where), r)));
    } catch {
      thumbs.set(r.id, null);
    }
  }
  return thumbs;
}
