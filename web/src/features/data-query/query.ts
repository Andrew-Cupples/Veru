import type { MarketSession, PriceBar } from '../../api/client';
import type { AnalyticsRow } from '../../analytics/rows';
import { EVENT_KINDS } from '../../analytics/tracker';
import { messages } from '../../i18n/I18nProvider';

/*
 * A small, SQL-shaped query model over raw bars: SELECT columns, WHERE conditions (AND-ed),
 * ORDER BY one column, LIMIT. Pure functions so the UI stays thin and the logic is unit-testable.
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

/** Every column a condition may name, for validating and applying conditions on either dataset. */
export const CONDITION_COLUMN_BY_KEY = Object.fromEntries(
  [...COLUMNS, ...ANALYTICS_COLUMNS].map((c) => [c.key, c]),
) as Record<ConditionColumn, ColumnDef<ConditionColumn>>;

export type Operator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains';

export const OPERATORS_BY_KIND: Record<ColumnKind, readonly Operator[]> = {
  number: ['>', '>=', '<', '<=', '=', '!='],
  text: ['=', '!=', '>', '>=', '<', '<=', 'contains'],
  session: ['=', '!='],
};

export interface Condition {
  id: string;
  column: ConditionColumn;
  operator: Operator;
  value: string;
}

export type Direction = 'asc' | 'desc';

export interface QuerySpec {
  select: ColumnKey[];
  where: Condition[];
  orderBy: { column: ColumnKey; direction: Direction } | null;
  limit: number | null;
}

export const DEFAULT_SPEC: QuerySpec = {
  select: COLUMNS.map((c) => c.key),
  where: [],
  orderBy: { column: 'time', direction: 'asc' },
  limit: null,
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
const OPERATORS = new Set<string>(Object.values(OPERATORS_BY_KIND).flat());

/** Validates WHERE conditions read back from storage. */
export function isConditionList(v: unknown): v is Condition[] {
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

/** A condition is applied only when complete and well-formed; half-typed ones are ignored, not errors. */
export function isActive(condition: Condition): boolean {
  const value = condition.value.trim();
  if (!value) return false;
  return CONDITION_COLUMN_BY_KEY[condition.column].kind !== 'number' || Number.isFinite(Number(value));
}

function matches(row: object, condition: Condition): boolean {
  const cell = (row as Record<string, unknown>)[condition.column] as string | number | null | undefined;
  const raw = condition.value.trim();
  const kind = CONDITION_COLUMN_BY_KEY[condition.column].kind;

  if (condition.operator === 'contains') {
    return String(cell ?? '').toLowerCase().includes(raw.toLowerCase());
  }

  const left = kind === 'number' ? (cell as number) : String(cell ?? '');
  const right = kind === 'number' ? Number(raw) : raw;
  if (kind !== 'number' && (condition.operator === '=' || condition.operator === '!=')) {
    const equal = String(left).toLowerCase() === String(right).toLowerCase();
    return condition.operator === '=' ? equal : !equal;
  }

  switch (condition.operator) {
    case '=': return left === right;
    case '!=': return left !== right;
    case '>': return left > right;
    case '>=': return left >= right;
    case '<': return left < right;
    case '<=': return left <= right;
  }
}

function compare(a: Row, b: Row, column: ColumnKey): number {
  const x = a[column];
  const y = b[column];
  if (x === y) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  return x < y ? -1 : 1;
}

export interface QueryResult {
  rows: Row[];
  /** Rows that passed WHERE, before LIMIT. */
  matched: number;
}

/** Applies just the WHERE conditions (AND-ed), keeping row order. Works on any row that extends {@link Row}. */
export function filterRows<T extends object>(rows: readonly T[], where: readonly Condition[]): T[] {
  const conditions = where.filter(isActive);
  return conditions.length ? rows.filter((r) => conditions.every((c) => matches(r, c))) : [...rows];
}

export function runQuery(rows: readonly Row[], spec: QuerySpec): QueryResult {
  let result = filterRows(rows, spec.where);

  if (spec.orderBy) {
    const { column, direction } = spec.orderBy;
    const sign = direction === 'asc' ? 1 : -1;
    result.sort((a, b) => sign * compare(a, b, column));
  }

  const matched = result.length;
  if (spec.limit !== null && spec.limit >= 0) result = result.slice(0, spec.limit);
  return { rows: result, matched };
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
  if (spec.limit !== null) lines.push(`LIMIT ${spec.limit}`);
  return lines.join('\n') + ';';
}

export function fromSql(source: Source): string {
  return `FROM bars('${source.symbol}', interval => '${source.interval}', range => '${source.range}', extended_hours => ${source.extendedHours})`;
}

/** WHERE / AND lines for the conditions that apply; empty when none do. */
export function whereSql(where: readonly Condition[]): string[] {
  return where.filter(isActive).map((c, i) => {
    const kind = CONDITION_COLUMN_BY_KEY[c.column].kind;
    const value = c.value.trim();
    const literal = kind === 'number' ? value : `'${value.replaceAll("'", "''")}'`;
    const predicate = c.operator === 'contains'
      ? `${c.column} ILIKE '%${value.replaceAll("'", "''")}%'`
      : `${c.column} ${c.operator === '!=' ? '<>' : c.operator} ${literal}`;
    return `${i === 0 ? 'WHERE' : '  AND'} ${predicate}`;
  });
}

export function toCsv(rows: readonly Row[], columns: readonly ColumnKey[]): string {
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => escape(r[c])).join(','))].join('\n');
}
