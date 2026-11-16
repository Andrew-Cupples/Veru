import { readJson, writeJson } from '../../lib/storage';
import { isRecord } from '../data-query/memory';
import { COLUMN_BY_KEY, DEFAULT_SPEC, readWhere, type QuerySpec } from '../data-query/query';

/** The Raw data page's query clauses (SELECT, WHERE, ORDER BY), kept between visits. */

const KEY = 'veru.rawData.spec';
const isAnything = (v: unknown): v is unknown => v !== undefined;

/** Reads a stored spec, migrating the old condition-list WHERE and dropping the retired LIMIT. */
function parseSpec(v: unknown): QuerySpec | null {
  if (!isRecord(v) || !Array.isArray(v.select)) return null;
  if (!v.select.every((c) => typeof c === 'string' && c in COLUMN_BY_KEY)) return null;
  const order = v.orderBy;
  const orderOk =
    order === null ||
    (isRecord(order) && typeof order.column === 'string' && order.column in COLUMN_BY_KEY && (order.direction === 'asc' || order.direction === 'desc'));
  const where = readWhere(v.where);
  if (!orderOk || where === null) return null;
  return { select: v.select as QuerySpec['select'], where, orderBy: order as QuerySpec['orderBy'] };
}

export function loadSpec(): QuerySpec {
  return parseSpec(readJson<unknown>(KEY, null, isAnything)) ?? DEFAULT_SPEC;
}
export const saveSpec = (spec: QuerySpec) => writeJson(KEY, spec);
