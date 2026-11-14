import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { usePriceSeries, useQueryOptions } from '../../api/hooks';
import { loadLastSource, loadRecentSymbols, rememberRun } from './memory';
import { toRows, type Source } from './query';
import { track } from '../../analytics/tracker';

const DEFAULT_INTERVAL = '15m';
const DEFAULT_RANGE = '1mo';
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

const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

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
  const [recent, setRecent] = useState(loadRecentSymbols);
  const [symbolError, setSymbolError] = useState(false);
  const symbolRef = useRef<HTMLInputElement>(null);

  const options = useQueryOptions();
  const series = usePriceSeries(source.symbol ? source : null);
  const rows = useMemo(() => toRows(series.data?.bars ?? []), [series.data]);

  // "/" jumps to the symbol box from anywhere on the page, the quickest way to change the data.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      e.preventDefault();
      symbolRef.current?.focus();
      symbolRef.current?.select();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const run = (next: Source = draft) => {
    const symbol = next.symbol.trim().toUpperCase();
    const ran = { ...next, symbol };
    track('query', { target: 'run', subject: symbol, detail: `${ran.interval} · ${ran.range}${ran.extendedHours ? ' · pre/post' : ''}` });
    setDraft(ran);
    setSymbolError(false);
    setRecent(rememberRun(ran));
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
    options,
    series,
    rows,
    ready,
    running,
  };
}

export type DataSource = ReturnType<typeof useDataSource>;
