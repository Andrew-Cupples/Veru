import type { AnalyticsRow } from '../../analytics/rows';
import type { Row } from '../data-query/query';

/*
 * The fields a report can plot: the raw bar columns plus a few measures derived from them.
 * Derived values are computed after WHERE, so "return" is measured from the first bar that is shown.
 */

export interface ReportRow extends Row {
  /** Position of the bar in the filtered data, from 0. */
  bar: number;
  weekday: string;
  hour: number;
  change: number;
  changePct: number;
  spread: number;
  spreadPct: number;
  return: number;
}

/** Which data a report charts: market bars (Reports) or the app's own usage events (Analytics). */
export type Dataset = 'market' | 'analytics';

/** A row any report can chart. */
export type ChartRow = ReportRow | AnalyticsRow;

export type FieldKey = keyof ReportRow | keyof AnalyticsRow;

/**
 * number: continuous measure. category: a small set of labels (grouping, colour splits, heatmap axes).
 * time: the bar timestamp, plotted on a date axis.
 */
export type FieldKind = 'number' | 'category' | 'time';

export interface FieldDef {
  key: FieldKey;
  label: string;
  kind: FieldKind;
  description: string;
  /** Unit hint for axis labels and number formats. */
  unit?: 'price' | 'percent' | 'shares' | 'seconds';
  /** The datasets that have this field. */
  datasets: readonly Dataset[];
}

const M = ['market'] as const;
const A = ['analytics'] as const;
const BOTH = ['market', 'analytics'] as const;

export const FIELDS: readonly FieldDef[] = [
  // Time fields are shared: exchange time for bars, the user's local time for analytics events.
  { key: 'time', label: 'Time', kind: 'time', description: 'Bar start or event time', datasets: BOTH },
  { key: 'date', label: 'Date', kind: 'category', description: 'Trading day, or the day of the event', datasets: BOTH },
  { key: 'clock', label: 'Time of day', kind: 'category', description: 'HH:MM', datasets: BOTH },
  { key: 'weekday', label: 'Weekday', kind: 'category', description: 'Mon to Sun', datasets: BOTH },
  { key: 'session', label: 'Session', kind: 'category', description: 'pre, regular or post market', datasets: M },
  { key: 'hour', label: 'Hour', kind: 'number', description: 'Hour of day, 0 to 23', datasets: BOTH },
  { key: 'bar', label: 'Bar #', kind: 'number', description: 'Position of the bar, from 0', datasets: M },
  { key: 'open', label: 'Open', kind: 'number', description: 'First trade price in the bar', unit: 'price', datasets: M },
  { key: 'high', label: 'High', kind: 'number', description: 'Highest price in the bar', unit: 'price', datasets: M },
  { key: 'low', label: 'Low', kind: 'number', description: 'Lowest price in the bar', unit: 'price', datasets: M },
  { key: 'close', label: 'Close', kind: 'number', description: 'Last trade price in the bar', unit: 'price', datasets: M },
  { key: 'volume', label: 'Volume', kind: 'number', description: 'Shares (or units) traded', unit: 'shares', datasets: M },
  { key: 'change', label: 'Change', kind: 'number', description: 'Close minus open', unit: 'price', datasets: M },
  { key: 'changePct', label: 'Change %', kind: 'number', description: 'Close vs open, percent', unit: 'percent', datasets: M },
  { key: 'spread', label: 'Range', kind: 'number', description: 'High minus low', unit: 'price', datasets: M },
  { key: 'spreadPct', label: 'Range %', kind: 'number', description: 'High minus low, percent of low', unit: 'percent', datasets: M },
  { key: 'return', label: 'Return %', kind: 'number', description: 'Close vs the first close shown, percent', unit: 'percent', datasets: M },

  { key: 'seq', label: 'Event #', kind: 'number', description: 'Order the event happened in, from 1', datasets: A },
  { key: 'event', label: 'Event', kind: 'category', description: 'Kind of event: click, page_view, export...', datasets: A },
  { key: 'page', label: 'Page', kind: 'category', description: 'Page the event happened on', datasets: A },
  { key: 'target', label: 'Control', kind: 'category', description: 'The button, control or action used', datasets: A },
  { key: 'detail', label: 'Detail', kind: 'category', description: 'Chart type, export format, status code, control role...', datasets: A },
  { key: 'subject', label: 'Subject', kind: 'category', description: 'What it was about: report, symbol, theme, state', datasets: A },
  { key: 'input', label: 'Input method', kind: 'category', description: 'mouse, keyboard, touch or pen', datasets: A },
  { key: 'visit', label: 'Visit', kind: 'category', description: 'Which visit (page load) the event was in', datasets: A },
  { key: 'count', label: 'Events', kind: 'number', description: '1 per event, so Sum counts them', datasets: A },
  { key: 'duration', label: 'Duration (s)', kind: 'number', description: 'Time on page, slow-frame length', unit: 'seconds', datasets: A },
  { key: 'value', label: 'Value', kind: 'number', description: 'Scroll depth %, characters copied, reports compared...', datasets: A },
];

export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f])) as Record<FieldKey, FieldDef>;
export const fieldsFor = (dataset: Dataset) => FIELDS.filter((f) => f.datasets.includes(dataset));
export const NUMERIC_FIELDS = fieldsFor('market').filter((f) => f.kind === 'number');
export const CATEGORY_FIELDS = fieldsFor('market').filter((f) => f.kind === 'category');

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const SESSION_ORDER = ['pre', 'regular', 'post'];

const round = (n: number, digits = 4) => Math.round(n * 10 ** digits) / 10 ** digits;

export function toReportRows(rows: readonly Row[]): ReportRow[] {
  const first = rows[0]?.close;
  return rows.map((r, i) => {
    const day = new Date(`${r.date}T00:00:00Z`).getUTCDay();
    return {
      ...r,
      bar: i,
      weekday: WEEKDAYS[(day + 6) % 7]!,
      hour: Number(r.clock.slice(0, 2)),
      change: round(r.close - r.open),
      changePct: r.open ? round(((r.close - r.open) / r.open) * 100) : 0,
      spread: round(r.high - r.low),
      spreadPct: r.low ? round(((r.high - r.low) / r.low) * 100) : 0,
      return: first ? round(((r.close - first) / first) * 100) : 0,
    };
  });
}

/** Sort order for a field's values: chronological for dates and times, Mon→Sun, pre→regular→post, numeric. */
export function compareValues(field: FieldKey, a: string | number | null, b: string | number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (field === 'weekday') return WEEKDAYS.indexOf(a as never) - WEEKDAYS.indexOf(b as never);
  if (field === 'session') return SESSION_ORDER.indexOf(String(a)) - SESSION_ORDER.indexOf(String(b));
  return a < b ? -1 : 1;
}

/** The value of a field on a row, as something Plotly can plot. Session is null on daily bars. */
export function valueOf(row: ChartRow, field: FieldKey): string | number | null {
  const v = (row as unknown as Record<string, string | number | null | undefined>)[field] ?? null;
  // Exchange wall-clock time without the offset: Plotly treats it as local and keeps the exchange's hours.
  if (field === 'time' && typeof v === 'string') return v.slice(0, 16).replace('T', ' ');
  return v;
}
