import { keepPreviousData, useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ApiError, marketApi, unwrap, type PriceSeries } from './client';

export interface SeriesRequest {
  symbol: string;
  interval: string;
  range: string;
  extendedHours: boolean;
}

/** Bars are fresh for a minute (the API caches them as long), then refetched in the background on next use. */
const SERIES_STALE = 60_000;
/**
 * Bars are kept in memory for half an hour after they were last shown, so bouncing between symbols draws
 * straight from cache (and refreshes behind the scenes if older than a minute).
 */
const SERIES_KEEP = 30 * 60_000;

export function useQueryOptions() {
  return useQuery({
    queryKey: ['market', 'options'],
    queryFn: async ({ signal }) => unwrap(await marketApi.GET('/api/market/options', { signal })),
    staleTime: Infinity,
    retry: 2,
    retryDelay: 1_000,
    // If the API isn't up yet (UI started first, or started alone), keep checking so the page recovers on its own.
    refetchInterval: (query) => (query.state.status === 'error' ? 5_000 : false),
  });
}

const seriesQuery = (request: SeriesRequest) => ({
  queryKey: ['market', 'bars', request] as const,
  queryFn: async ({ signal }: { signal: AbortSignal }) => {
    const { symbol, interval, range, extendedHours } = request;
    return unwrap(
      await marketApi.GET('/api/market/{symbol}/bars', {
        params: { path: { symbol }, query: { interval, range, extendedHours } },
        signal,
      }),
    );
  },
  staleTime: SERIES_STALE,
  gcTime: SERIES_KEEP,
  // A bad symbol or parameter won't fix itself on retry.
  retry: (count: number, error: Error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
});

const NO_REQUEST: SeriesRequest = { symbol: '', interval: '', range: '', extendedHours: false };

/** Fetches raw bars. Disabled until a symbol is chosen. */
export function usePriceSeries(request: SeriesRequest | null) {
  // With no request the query is disabled, so the placeholder request is never fetched.
  return useQuery({
    ...seriesQuery(request ?? NO_REQUEST),
    enabled: request !== null,
    placeholderData: keepPreviousData,
  });
}

/** Bars for several symbols at once (multi-symbol compare). Results are in the same order as the requests. */
export function usePriceSeriesMany(requests: readonly SeriesRequest[]) {
  return useQueries({ queries: requests.map((r) => seriesQuery(r)), combine: combineSeries });
}

export interface SeriesState {
  data: PriceSeries | undefined;
  error: Error | null;
  isFetching: boolean;
}

// Module-level so TanStack Query keeps the combined array stable until a result actually changes.
const combineSeries = (results: readonly UseQueryResult<PriceSeries>[]): SeriesState[] =>
  results.map((r) => ({ data: r.data, error: r.error, isFetching: r.isFetching }));

/**
 * Symbol autocomplete. Debounce the text before passing it in. Results are reused for an hour (the API
 * caches them for six), so retyping or backspacing never waits on the network.
 */
export function useSymbolSearch(text: string) {
  const q = text.trim();
  return useQuery({
    queryKey: ['market', 'search', q.toUpperCase()],
    enabled: q.length > 0,
    queryFn: async ({ signal }) => unwrap(await marketApi.GET('/api/market/search', { params: { query: { q, limit: 8 } }, signal })),
    staleTime: 60 * 60_000,
    gcTime: 60 * 60_000,
    // Keep the last list on screen while the next one loads, so it doesn't flicker on every keystroke.
    placeholderData: keepPreviousData,
    retry: false,
  });
}
