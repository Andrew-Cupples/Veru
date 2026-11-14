import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ApiError, marketApi, unwrap } from './client';

export interface SeriesRequest {
  symbol: string;
  interval: string;
  range: string;
  extendedHours: boolean;
}

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

/** Fetches raw bars. Disabled until a symbol is chosen. */
export function usePriceSeries(request: SeriesRequest | null) {
  return useQuery({
    queryKey: ['market', 'bars', request],
    enabled: request !== null,
    queryFn: async ({ signal }) => {
      const { symbol, interval, range, extendedHours } = request!;
      return unwrap(
        await marketApi.GET('/api/market/{symbol}/bars', {
          params: { path: { symbol }, query: { interval, range, extendedHours } },
          signal,
        }),
      );
    },
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    // A bad symbol or parameter won't fix itself on retry.
    retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
  });
}
