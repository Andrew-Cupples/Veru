import { beforeEach, describe, expect, it } from 'vitest';
import { loadLastSource, loadRecentSymbols, loadSpec, rememberRun, saveSpec } from './memory';
import { DEFAULT_SPEC } from './query';

const run = (symbol: string) => rememberRun({ symbol, interval: '15m', range: '1mo', extendedHours: false });

describe('raw data memory', () => {
  beforeEach(() => localStorage.clear());

  it('remembers the last run and keeps recent symbols unique, newest first', () => {
    run('AAPL');
    run('TSLA');
    expect(run('AAPL')).toEqual(['AAPL', 'TSLA']);
    expect(loadLastSource()?.symbol).toBe('AAPL');
    expect(loadRecentSymbols()).toEqual(['AAPL', 'TSLA']);
  });

  it('round-trips the query clauses', () => {
    const spec = { ...DEFAULT_SPEC, limit: 50, where: [{ id: 'a', column: 'volume' as const, operator: '>' as const, value: '10' }] };
    saveSpec(spec);
    expect(loadSpec()).toEqual(spec);
  });

  it('falls back to defaults when stored data is broken', () => {
    localStorage.setItem('veru.rawData.spec', '{"select":["nope"],"where":[],"orderBy":null,"limit":null}');
    localStorage.setItem('veru.rawData.lastSource', 'not json');
    expect(loadSpec()).toBe(DEFAULT_SPEC);
    expect(loadLastSource()).toBeNull();
  });
});
