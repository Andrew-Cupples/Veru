import { messages } from '../../i18n/I18nProvider';
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
  { key: 'time', get label() { return messages().fields.time.label; }, kind: 'time', get description() { return messages().fields.time.description; }, datasets: BOTH },
  { key: 'date', get label() { return messages().fields.date.label; }, kind: 'category', get description() { return messages().fields.date.description; }, datasets: BOTH },
  { key: 'clock', get label() { return messages().fields.clock.label; }, kind: 'category', get description() { return messages().fields.clock.description; }, datasets: BOTH },
  { key: 'weekday', get label() { return messages().fields.weekday.label; }, kind: 'category', get description() { return messages().fields.weekday.description; }, datasets: BOTH },
  { key: 'session', get label() { return messages().fields.session.label; }, kind: 'category', get description() { return messages().fields.session.description; }, datasets: M },
  { key: 'hour', get label() { return messages().fields.hour.label; }, kind: 'number', get description() { return messages().fields.hour.description; }, datasets: BOTH },
  { key: 'bar', get label() { return messages().fields.bar.label; }, kind: 'number', get description() { return messages().fields.bar.description; }, datasets: M },
  { key: 'open', get label() { return messages().fields.open.label; }, kind: 'number', get description() { return messages().fields.open.description; }, unit: 'price', datasets: M },
  { key: 'high', get label() { return messages().fields.high.label; }, kind: 'number', get description() { return messages().fields.high.description; }, unit: 'price', datasets: M },
  { key: 'low', get label() { return messages().fields.low.label; }, kind: 'number', get description() { return messages().fields.low.description; }, unit: 'price', datasets: M },
  { key: 'close', get label() { return messages().fields.close.label; }, kind: 'number', get description() { return messages().fields.close.description; }, unit: 'price', datasets: M },
  { key: 'volume', get label() { return messages().fields.volume.label; }, kind: 'number', get description() { return messages().fields.volume.description; }, unit: 'shares', datasets: M },
  { key: 'change', get label() { return messages().fields.change.label; }, kind: 'number', get description() { return messages().fields.change.description; }, unit: 'price', datasets: M },
  { key: 'changePct', get label() { return messages().fields.changePct.label; }, kind: 'number', get description() { return messages().fields.changePct.description; }, unit: 'percent', datasets: M },
  { key: 'spread', get label() { return messages().fields.spread.label; }, kind: 'number', get description() { return messages().fields.spread.description; }, unit: 'price', datasets: M },
  { key: 'spreadPct', get label() { return messages().fields.spreadPct.label; }, kind: 'number', get description() { return messages().fields.spreadPct.description; }, unit: 'percent', datasets: M },
  { key: 'return', get label() { return messages().fields.return.label; }, kind: 'number', get description() { return messages().fields.return.description; }, unit: 'percent', datasets: M },

  { key: 'seq', get label() { return messages().fields.seq.label; }, kind: 'number', get description() { return messages().fields.seq.description; }, datasets: A },
  { key: 'event', get label() { return messages().fields.event.label; }, kind: 'category', get description() { return messages().fields.event.description; }, datasets: A },
  { key: 'page', get label() { return messages().fields.page.label; }, kind: 'category', get description() { return messages().fields.page.description; }, datasets: A },
  { key: 'target', get label() { return messages().fields.target.label; }, kind: 'category', get description() { return messages().fields.target.description; }, datasets: A },
  { key: 'detail', get label() { return messages().fields.detail.label; }, kind: 'category', get description() { return messages().fields.detail.description; }, datasets: A },
  { key: 'subject', get label() { return messages().fields.subject.label; }, kind: 'category', get description() { return messages().fields.subject.description; }, datasets: A },
  { key: 'input', get label() { return messages().fields.input.label; }, kind: 'category', get description() { return messages().fields.input.description; }, datasets: A },
  { key: 'visit', get label() { return messages().fields.visit.label; }, kind: 'category', get description() { return messages().fields.visit.description; }, datasets: A },
  { key: 'count', get label() { return messages().fields.count.label; }, kind: 'number', get description() { return messages().fields.count.description; }, datasets: A },
  { key: 'duration', get label() { return messages().fields.duration.label; }, kind: 'number', get description() { return messages().fields.duration.description; }, unit: 'seconds', datasets: A },
  { key: 'value', get label() { return messages().fields.value.label; }, kind: 'number', get description() { return messages().fields.value.description; }, datasets: A },
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
