import { messages } from '../i18n/I18nProvider';
import createClient from 'openapi-fetch';
import type { components, paths } from './schema';

type Schemas = components['schemas'];

export type PriceSeries = Schemas['PriceSeriesResponse'];
export type PriceBar = Schemas['PriceBarDto'];
export type Instrument = Schemas['InstrumentDto'];
export type QueryOptions = Schemas['QueryOptionsResponse'];
export type IntervalOption = Schemas['IntervalOptionDto'];
export type RangeOption = Schemas['RangeOptionDto'];
export type MarketSession = NonNullable<PriceBar['session']>;
export type SymbolMatch = Schemas['SymbolMatchDto'];
export type DailySummary = Schemas['DailySummaryDto'];

/** Typed client for the market data API. Same origin: the dev server proxies `/api/market`. */
export const marketApi = createClient<paths>({ baseUrl: '' });

/** A failed API call, carrying the server's ProblemDetails message when there is one. */
export class ApiError extends Error {
  readonly status: number;
  /** The ProblemDetails body, when the server sent one (validation errors are in its `errors`). */
  readonly problem: unknown;

  constructor(status: number, problem: unknown) {
    super(describe(status, problem));
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }
}

/** Unwraps an openapi-fetch result, throwing {@link ApiError} for non-2xx responses. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok || result.data === undefined) {
    throw new ApiError(result.response.status, result.error);
  }
  return result.data;
}

function describe(status: number, problem: unknown): string {
  if (problem && typeof problem === 'object') {
    const p = problem as { title?: string; detail?: string; errors?: Record<string, string[]> };
    const fieldErrors = p.errors ? Object.values(p.errors).flat().join(' ') : '';
    if (fieldErrors) return fieldErrors;
    if (p.detail) return p.detail;
    if (p.title) return p.title;
  }
  if (status === 0 || status === 502 || status === 503 || status === 504) {
    return messages().api.unreachable;
  }
  return messages().api.failed(status);
}
