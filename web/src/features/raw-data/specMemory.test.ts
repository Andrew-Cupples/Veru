import { beforeEach, describe, expect, it } from 'vitest';
import { loadSpec, saveSpec } from './specMemory';
import { DEFAULT_SPEC } from '../data-query/query';

describe('raw data spec memory', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips the query clauses, including no columns selected', () => {
    const spec = { ...DEFAULT_SPEC, select: [], limit: 50, where: [{ id: 'a', column: 'volume' as const, operator: '>' as const, value: '10' }] };
    saveSpec(spec);
    expect(loadSpec()).toEqual(spec);
  });

  it('falls back to defaults when stored data is broken', () => {
    localStorage.setItem('veru.rawData.spec', '{"select":["nope"],"where":[],"orderBy":null,"limit":null}');
    expect(loadSpec()).toBe(DEFAULT_SPEC);
  });
});
