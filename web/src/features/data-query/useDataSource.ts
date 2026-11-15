import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import type { SymbolMatch } from '../../api/client';
import { usePriceSeries, useQueryOptions } from '../../api/hooks';
import { loadFavourites, loadLastSource, loadRecentSymbols, loadSymbolNames, rememberNames, rememberRun, toggleFavourite } from './memory';
import { toRows, type Source } from './query';
import { track } from '../../analytics/tracker';

const DEFAULT_INTERVAL = '15m';
const DEFAULT_RANGE = '1mo';
const MAX_RECENT = 8; // matches memory.ts
const QUICK_PICKS = ['TSLA', 'AAPL', 'NVDA', 'SPY', '^GSPC', 'BTC-USD'];
const SOURCE_PARAMS = ['symbol', 'interval', 'range', 'ext'] as const;

/**
 * The data source lives in the URL so a view can be bookmarked, shared and survives a refresh.
 * With no symbol in the URL (e.g. arriving from the nav), the last source run on any data page is shown again.
 */
function readSource(params: URLSearchParams, last: Source | null): Source {
  if (!params.get('symbol') && last) return last;
  return {
    symbol: params.get('symbol') ?? '',
    interval: params.get('interval') ?? DEFAULT_INTERVAL,
    range: params.get('range') ?? DEFAULT_RANGE,
    extendedHours: params.get('ext') === '1',
  };
}

/** The recents list with `symbol` moved to the front (as rememberRun stores it). */
const withFirst = (list: readonly string[], symbol: string) =>
  symbol ? [symbol, ...list.filter((s) => s !== symbol)].slice(0, MAX_RECENT) : [...list];

/**
 * Everything a data page needs to pick and load bars: the source in the URL, the draft being edited,
 * running it, recents, the fetched series and its rows. Raw data and Reports both build on this, so
 * choosing a symbol works (and is remembered) the same way everywhere.
 *
 * Other search params on the page (e.g. `report`) are left alone when the source changes.
 */
export function useDataSource() {
  const [params, setParams] = useSearchParams();
  const [lastSource] = useState(loadLastSource);
  const source = readSource(params, lastSource);
  const [draft, setDraft] = useState<Source>(source);
  const [recent, setRecent] = useState(() => withFirst(loadRecentSymbols(), source.symbol));
  const [favourites, setFavourites] = useState(loadFavourites);
  const [storedNames, setNames] = useState(loadSymbolNames);
  const [symbolError, setSymbolError] = useState(false);
  const symbolRef = useRef<HTMLInputElement>(null);

  const options = useQueryOptions();
  const series = usePriceSeries(source.symbol ? source : null);
  const rows = useMemo(() => toRows(series.data?.bars ?? []), [series.data]);

  const learnNames = useCallback((entries: readonly (readonly [string, string | null | undefined])[]) => {
    const next = rememberNames(entries);
    if (next) setNames(next);
  }, []);
  const learnMatches = useCallback((matches: readonly SymbolMatch[]) => learnNames(matches.map((m) => [m.symbol, m.name])), [learnNames]);

  // A loaded instrument's name labels its shortcut and suggestion: straight away here, and saved for next time.
  const instrument = series.data?.instrument;
  const names = useMemo(
    () => (instrument?.name && storedNames[instrument.symbol] !== instrument.name ? { ...storedNames, [instrument.symbol]: instrument.name } : storedNames),
    [storedNames, instrument],
  );
  useEffect(() => {
    if (instrument) rememberNames([[instrument.symbol, instrument.name]]);
  }, [instrument]);

  // The source can change from outside the page's own fields (the menu bar's stock search, back/forward):
  // show it in the inputs and remember it like a run, so recents and the next page pick it up.
  const { symbol, interval, range, extendedHours } = source;
  const [shownKey, setShownKey] = useState(`${symbol}|${interval}|${range}|${extendedHours}`);
  const key = `${symbol}|${interval}|${range}|${extendedHours}`;
  if (key !== shownKey) {
    setShownKey(key);
    setDraft({ symbol, interval, range, extendedHours });
    if (symbol) setRecent((list) => withFirst(list, symbol));
  }
  useEffect(() => {
    if (symbol) rememberRun({ symbol, interval, range, extendedHours });
  }, [symbol, interval, range, extendedHours]);

  const run = (next: Source = draft) => {
    const symbol = next.symbol.trim().toUpperCase();
    const ran = { ...next, symbol };
    track('query', { target: 'run', subject: symbol, detail: `${ran.interval} · ${ran.range}${ran.extendedHours ? ' · pre/post' : ''}` });
    setDraft(ran);
    setSymbolError(false);
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      for (const key of SOURCE_PARAMS) p.delete(key);
      p.set('symbol', symbol);
      p.set('interval', ran.interval);
      p.set('range', ran.range);
      if (ran.extendedHours) p.set('ext', '1');
      return p;
    });
  };

  // Changing interval, range or pre/post re-runs straight away once something is loaded: no extra Run click.
  const changeSourceOption = (next: Source) => {
    if (source.symbol && next.symbol.trim()) run(next);
    else setDraft(next);
  };

  const changeDraft = (next: Source) => {
    setSymbolError(false);
    setDraft(next);
  };

  const ready = options.isSuccess;
  const running = series.isFetching;

  /** Submit handler for the form holding the source fields: says what's missing instead of silently doing nothing. */
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.symbol.trim()) {
      setSymbolError(true);
      symbolRef.current?.focus();
      return;
    }
    if (ready && !running) run();
  };

  const picks = [...recent, ...QUICK_PICKS.filter((s) => !recent.includes(s))].slice(0, 10);

  /** Loads a symbol with the current interval, range and pre/post. */
  const switchTo = (symbol: string) => run({ ...draft, symbol });

  const toggleFav = (symbol: string) => {
    const on = !favourites.includes(symbol);
    track('query', { target: on ? 'add favourite' : 'remove favourite', subject: symbol });
    setFavourites(toggleFavourite(symbol));
  };

  return {
    /** What is loaded (from the URL). */
    source,
    /** What is in the inputs. */
    draft,
    setDraft: changeDraft,
    run,
    changeSourceOption,
    submit,
    symbolError,
    symbolRef,
    recent,
    picks,
    favourites,
    toggleFavourite: toggleFav,
    names,
    learnMatches,
    switchTo,
    options,
    series,
    rows,
    ready,
    running,
  };
}

export type DataSource = ReturnType<typeof useDataSource>;
