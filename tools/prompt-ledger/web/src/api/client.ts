import createClient from 'openapi-fetch';
import type { components, paths } from './schema';

type Schemas = components['schemas'];

export type PromptDetail = Schemas['PromptDetailDto'];
export type PromptOutcome = Schemas['PromptOutcome'];
export type UpdatePromptRequest = Schemas['UpdatePromptRequest'];
export type Tag = Schemas['TagDto'];
export type Session = Schemas['SessionDto'];

export const OUTCOMES: readonly PromptOutcome[] = ['Unset', 'Kept', 'Changed', 'Rejected', 'Mixed'];

export type LedgerClient = ReturnType<typeof createLedgerClient>;

/** A typed client for the ledger API. `baseUrl` is the origin hosting `/api` ('' means same origin). */
export function createLedgerClient(baseUrl = '') {
  return createClient<paths>({ baseUrl });
}

export class LedgerApiError extends Error {
  readonly status: number;

  constructor(status: number, detail: unknown) {
    super(describe(status, detail));
    this.name = 'LedgerApiError';
    this.status = status;
  }
}

/** Unwraps an openapi-fetch result, throwing a readable error for non-2xx responses. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    throw new LedgerApiError(result.response.status, result.error);
  }
  return result.data as T;
}

function describe(status: number, detail: unknown): string {
  if (detail && typeof detail === 'object') {
    const problem = detail as { title?: string; errors?: Record<string, string[]> };
    const fieldErrors = problem.errors ? Object.values(problem.errors).flat().join(' ') : '';
    if (fieldErrors) return fieldErrors;
    if (problem.title) return problem.title;
  }
  return status === 0 ? 'The ledger API is unreachable.' : `Request failed (${status}).`;
}
