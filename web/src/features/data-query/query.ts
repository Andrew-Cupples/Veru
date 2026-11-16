import type { MarketSession, PriceBar } from '../../api/client';
import type { AnalyticsRow } from '../../analytics/rows';
import { EVENT_KINDS } from '../../analytics/tracker';
import { messages } from '../../i18n/I18nProvider';
import { evaluate, expressionSql, parseExpression } from './expression';

/*
 * A small, SQL-shaped query model over raw bars: SELECT columns, WHERE a logical expression (./expression),
 * ORDER BY one column. Pure functions so the UI stays thin and the logic is unit-testable.
 */

export interface Row {
  /** Full ISO timestamp in exchange time, e.g. 2026-11-13T09:30:00-05:00. */
  time: string;
  date: string;
  clock: string;
  session: MarketSession | null;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ColumnKey = keyof Row;
export type ColumnKind = 'text' | 'number' | 'session';

export interface ColumnDef<K extends string = ColumnKey> {
  key: K;
  label: string;
  kind: ColumnKind;
  description: string;
  /** Fixed set of values, offered as a list instead of free text. */
  choices?: readonly string[];
}

export const COLUMNS: readonly ColumnDef[] = [
  { key: 'time', get label() { return messages().fields.time.label; }, kind: 'text', get description() { return messages().columns.time; } },
  { key: 'date', get label() { return messages().fields.date.label; }, kind: 'text', get description() { return messages().columns.date; } },
  { key: 'clock', get label() { return messages().fields.clock.label; }, kind: 'text', get description() { return messages().columns.clock; } },
  { key: 'session', get label() { return messages().fields.session.label; }, kind: 'session', get description() { return messages().columns.session; } },
  { key: 'open', get label() { return messages().fields.open.label; }, kind: 'number', get description() { return messages().columns.open; } },
  { key: 'high', get label() { return messages().fields.high.label; }, kind: 'number', get description() { return messages().columns.high; } },
  { key: 'low', get label() { return messages().fields.low.label; }, kind: 'number', get description() { return messages().columns.low; } },
  { key: 'close', get label() { return messages().fields.close.label; }, kind: 'number', get description() { return messages().columns.close; } },
  { key: 'volume', get label() { return messages().fields.volume.label; }, kind: 'number', get description() { return messages().columns.volume; } },
];

export const COLUMN_BY_KEY = Object.fromEntries(COLUMNS.map((c) => [c.key, c])) as Record<ColumnKey, ColumnDef>;

/** Columns WHERE can test on Analytics: the usage event fields (local time). */
export type AnalyticsColumnKey = keyof AnalyticsRow;
export type ConditionColumn = ColumnKey | AnalyticsColumnKey;

export const ANALYTICS_COLUMNS: readonly ColumnDef<AnalyticsColumnKey>[] = [
  { key: 'event', get label() { return messages().fields.event.label; }, kind: 'text', get description() { return messages().columns.event; }, choices: EVENT_KINDS },
  { key: 'page', get label() { return messages().fields.page.label; }, kind: 'text', get description() { return messages().columns.page; }, choices: ['Start', 'Reports', 'Raw data', 'Compare', 'Analytics', 'Prompt ledger', 'Personalize'] },
  { key: 'target', get label() { return messages().fields.target.label; }, kind: 'text', get description() { return messages().columns.target; } },
  { key: 'detail', get label() { return messages().fields.detail.label; }, kind: 'text', get description() { return messages().columns.detail; } },
  { key: 'subject', get label() { return messages().fields.subject.label; }, kind: 'text', get description() { return messages().columns.subject; } },
  { key: 'input', get label() { return messages().fields.input.label; }, kind: 'text', get description() { return messages().columns.input; }, choices: ['mouse', 'keyboard', 'touch', 'pen'] },
  { key: 'visit', get label() { return messages().fields.visit.label; }, kind: 'text', get description() { return messages().columns.visit; } },
  { key: 'date', get label() { return messages().fields.date.label; }, kind: 'text', get description() { return messages().columns.localDate; } },
  { key: 'clock', get label() { return messages().fields.clock.label; }, kind: 'text', get description() { return messages().columns.localClock; } },
  { key: 'weekday', get label() { return messages().fields.weekday.label; }, kind: 'text', get description() { return messages().columns.weekday; }, choices: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
  { key: 'hour', get label() { return messages().fields.hour.label; }, kind: 'number', get description() { return messages().columns.hour; } },
  { key: 'duration', get label() { return messages().fields.duration.label; }, kind: 'number', get description() { return messages().columns.duration; } },
  { key: 'value', get label() { return messages().fields.value.label; }, kind: 'number', get description() { return messages().columns.value; } },
  { key: 'seq', get label() { return messages().fields.seq.label; }, kind: 'number', get description() { return messages().columns.seq; } },
];

/** Every column a WHERE may name, across both datasets. */
export const CONDITION_COLUMN_BY_KEY = Object.fromEntries(
  [...COLUMNS, ...ANALYTICS_COLUMNS].map((c) => [c.key, c]),
) as Record<ConditionColumn, ColumnDef<ConditionColumn>>;


export type Operator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains';

/** The old row-per-condition WHERE (AND-ed). Only read back from storage, to migrate into an expression. */
export interface Condition {
  id: string;
  column: ConditionColumn;
  operator: Operator;
  value: string;
}

export type Direction = 'asc' | 'desc';

export interface QuerySpec {
  select: ColumnKey[];
  /** A logical expression over the datapoints, e.g. `close > open AND NOT session = post`. Blank means every row. */
  where: string;
  orderBy: { column: ColumnKey; direction: Direction } | null;
}

export const DEFAULT_SPEC: QuerySpec = {
  select: COLUMNS.map((c) => c.key),
  where: '',
  orderBy: { column: 'time', direction: 'asc' },
};

export function toRows(bars: readonly PriceBar[]): Row[] {
  return bars.map((b) => ({
    time: b.time,
    // The API sends exchange-local ISO strings, so the date and clock are read straight off the text.
    date: b.time.slice(0, 10),
    clock: b.time.slice(11, 16),
    session: b.session ?? null,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const OPERATORS = new Set<string>(['=', '!=', '>', '>=', '<', '<=', 'contains']);

function isConditionList(v: unknown): v is Condition[] {
  return (
    Array.isArray(v) &&
    v.every(
      (c) =>
        isObject(c) &&
        typeof c.id === 'string' &&
        typeof c.value === 'string' &&
        typeof c.operator === 'string' &&
        OPERATORS.has(c.operator) &&
        typeof c.column === 'string' &&
        c.column in CONDITION_COLUMN_BY_KEY,
    )
  );
}

/** Rewrites old AND-ed conditions as the same expression; incomplete ones are dropped, as they were ignored. */
export function conditionsToExpression(where: readonly Condition[]): string {
  return where
    .filter((c) => {
      const value = c.value.trim();
      return value && (CONDITION_COLUMN_BY_KEY[c.column].kind !== 'number' || Number.isFinite(Number(value)));
    })
    .map((c) => {
      const value = c.value.trim();
      const literal = CONDITION_COLUMN_BY_KEY[c.column].kind === 'number' ? value : `'${value.replaceAll("'", "''")}'`;
      return `${c.column} ${c.operator === 'contains' ? 'CONTAINS' : c.operator} ${literal}`;
    })
    .join(' AND ');
}

/** Reads a stored WHERE: an expression, or the old condition list (migrated). Null if neither. */
export function readWhere(v: unknown): string | null {
  if (typeof v === 'string') return v;
  return isConditionList(v) ? conditionsToExpression(v) : null;
}

/** Applies a WHERE expression, keeping row order. Blank or invalid text filters nothing (the editor says why). */
export function filterRows<T extends object>(rows: readonly T[], where: string, columns: readonly ColumnDef<string>[] = COLUMNS): T[] {
  const parsed = parseExpression(where, columns);
  if (!parsed.ok || !parsed.expr) return [...rows];
  const expr = parsed.expr;
  return rows.filter((r) => evaluate(expr, r));
}

function compare(a: Row, b: Row, column: ColumnKey): number {
  const x = a[column];
  const y = b[column];
  if (x === y) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  return x < y ? -1 : 1;
}

export function runQuery(rows: readonly Row[], spec: QuerySpec): Row[] {
  const result = filterRows(rows, spec.where);
  if (spec.orderBy) {
    const { column, direction } = spec.orderBy;
    const sign = direction === 'asc' ? 1 : -1;
    result.sort((a, b) => sign * compare(a, b, column));
  }
  return result;
}

export interface Source {
  symbol: string;
  interval: string;
  range: string;
  extendedHours: boolean;
}

/** A read-only SQL rendering of the query, so the user can see exactly what is being asked. */
export function toSql(source: Source, spec: QuerySpec): string {
  const columns = spec.select.length === COLUMNS.length ? '*' : spec.select.join(', ') || '/* no columns */';
  const lines = [`SELECT ${columns}`, fromSql(source), ...whereSql(spec.where)];
  if (spec.orderBy) lines.push(`ORDER BY ${spec.orderBy.column} ${spec.orderBy.direction.toUpperCase()}`);
  return lines.join('\n') + ';';
}

export function fromSql(source: Source): string {
  return `FROM bars('${source.symbol}', interval => '${source.interval}', range => '${source.range}', extended_hours => ${source.extendedHours})`;
}

/** The WHERE line for an expression that applies; empty when it is blank or invalid. */
export function whereSql(where: string, columns: readonly ColumnDef<string>[] = COLUMNS): string[] {
  const parsed = parseExpression(where, columns);
  return parsed.ok && parsed.expr ? [`WHERE ${expressionSql(parsed.expr)}`] : [];
}

export function toCsv(rows: readonly Row[], columns: readonly ColumnKey[]): string {
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => escape(r[c])).join(','))].join('\n');
}
