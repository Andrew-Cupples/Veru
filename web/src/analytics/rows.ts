import type { AnalyticsEvent } from './tracker';

/*
 * Events as rows the report framework can chart. Time fields share their names with the market data
 * rows (time, date, clock, weekday, hour), so time axes, weekday order and heatmaps work the same way.
 * Times are the user's local time.
 */

export interface AnalyticsRow {
  time: string;
  date: string;
  clock: string;
  weekday: string;
  hour: number;
  seq: number;
  event: string;
  page: string;
  target: string;
  detail: string;
  subject: string;
  input: string;
  visit: string;
  /** Always 1, so "Sum" counts events. */
  count: number;
  duration: number | null;
  value: number | null;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const pad = (n: number) => String(n).padStart(2, '0');

// Events never change once recorded, so each one is converted once.
const cache = new WeakMap<AnalyticsEvent, AnalyticsRow>();

export function toAnalyticsRow(e: AnalyticsEvent): AnalyticsRow {
  const hit = cache.get(e);
  if (hit) return hit;
  const d = new Date(e.t);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const clock = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const row: AnalyticsRow = {
    time: `${date}T${clock}:${pad(d.getSeconds())}`,
    date,
    clock,
    weekday: WEEKDAYS[d.getDay()]!,
    hour: d.getHours(),
    seq: e.n,
    event: e.kind,
    page: e.page || '(none)',
    target: e.target || '(none)',
    detail: e.detail || '(none)',
    subject: e.subject || '(none)',
    input: e.input || '(none)',
    visit: `#${e.visit}`,
    count: 1,
    duration: e.duration,
    value: e.value,
  };
  cache.set(e, row);
  return row;
}

export const toAnalyticsRows = (events: readonly AnalyticsEvent[]): AnalyticsRow[] => events.map(toAnalyticsRow);

/** Nav label for a path, used as the event's page. */
export function pageLabel(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'Start';
  const first = pathname.split('/')[1] ?? '';
  const known: Record<string, string> = {
    reports: 'Reports',
    'raw-data': 'Export',
    compare: 'Compare',
    analytics: 'Analytics',
    ledger: 'Prompt ledger',
    personalize: 'Personalize',
  };
  return known[first] ?? pathname;
}
