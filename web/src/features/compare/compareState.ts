import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { readJson, writeJson } from '../../lib/storage';
import { isRecord, loadFavourites, loadLastSource } from '../data-query/memory';
import type { CompareGrouping } from '../reports/CompareView';
import { loadActiveId } from '../reports/storage';
import { TEMPLATES } from '../reports/templates';

/*
 * What the Compare page shows: which stocks, which reports, over what bars, grouped how.
 * Kept in the URL so a comparison can be bookmarked and shared, and in this browser so arriving from the
 * nav shows the last comparison again. The Reports editor never reads or writes any of it.
 */

export const MAX_STOCKS = 8;
export const MAX_REPORTS = 6;
const KEY = 'veru.compare.last';
const PARAMS = { stocks: 'stocks', reports: 'reports', interval: 'interval', range: 'range', ext: 'ext', by: 'by' } as const;

export interface CompareState {
  stocks: string[];
  reports: string[];
  interval: string;
  range: string;
  extendedHours: boolean;
  groupBy: Exclude<CompareGrouping, 'none'>;
}

/** Tickers from a comma list: trimmed, upper case, no repeats, capped. */
export function parseList(raw: string, max: number, upper = true): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const v = upper ? part.trim().toUpperCase() : part.trim();
    if (v && v.length <= 64) seen.add(v);
  }
  return [...seen].slice(0, max);
}

const isState = (v: unknown): v is CompareState =>
  isRecord(v) &&
  Array.isArray(v.stocks) &&
  Array.isArray(v.reports) &&
  typeof v.interval === 'string' &&
  typeof v.range === 'string' &&
  typeof v.extendedHours === 'boolean' &&
  (v.groupBy === 'report' || v.groupBy === 'stock');

const loadStored = () => readJson<CompareState | null>(KEY, null, (v): v is CompareState | null => isState(v));

/**
 * First visit: the stock you last looked at plus a couple of favourites, and the report last open in the
 * editor, so there is something useful on screen without a click.
 */
export function defaultState(): CompareState {
  const last = loadLastSource();
  const stocks = parseList([last?.symbol ?? '', ...loadFavourites()].join(','), 3);
  return {
    stocks: stocks.length ? stocks : ['TSLA', 'AAPL'],
    reports: [loadActiveId() ?? TEMPLATES[0]!.id],
    interval: last?.interval ?? '1d',
    range: last?.range ?? '6mo',
    extendedHours: last?.extendedHours ?? false,
    groupBy: 'report',
  };
}

export function readState(params: URLSearchParams, fallback: CompareState): CompareState {
  const stocks = params.get(PARAMS.stocks);
  // A URL without the comparison in it (arriving from the nav) shows the last one instead.
  if (stocks === null) return fallback;
  const reports = params.get(PARAMS.reports);
  return {
    stocks: parseList(stocks, MAX_STOCKS),
    reports: reports === null ? fallback.reports : parseList(reports, MAX_REPORTS, false),
    interval: params.get(PARAMS.interval) ?? fallback.interval,
    range: params.get(PARAMS.range) ?? fallback.range,
    extendedHours: params.get(PARAMS.ext) === '1',
    groupBy: params.get(PARAMS.by) === 'stock' ? 'stock' : 'report',
  };
}

export function toParams(state: CompareState): URLSearchParams {
  const p = new URLSearchParams();
  p.set(PARAMS.stocks, state.stocks.join(','));
  p.set(PARAMS.reports, state.reports.join(','));
  p.set(PARAMS.interval, state.interval);
  p.set(PARAMS.range, state.range);
  if (state.extendedHours) p.set(PARAMS.ext, '1');
  if (state.groupBy === 'stock') p.set(PARAMS.by, 'stock');
  return p;
}

export function useCompareState() {
  const [params, setParams] = useSearchParams();
  const fallback = useMemo(() => loadStored() ?? defaultState(), []);
  const key = params.toString();
  // Stable while the URL is unchanged, so charts only redraw when the comparison does.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const state = useMemo(() => readState(params, fallback), [key, fallback]);

  const set = (change: (s: CompareState) => CompareState) => {
    const next = change(state);
    writeJson(KEY, next);
    setParams(toParams(next), { replace: true });
  };

  return { state, set };
}
