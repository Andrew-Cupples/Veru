import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';
import { useDocumentTitle } from '../../a11y/useDocumentTitle';
import { toAnalyticsRows, type AnalyticsRow } from '../../analytics/rows';
import { clearEvents, getEvents, isPaused, setPaused, subscribe, track } from '../../analytics/tracker';
import { downloadText } from '../../lib/download';
import { Clause } from '../data-query/SourceControls';
import { ExpressionEditor } from '../data-query/ExpressionEditor';
import { ANALYTICS_COLUMNS, filterRows } from '../data-query/query';
import { Segmented } from '../reports/controls';
import { ReportWorkspace } from '../reports/ReportWorkspace';
import { tableToCsv } from '../reports/table';
import { useReports, type ReportConfig } from '../reports/useReports';
import { ANALYTICS_TEMPLATES } from './templates';
import { SuggestionBox } from './SuggestionBox';
import styles from './Analytics.module.css';
import rs from '../reports/Reports.module.css';
import dq from '../data-query/DataQuery.module.css';
import { formatNumber, useT } from '../../i18n/I18nProvider';

const CONFIG: ReportConfig = {
  dataset: 'analytics',
  templates: ANALYTICS_TEMPLATES,
  keys: { reports: 'veru.analytics.reports', active: 'veru.analytics.active' },
};

const HOUR = 3_600_000;
const WINDOWS = [
  { value: '1h', ms: HOUR },
  { value: '24h', ms: 24 * HOUR },
  { value: '7d', ms: 7 * 24 * HOUR },
  { value: '30d', ms: 30 * 24 * HOUR },
  { value: 'all', ms: Infinity },
] as const;
type WindowId = (typeof WINDOWS)[number]['value'];
const isWindow = (v: string | null): v is WindowId => WINDOWS.some((w) => w.value === v);

/** New events reach this page at most this often, so charts aren't redrawn on every click. */
const REFRESH_MS = 2_000;

function useEvents() {
  const subscribeThrottled = useCallback((onChange: () => void) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribe(() => {
      timer ??= setTimeout(() => {
        timer = null;
        onChange();
      }, REFRESH_MS);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);
  return useSyncExternalStore(subscribeThrottled, getEvents);
}

/** Ticks every 30 seconds, so a "last hour" window keeps moving without new events. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const EXPORT_COLUMNS: readonly (keyof AnalyticsRow)[] = [
  'seq', 'time', 'event', 'page', 'target', 'detail', 'subject', 'input', 'visit', 'duration', 'value',
];

export function AnalyticsPage() {
  const events = useEvents();
  const paused = useSyncExternalStore(subscribe, isPaused);
  const reports = useReports(CONFIG);
  const { active } = reports;
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const windowId: WindowId = isWindow(params.get('since')) ? (params.get('since') as WindowId) : '7d';
  const setWindow = (id: WindowId) =>
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (id === '7d') p.delete('since');
      else p.set('since', id);
      return p;
    });

  const t = useT();
  useDocumentTitle(`${active.name} · ${t.nav.analytics}`);

  const allRows = useMemo(() => toAnalyticsRows(events), [events]);
  const windowRows = useMemo(() => {
    const span = WINDOWS.find((w) => w.value === windowId)!.ms;
    if (!Number.isFinite(span)) return allRows;
    const since = now - span;
    // Events are in time order: find the first one inside the window.
    let i = 0;
    while (i < events.length && events[i]!.t < since) i++;
    return allRows.slice(i);
  }, [allRows, events, windowId, now]);
  const rowsFor = useCallback((where: string) => filterRows(windowRows, where, ANALYTICS_COLUMNS), [windowRows]);

  const exportEvents = (format: 'CSV' | 'JSON') => {
    track('export', { target: format, detail: 'events', subject: 'Analytics', value: windowRows.length });
    const name = `veru-analytics_${windowId}`;
    if (format === 'JSON') {
      downloadText(JSON.stringify(windowRows.map((r) => Object.fromEntries(EXPORT_COLUMNS.map((c) => [c, r[c]]))), null, 2), `${name}.json`, 'application/json');
    } else {
      downloadText(tableToCsv({ columns: [...EXPORT_COLUMNS], rows: windowRows.map((r) => EXPORT_COLUMNS.map((c) => r[c])) }), `${name}.csv`, 'text/csv');
    }
  };

  return (
    <div className={rs.page}>
      <div className={dq.heading}>
        <h1>{t.nav.analytics}</h1>
      </div>

      <div className={dq.card}>
        <div className={dq.editor} role="group" aria-label={t.analytics.data}>
          <Clause keyword={t.query.from}>
            <div className={styles.fromRow}>
              <Segmented label={t.analytics.window} value={windowId} options={WINDOWS.map((w) => ({ value: w.value, label: t.analytics.windows[w.value] }))} onChange={setWindow} />
              <p className={styles.fromSummary}>
                {t.analytics.ofEvents(windowRows.length, events.length)}
              </p>
            </div>
          </Clause>
          <Clause keyword={t.query.where}>
            <ExpressionEditor
              where={active.where}
              onChange={(where) => reports.update((r) => ({ ...r, where }))}
              columns={ANALYTICS_COLUMNS}
              example="event = click AND NOT page = Start"
            />
          </Clause>
        </div>
        <TrackingBar paused={paused} count={events.length} onExport={exportEvents} hasEvents={windowRows.length > 0} />
      </div>

      <Kpis rows={windowRows} />

      <ReportWorkspace
        reports={reports}
        rowsFor={rowsFor}
        hasData={windowRows.length > 0}
        subject={t.analytics.subject}
        noun="events"
        status={(text) => text}
        gate={(content) =>
          windowRows.length ? (
            content()
          ) : (
            <div className={dq.empty}>
              {events.length
                ? t.analytics.emptyWindow
                : paused
                  ? t.analytics.emptyPaused
                  : t.analytics.empty}
            </div>
          )
        }
      />

      <SuggestionBox />
    </div>
  );
}

function TrackingBar({
  paused,
  count,
  hasEvents,
  onExport,
}: {
  paused: boolean;
  count: number;
  hasEvents: boolean;
  onExport: (format: 'CSV' | 'JSON') => void;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  const clear = () => {
    clearEvents();
    setConfirming(false);
    setCleared(true);
    clearRef.current?.focus();
  };

  return (
    <div className={styles.trackingBar}>
      <span className={styles.recording} data-paused={paused || undefined}>
        <span className={styles.dot} aria-hidden="true" />
        {paused ? t.analytics.paused : t.analytics.recording}
      </span>
      <button type="button" className={dq.linkButton} aria-pressed={paused} onClick={() => setPaused(!paused)}>
        {paused ? t.analytics.resume : t.analytics.pause}
      </button>
      <span className={rs.toolbarDivider} aria-hidden="true" />
      <span className={rs.exportLabel} aria-hidden="true">
        {t.analytics.exportEvents}
      </span>
      <button type="button" className={dq.linkButton} aria-label={t.analytics.exportAs('CSV')} disabled={!hasEvents} onClick={() => onExport('CSV')}>
        CSV
      </button>
      <button type="button" className={dq.linkButton} aria-label={t.analytics.exportAs('JSON')} disabled={!hasEvents} onClick={() => onExport('JSON')}>
        JSON
      </button>
      <span className={rs.toolbarDivider} aria-hidden="true" />
      {confirming ? (
        <span className={styles.confirm} role="group" aria-label={t.analytics.confirmClear}>
          <span>{t.analytics.deleteAll(count)}</span>
          <button type="button" className={styles.dangerButton} onClick={clear}>
            {t.analytics.deleteEvents}
          </button>
          <button ref={cancelRef} type="button" className={dq.linkButton} onClick={() => setConfirming(false)}>
            {t.common.cancel}
          </button>
        </span>
      ) : (
        <button ref={clearRef} type="button" className={dq.linkButton} disabled={!count} onClick={() => setConfirming(true)}>
          {t.analytics.clearData}
        </button>
      )}
      <span className="sr-only" role="status">
        {cleared && !count ? t.analytics.cleared : ''}
      </span>
    </div>
  );
}

/** Headline numbers for the window, before any report's own conditions. */
function Kpis({ rows }: { rows: readonly AnalyticsRow[] }) {
  const k = useMemo(() => {
    let clicks = 0, keyboard = 0, opened = 0, exports = 0, pageSeconds = 0, views = 0;
    const visits = new Set<string>();
    for (const r of rows) {
      visits.add(r.visit);
      switch (r.event) {
        case 'click':
          clicks++;
          if (r.input === 'keyboard') keyboard++;
          break;
        case 'report':
          if (r.target === 'open') opened++;
          break;
        case 'export':
          exports++;
          break;
        case 'page_view':
          views++;
          pageSeconds += r.duration ?? 0;
          break;
      }
    }
    return { visits: visits.size, clicks, keyboard, opened, exports, pageSeconds, views };
  }, [rows]);

  const t = useT();
  // Hours, minutes or seconds in the language's own short units ("1.5 h", "1,5 h", "12 min").
  const unit = (value: number, u: 'hour' | 'minute' | 'second', digits = 0) =>
    formatNumber(value, { style: 'unit', unit: u, unitDisplay: 'short', maximumFractionDigits: digits });
  const time = (s: number) => (s >= 3600 ? unit(s / 3600, 'hour', 1) : s >= 60 ? unit(Math.round(s / 60), 'minute') : unit(Math.round(s), 'second'));
  const items = [
    { label: t.analytics.visits, value: formatNumber(k.visits) },
    { label: t.analytics.clicks, value: formatNumber(k.clicks), note: k.clicks ? t.analytics.byKeyboard(k.keyboard / k.clicks) : undefined },
    { label: t.analytics.reportsOpened, value: formatNumber(k.opened) },
    { label: t.analytics.exports, value: formatNumber(k.exports) },
    { label: t.analytics.timeInApp, value: time(k.pageSeconds), note: k.views ? t.analytics.pageViews(k.views) : undefined },
  ];

  return (
    <dl className={styles.kpis} aria-label={t.analytics.summary}>
      {items.map((i) => (
        <div key={i.label} className={styles.kpi}>
          <dt>{i.label}</dt>
          <dd>
            <span className={styles.kpiValue}>{i.value}</span>
            {i.note && <span className={styles.kpiNote}>{i.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
