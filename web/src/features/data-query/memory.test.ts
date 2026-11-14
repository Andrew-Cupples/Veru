import { beforeEach, describe, expect, it } from 'vitest';
import { loadLastSource, loadRecentSymbols, rememberRun } from './memory';

const run = (symbol: string) => rememberRun({ symbol, interval: '15m', range: '1mo', extendedHours: false });

describe('data source memory', () => {
  beforeEach(() => localStorage.clear());

  it('remembers the last run and keeps recent symbols unique, newest first', () => {
    run('AAPL');
    run('TSLA');
    expect(run('AAPL')).toEqual(['AAPL', 'TSLA']);
    expect(loadLastSource()?.symbol).toBe('AAPL');
    expect(loadRecentSymbols()).toEqual(['AAPL', 'TSLA']);
  });

  it('falls back when stored data is broken', () => {
    localStorage.setItem('veru.rawData.lastSource', 'not json');
    expect(loadLastSource()).toBeNull();
  });
});
