import { readJson, writeJson } from '../../lib/storage';
import type { Source } from './query';

/*
 * The data source every data page shares (Raw data, Reports): the last source run, recently used symbols,
 * favourite symbols and the names seen for them.
 * Shared on purpose, so a symbol picked on one page is already loaded on the next.
 * The source and recents keys predate Reports and keep their names so existing browsers keep their history.
 */

const KEYS = {
  source: 'veru.rawData.lastSource',
  recent: 'veru.rawData.recentSymbols',
  favourites: 'veru.symbols.favourites',
  names: 'veru.symbols.names',
} as const;
const MAX_RECENT = 8;
const MAX_FAVOURITES = 12;
/** Names are only for labels and tooltips; keep the newest few hundred. */
const MAX_NAMES = 300;

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
const isNameMap = (v: unknown): v is Record<string, string> => isRecord(v) && Object.values(v).every((s) => typeof s === 'string');

export const loadLastSource = () => readJson<Source | null>(KEYS.source, null, (v): v is Source | null => isSource(v));
export const loadRecentSymbols = () => readJson<string[]>(KEYS.recent, [], isStringArray);
export const loadFavourites = () => readJson<string[]>(KEYS.favourites, [], isStringArray);
export const loadSymbolNames = () => readJson<Record<string, string>>(KEYS.names, {}, isNameMap);

/** Records a run: remembers it as the last source and moves its symbol to the front of the recents. */
export function rememberRun(source: Source): string[] {
  writeJson(KEYS.source, source);
  const recent = [source.symbol, ...loadRecentSymbols().filter((s) => s !== source.symbol)].slice(0, MAX_RECENT);
  writeJson(KEYS.recent, recent);
  return recent;
}

/** Adds or removes a favourite. New favourites go to the end, so the Alt+number shortcuts of the others stay put. */
export function toggleFavourite(symbol: string): string[] {
  const list = loadFavourites();
  const next = list.includes(symbol) ? list.filter((s) => s !== symbol) : [...list, symbol].slice(-MAX_FAVOURITES);
  writeJson(KEYS.favourites, next);
  return next;
}

/** Remembers display names (from search results or a loaded instrument). Returns the map when anything changed. */
export function rememberNames(entries: readonly (readonly [string, string | null | undefined])[]): Record<string, string> | null {
  const names = loadSymbolNames();
  let changed = false;
  for (const [symbol, name] of entries) {
    if (!name || names[symbol] === name) continue;
    delete names[symbol]; // re-insert so it counts as newest
    names[symbol] = name;
    changed = true;
  }
  if (!changed) return null;
  const kept = Object.entries(names).slice(-MAX_NAMES);
  const next = Object.fromEntries(kept);
  writeJson(KEYS.names, next);
  return next;
}
