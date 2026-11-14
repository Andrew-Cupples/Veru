import { readJson, writeJson } from '../../lib/storage';
import type { Source } from './query';

/*
 * The data source every data page shares (Raw data, Reports): the last source run and recently used symbols.
 * Shared on purpose, so a symbol picked on one page is already loaded on the next.
 * The storage keys predate Reports and keep their names so existing browsers keep their history.
 */

const KEYS = { source: 'veru.rawData.lastSource', recent: 'veru.rawData.recentSymbols' } as const;
const MAX_RECENT = 8;

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function isSource(v: unknown): v is Source {
  return (
    isRecord(v) &&
    typeof v.symbol === 'string' &&
    typeof v.interval === 'string' &&
    typeof v.range === 'string' &&
    typeof v.extendedHours === 'boolean'
  );
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');

export const loadLastSource = () => readJson<Source | null>(KEYS.source, null, (v): v is Source | null => isSource(v));
export const loadRecentSymbols = () => readJson<string[]>(KEYS.recent, [], isStringArray);

/** Records a run: remembers it as the last source and moves its symbol to the front of the recents. */
export function rememberRun(source: Source): string[] {
  writeJson(KEYS.source, source);
  const recent = [source.symbol, ...loadRecentSymbols().filter((s) => s !== source.symbol)].slice(0, MAX_RECENT);
  writeJson(KEYS.recent, recent);
  return recent;
}
