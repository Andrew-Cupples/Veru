import { readJson, writeJson } from '../../lib/storage';
import { isRecord } from '../data-query/memory';
import { COLUMN_BY_KEY, DEFAULT_SPEC, isConditionList, type QuerySpec } from '../data-query/query';

/** The Raw data page's query clauses (SELECT, WHERE, ORDER BY, LIMIT), kept between visits. */

const KEY = 'veru.rawData.spec';

function isSpec(v: unknown): v is QuerySpec {
  if (!isRecord(v) || !Array.isArray(v.select)) return false;
  const columnsKnown = v.select.every((c) => typeof c === 'string' && c in COLUMN_BY_KEY);
  const order = v.orderBy;
  const orderOk =
    order === null ||
    (isRecord(order) && typeof order.column === 'string' && order.column in COLUMN_BY_KEY && (order.direction === 'asc' || order.direction === 'desc'));
  return columnsKnown && isConditionList(v.where) && orderOk && (v.limit === null || typeof v.limit === 'number');
}

export const loadSpec = () => readJson<QuerySpec>(KEY, DEFAULT_SPEC, isSpec);
export const saveSpec = (spec: QuerySpec) => writeJson(KEY, spec);
