import { beforeEach, describe, expect, it } from 'vitest';
import { loadFavourites, loadLastSource, loadRecentSymbols, loadSymbolNames, rememberNames, rememberRun, toggleFavourite } from './memory';

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
    localStorage.setItem('veru.symbols.favourites', '{"a":1}');
    expect(loadFavourites()).toEqual([]);
  });

  it('toggles favourites, appending new ones so existing shortcuts keep their number', () => {
    toggleFavourite('TSLA');
    toggleFavourite('AAPL');
    expect(toggleFavourite('NVDA')).toEqual(['TSLA', 'AAPL', 'NVDA']);
    expect(toggleFavourite('AAPL')).toEqual(['TSLA', 'NVDA']);
    expect(loadFavourites()).toEqual(['TSLA', 'NVDA']);
  });

  it('remembers names and reports whether anything changed', () => {
    expect(rememberNames([['TSLA', 'Tesla, Inc.'], ['X', null]])).toEqual({ TSLA: 'Tesla, Inc.' });
    expect(rememberNames([['TSLA', 'Tesla, Inc.']])).toBeNull();
    expect(loadSymbolNames()).toEqual({ TSLA: 'Tesla, Inc.' });
  });
});
