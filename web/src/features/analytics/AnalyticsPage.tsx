import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';
import { useDocumentTitle } from '../../a11y/useDocumentTitle';
import { toAnalyticsRows, type AnalyticsRow } from '../../analytics/rows';
import { clearEvents, getEvents, isPaused, setPaused, subscribe, track } from '../../analytics/tracker';
import { downloadText } from '../../lib/download';
import { Clause, ConditionsEditor } from '../data-query/SourceControls';
import { ANALYTICS_COLUMNS, filterRows, type Condition } from '../data-query/query';
import { Segmented } from '../reports/controls';
import { ReportWorkspace } from '../reports/ReportWorkspace';
import { tableToCsv } from '../reports/table';
import { useReports, type ReportConfig } from '../reports/useReports';
import { ANALYTICS_TEMPLATES } from './templates';
import styles from './Analytics.module.css';
import rs from '../reports/Reports.module.css';
import dq from '../data-query/DataQuery.module.css';

const CONFIG: ReportConfig = {
  dataset: 'analytics',
  templates: ANALYTICS_TEMPLATES,
  keys: { reports: 'veru.analytics.reports', active: 'veru.analytics.active', pins: 'veru.analytics.pinned' },
};

const HOUR = 3_600_000;
const WINDOWS = [
  { value: '1h', label: 'Hour', ms: HOUR },
  { value: '24h', label: '24 hours', ms: 24 * HOUR },
  { value: '7d', label: '7 days', ms: 7 * 24 * HOUR },
  { value: '30d', label: '30 days', ms: 30 * 24 * HOUR },
  { value: 'all', label: 'All time', ms: Infinity },
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

  useDocumentTitle(`${reports.comparing ? 'Compare' : active.name} · Analytics`);

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
  const rowsFor = useCallback((where: readonly Condition[]) => filterRows(windowRows, where), [windowRows]);

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
        <h1>Analytics</h1>
      </div>

      <div className={dq.card}>
        <div className={dq.editor} role="group" aria-label="Analytics data">
          <Clause keyword="FROM">
            <div className={styles.fromRow}>
              <Segmented label="Events in the last" value={windowId} options={WINDOWS} onChange={setWindow} />
              <p className={styles.fromSummary}>
                <strong>{windowRows.length.toLocaleString()}</strong> of {events.length.toLocaleString()} events
              </p>
            </div>
          </Clause>
          {!reports.comparing && (
            <Clause keyword="WHERE">
              <ConditionsEditor
                where={active.where}
                onChange={(where) => reports.update((r) => ({ ...r, where }))}
                columns={ANALYTICS_COLUMNS}
                defaultColumn="event"
              />
            </Clause>
          )}
        </div>
        <TrackingBar paused={paused} count={events.length} onExport={exportEvents} hasEvents={windowRows.length > 0} />
      </div>

      <Kpis rows={windowRows} />

      <ReportWorkspace
        reports={reports}
        rowsFor={rowsFor}
        hasData={windowRows.length > 0}
        subject="app usage"
        noun="events"
        status={(text) => text}
        gate={(content) =>
          windowRows.length ? (
            content()
          ) : (
            <div className={dq.empty}>
              {events.length
                ? 'No events in this time window yet. Pick a longer one above.'
                : paused
                  ? 'Tracking is paused, so nothing has been recorded. Resume it above to start.'
                  : 'Nothing recorded yet. Use the app and events will appear here within a couple of seconds.'}
            </div>
          )
        }
      />
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
        {paused ? 'Tracking paused' : 'Recording'}
      </span>
      <button type="button" className={dq.linkButton} aria-pressed={paused} onClick={() => setPaused(!paused)}>
        {paused ? 'Resume tracking' : 'Pause tracking'}
      </button>
      <span className={rs.toolbarDivider} aria-hidden="true" />
      <span className={rs.exportLabel} aria-hidden="true">
        Export events
      </span>
      <button type="button" className={dq.linkButton} aria-label="Export events in this window as CSV" disabled={!hasEvents} onClick={() => onExport('CSV')}>
        CSV
      </button>
      <button type="button" className={dq.linkButton} aria-label="Export events in this window as JSON" disabled={!hasEvents} onClick={() => onExport('JSON')}>
        JSON
      </button>
      <span className={rs.toolbarDivider} aria-hidden="true" />
      {confirming ? (
        <span className={styles.confirm} role="group" aria-label="Confirm clearing data">
          <span>Delete all {count.toLocaleString()} events? This can't be undone.</span>
          <button type="button" className={styles.dangerButton} onClick={clear}>
            Delete events
          </button>
          <button ref={cancelRef} type="button" className={dq.linkButton} onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <button ref={clearRef} type="button" className={dq.linkButton} disabled={!count} onClick={() => setConfirming(true)}>
          Clear data…
        </button>
      )}
      <span className="sr-only" role="status">
        {cleared && !count ? 'All analytics events deleted' : ''}
      </span>
    </div>
  );
}

/** Headline numbers for the window, before any report's own conditions. */
function Kpis({ rows }: { rows: readonly AnalyticsRow[] }) {
  const k = useMemo(() => {
    let clicks = 0, keyboard = 0, opened = 0, exports = 0, errors = 0, apiCalls = 0, apiSeconds = 0, pageSeconds = 0, views = 0;
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
        case 'error':
          errors++;
          break;
        case 'api':
          apiCalls++;
          apiSeconds += r.duration ?? 0;
          break;
        case 'page_view':
          views++;
          pageSeconds += r.duration ?? 0;
          break;
      }
    }
    return { visits: visits.size, clicks, keyboard, opened, exports, errors, apiCalls, apiSeconds, pageSeconds, views };
  }, [rows]);

  const ms = (s: number) => `${Math.round(s * 1000).toLocaleString()} ms`;
  const time = (s: number) => (s >= 3600 ? `${(s / 3600).toFixed(1)} h` : s >= 60 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);
  const items = [
    { label: 'Visits', value: k.visits.toLocaleString() },
    { label: 'Clicks', value: k.clicks.toLocaleString(), note: k.clicks ? `${Math.round((k.keyboard / k.clicks) * 100)}% by keyboard` : undefined },
    { label: 'Reports opened', value: k.opened.toLocaleString() },
    { label: 'Exports', value: k.exports.toLocaleString() },
    { label: 'Time in app', value: time(k.pageSeconds), note: k.views ? `${k.views.toLocaleString()} page views` : undefined },
    { label: 'API latency', value: k.apiCalls ? ms(k.apiSeconds / k.apiCalls) : '—', note: k.apiCalls ? `average of ${k.apiCalls.toLocaleString()} calls` : undefined },
    { label: 'Errors', value: k.errors.toLocaleString() },
  ];

  return (
    <dl className={styles.kpis} aria-label="Summary for this time window">
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
