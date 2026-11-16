import { beforeEach, describe, expect, it } from 'vitest';
import { loadSpec, saveSpec } from './specMemory';
import { DEFAULT_SPEC } from '../data-query/query';

describe('raw data spec memory', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips the query clauses, including no columns selected', () => {
    const spec = { ...DEFAULT_SPEC, select: [], where: 'volume > 10 OR NOT session = post' };
    saveSpec(spec);
    expect(loadSpec()).toEqual(spec);
  });

  it('migrates the old condition list and drops LIMIT', () => {
    localStorage.setItem(
      'veru.rawData.spec',
      JSON.stringify({
        select: ['close'],
        where: [
          { id: 'a', column: 'volume', operator: '>', value: '10' },
          { id: 'b', column: 'session', operator: '=', value: 'regular' },
          { id: 'c', column: 'close', operator: '<', value: '' },
        ],
        orderBy: null,
        limit: 50,
      }),
    );
    expect(loadSpec()).toEqual({ select: ['close'], where: "volume > 10 AND session = 'regular'", orderBy: null });
  });

  it('falls back to defaults when stored data is broken', () => {
    localStorage.setItem('veru.rawData.spec', '{"select":["nope"],"where":"","orderBy":null}');
    expect(loadSpec()).toBe(DEFAULT_SPEC);
  });
});
