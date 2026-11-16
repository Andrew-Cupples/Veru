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
import { formatNumber, messages, useT } from '../../i18n/I18nProvider';
import { en } from '../../i18n/catalogs/en';
import styles from './Reports.module.css';
import dq from '../data-query/DataQuery.module.css';

const TABLE_PREVIEW_ROWS = 500;
const TABS = ['data', 'style'] as const;
type Tab = (typeof TABS)[number];

/** One sentence describing the chart, for its accessible name and the status line. */
export function describe(report: Report, points: number, subject: string): string {
  const t = messages().describe;
  const def = CHART_BY_TYPE[report.chart];
  const { enc } = report;
  const label = (k: keyof typeof FIELD_BY_KEY) => FIELD_BY_KEY[k].label.toLowerCase();
  let what: string;
  if (def.slots.series) what = t.series(enc.series.map((s) => label(s.field)), def.slots.x ? label(enc.x) : null);
  else if (def.slots.z) what = t.surface(label(enc.z), label(enc.x), label(enc.y));
  else if (report.chart === 'histogram') what = t.distribution(label(enc.x));
  else what = t.ohlc(label(enc.x));
  return t.sentence(def.label, subject, what, enc.color ? label(enc.color) : null, points);
}

/** Analytics records chart types by their English name, so usage reads the same in every language. */
const trackedChart = (chart: Report['chart']) => en.charts[chart].label;

interface Props {
  reports: ReportsState;
  /** Chart-ready rows for a report's WHERE conditions. Memoise it: a new function redraws every thumbnail. */
  rowsFor: (where: readonly Condition[]) => ChartRow[];
  /** Whether there is any data at all (thumbnails and exports wait for it). */
  hasData: boolean;
  /** Names the data in descriptions and file names: the symbol, or "app usage". */
  subject: string;
  /** What one row is, for empty states. */
  noun: 'bars' | 'events';
  /** Wraps the chart area with the page's loading, error and empty states. */
  gate: (content: () => ReactNode, mode: 'editor' | 'compare') => ReactNode;
  /** The page's polite status line, given what the chart area would say. */
  status: (text: string) => string;
  /**
   * Compare pinned reports side by side on this page's data (Analytics). Off on Reports, which has its own
   * Compare page for comparing stocks.
   */
  compare?: boolean;
  /** Shows a "Compare stocks" action in the toolbar that hands the open report to the Compare page. */
  onCompareStocks?: (report: Report) => void;
}

/**
 * The report framework: a library of templates and saved reports, the chart canvas with export, the
 * Data / Style inspector, and the compare view. Pages supply the rows and their own FROM / WHERE card.
 */
export function ReportWorkspace({ reports, rowsFor, hasData, subject, noun, gate, status: statusFor, compare = true, onCompareStocks }: Props) {
  const t = useT();
  const { active, templates } = reports;
  const comparing = compare && reports.comparing;
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
    if (id === active.id && !comparing) return;
    const order = [...reports.mine.map((r) => r.id), ...templates.map((t) => t.id)];
    // Leaving the compare view mounts a fresh canvas; no drift needed for that.
    pendingDrift.current = !comparing && calmOpen() ? (order.indexOf(id) > order.indexOf(active.id) ? 1 : -1) : null;
    reports.open(id);
  };

  const { pins, toggle } = usePins(reports.pinsKey);
  const togglePin = (id: string) => {
    const r = reports.mine.find((m) => m.id === id) ?? reports.templateById.get(id);
    track('report', { target: pins.includes(id) ? 'remove from compare' : 'add to compare', detail: r ? trackedChart(r.chart) : '', subject: r?.name ?? '' });
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
        const base = { key: r.id, report: r, symbol: null, label: r.name };
        const needs = !!CHART_BY_TYPE[r.chart].slots.series && !r.enc.series.length;
        if (needs) return { ...base, shaped: null, message: t.compare.nothingToPlot };
        const reportRows = rowsFor(r.where);
        if (!reportRows.length) return { ...base, shaped: null, message: t.reports.noRowsForReport(noun) };
        const sh = shape(reportRows, r);
        return { ...base, shaped: sh, label: describe(r, pointCount(sh), subject) };
      }),
    [pinned, rowsFor, subject, noun, t],
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
  const chartLabel = trackedChart(active.chart);

  const exportAs = (format: 'PNG' | 'SVG' | 'CSV') => {
    track('export', { target: format, detail: chartLabel, subject: active.name, value: format === 'CSV' ? table.rows.length : null });
    if (format === 'CSV') downloadText(tableToCsv(table), `${fileBase}.csv`, 'text/csv');
    else chartRef.current?.download(format === 'PNG' ? 'png' : 'svg', fileBase);
  };

  const changeChart = (chart: Report['chart']) => {
    track('report', { target: 'chart type', detail: trackedChart(chart), subject: active.name });
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
      ? t.reports.forkedStatus(notice.name)
      : notice?.kind === 'deleted'
        ? t.reports.deletedStatus(notice.report.name)
        : statusFor(comparing ? t.reports.comparing(pinned.length) : description);

  return (
    <>
      <p className="sr-only" role="status">
        {status}
      </p>

      <div className={comparing ? `${styles.workspace} ${styles.workspaceCompare}` : styles.workspace}>
        <ReportLibrary
          mine={reports.mine}
          templates={templates}
          activeId={active.id}
          onOpen={openReport}
          onCreate={reports.create}
          thumbFor={thumbFor}
          compare={compare ? { pins, onTogglePin: togglePin, comparing, onCompare: reports.setComparing } : undefined}
        />

        {comparing ? (
          gate(
            () =>
              compareItems.length && colors ? (
                <CompareView
                  items={compareItems}
                  colors={colors}
                  heading={t.reports.comparing(pinned.length)}
                  onOpen={(item) => openReport(item.report.id)}
                  onRemoveReport={togglePin}
                />
              ) : (
                <div className={dq.empty}>
                  {t.reports.nothingToCompare}{' '}
                  <button type="button" className={dq.linkButton} onClick={() => reports.setComparing(false)}>
                    {t.reports.backToEditor}
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
                    {t.reports.reportName}
                  </span>
                  <input
                    className={styles.nameInput}
                    value={active.name}
                    onChange={(e) => reports.update((r) => ({ ...r, name: e.target.value }))}
                    onBlur={(e) => !e.target.value.trim() && reports.update((r) => ({ ...r, name: t.reports.untitled }))}
                    aria-describedby={active.template ? 'template-note' : undefined}
                  />
                </label>
                {active.template && (
                  <span id="template-note" className={styles.badge}>
                    {t.reports.templateNote}
                  </span>
                )}
                <div className={styles.toolbarActions} role="group" aria-label={t.reports.actions}>
                  {onCompareStocks && (
                    <button type="button" className={dq.linkButton} onClick={() => onCompareStocks(active)}>
                      {t.reports.compareStocks}
                    </button>
                  )}
                  <button type="button" className={dq.linkButton} onClick={reports.duplicate}>
                    {t.common.duplicate}
                  </button>
                  {!active.template && (
                    <button type="button" className={dq.linkButton} onClick={reports.remove}>
                      {t.common.delete}
                    </button>
                  )}
                  <span className={styles.toolbarDivider} aria-hidden="true" />
                  <span className={styles.exportLabel} aria-hidden="true">
                    {t.common.export}
                  </span>
                  <button type="button" className={dq.linkButton} aria-label={t.reports.exportImage('PNG')} disabled={!hasData} onClick={() => exportAs('PNG')}>
                    PNG
                  </button>
                  <button type="button" className={dq.linkButton} aria-label={t.reports.exportImage('SVG')} disabled={!hasData} onClick={() => exportAs('SVG')}>
                    SVG
                  </button>
                  <button type="button" className={dq.linkButton} aria-label={t.reports.exportCsv} disabled={!hasData} onClick={() => exportAs('CSV')}>
                    CSV
                  </button>
                </div>
              </div>

              {notice && (
                <div className={dq.notice} role="note">
                  {notice.kind === 'forked' ? (
                    <>
                      {t.reports.forked(<strong>{notice.name}</strong>)}
                      <button type="button" className={dq.linkButton} onClick={() => openReport(notice.templateId)}>
                        {t.reports.backToTemplate}
                      </button>
                    </>
                  ) : (
                    <>
                      {t.reports.deleted(<strong>{notice.report.name}</strong>)}
                      <button type="button" className={dq.linkButton} onClick={reports.undoDelete}>
                        {t.reports.undo}
                      </button>
                    </>
                  )}
                  <button type="button" className={dq.iconButton} aria-label={t.reports.dismiss} onClick={reports.dismissNotice}>
                    ×
                  </button>
                </div>
              )}

              {gate(
                () => (
                  <>
                    {needsSeries ? (
                      <div className={dq.empty}>{t.reports.pickValue}</div>
                    ) : !rows.length ? (
                      <div className={dq.empty}>
                        {t.reports.noRows(noun)}{' '}
                        <button type="button" className={dq.linkButton} onClick={() => reports.update((r) => ({ ...r, where: [] }))}>
                          {t.raw.clearConditions}
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
                          {t.reports.dataTable(table.rows.length, table.rows.length > TABLE_PREVIEW_ROWS ? TABLE_PREVIEW_ROWS : null)}
                        </summary>
                        <div className={dq.tableWrap} tabIndex={0} role="region" aria-label={t.raw.scrollable(t.reports.dataOf(active.name))}>
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
                                      {v === null ? '—' : typeof v === 'number' ? formatNumber(v, { maximumFractionDigits: 4 }) : v}
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

            <aside className={styles.inspector} aria-label={t.reports.settings}>
              <div role="tablist" aria-label={t.reports.settingsTabs} className={styles.tabs} onKeyDown={onTabKey}>
                {TABS.map((key) => (
                  <button
                    key={key}
                    id={`${tabIds}-${key}-tab`}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    aria-controls={`${tabIds}-${key}-panel`}
                    tabIndex={tab === key ? 0 : -1}
                    className={styles.tab}
                    data-track={key === 'data' ? 'Data' : 'Style'}
                    onClick={() => setTab(key)}
                  >
                    {key === 'data' ? t.reports.dataTab : t.reports.styleTab}
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
