import { describe, expect, it } from 'vitest';
import { parseList } from '../compare/compareState';
import { buildSuggestions } from './suggestions';

const match = (symbol: string, name: string) => ({ symbol, name, exchange: 'NASDAQ', type: 'Equity' });

describe('symbol suggestions', () => {
  it('lists favourites then recents when nothing is typed, without searching', () => {
    const s = buildSuggestions('', ['TSLA'], ['AAPL', 'TSLA'], {}, [match('MSFT', 'Microsoft')]);
    expect(s.map((x) => [x.symbol, x.source])).toEqual([['TSLA', 'favourite'], ['AAPL', 'recent']]);
  });

  it('puts your matching symbols first, then new search results', () => {
    const s = buildSuggestions('t', ['TSLA'], ['AAPL'], {}, [match('TSLA', 'Tesla'), match('T', 'AT&T')]);
    expect(s.map((x) => x.symbol)).toEqual(['TSLA', 'T']);
    expect(s[1]).toMatchObject({ source: 'search', meta: 'NASDAQ · Equity' });
  });

  it('matches your own symbols by remembered name', () => {
    const s = buildSuggestions('apple', [], ['AAPL'], { AAPL: 'Apple Inc.' }, []);
    expect(s.map((x) => x.symbol)).toEqual(['AAPL']);
  });
});

describe('compare stocks in the URL', () => {
  it('normalises, dedupes and caps the list', () => {
    expect(parseList(' aapl,MSFT,,aapl ,nvda', 8)).toEqual(['AAPL', 'MSFT', 'NVDA']);
    expect(parseList('A,B,C,D,E,F,G,H,I', 8)).toHaveLength(8);
  });
});
