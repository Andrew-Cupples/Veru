import { readJson, writeJson } from '../../lib/storage';
import { COLUMN_BY_KEY, DEFAULT_SPEC, type QuerySpec, type Source } from './query';

/*
 * What the Raw data page remembers between visits, so coming back (or switching tabs) shows the last
 * result instead of an empty form: the last source, the query clauses, and recently used symbols.
 */

const KEYS = { source: 'veru.rawData.lastSource', spec: 'veru.rawData.spec', recent: 'veru.rawData.recentSymbols' } as const;
const MAX_RECENT = 8;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function isSource(v: unknown): v is Source {
  return (
    isRecord(v) &&
    typeof v.symbol === 'string' &&
    typeof v.interval === 'string' &&
    typeof v.range === 'string' &&
    typeof v.extendedHours === 'boolean'
  );
}

function isSpec(v: unknown): v is QuerySpec {
  if (!isRecord(v) || !Array.isArray(v.select) || !Array.isArray(v.where)) return false;
  const columnsKnown = v.select.every((c) => typeof c === 'string' && c in COLUMN_BY_KEY);
  const conditionsOk = v.where.every(
    (c) => isRecord(c) && typeof c.id === 'string' && typeof c.value === 'string' && typeof c.column === 'string' && c.column in COLUMN_BY_KEY,
  );
  const order = v.orderBy;
  const orderOk =
    order === null ||
    (isRecord(order) && typeof order.column === 'string' && order.column in COLUMN_BY_KEY && (order.direction === 'asc' || order.direction === 'desc'));
  return columnsKnown && conditionsOk && orderOk && (v.limit === null || typeof v.limit === 'number');
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');

export const loadLastSource = () => readJson<Source | null>(KEYS.source, null, (v): v is Source | null => isSource(v));
export const loadSpec = () => readJson<QuerySpec>(KEYS.spec, DEFAULT_SPEC, isSpec);
export const loadRecentSymbols = () => readJson<string[]>(KEYS.recent, [], isStringArray);

export const saveSpec = (spec: QuerySpec) => writeJson(KEYS.spec, spec);

/** Records a run: remembers it as the last source and moves its symbol to the front of the recents. */
export function rememberRun(source: Source): string[] {
  writeJson(KEYS.source, source);
  const recent = [source.symbol, ...loadRecentSymbols().filter((s) => s !== source.symbol)].slice(0, MAX_RECENT);
  writeJson(KEYS.recent, recent);
  return recent;
}
