import { describe, expect, it } from 'vitest';
import { COLUMNS, DEFAULT_SPEC, filterRows, runQuery, toCsv, toRows, toSql, type QuerySpec } from './query';
import { parseExpression } from './expression';
import type { PriceBar } from '../../api/client';

const bars: PriceBar[] = [
  { time: '2026-11-12T09:30:00-05:00', session: 'regular', open: 10, high: 12, low: 9, close: 11, volume: 500 },
  { time: '2026-11-12T16:15:00-05:00', session: 'post', open: 11, high: 11.5, low: 10.5, close: 11.2, volume: 50 },
  { time: '2026-11-13T09:30:00-05:00', session: 'regular', open: 11, high: 15, low: 11, close: 14, volume: 2000 },
];
const rows = toRows(bars);
const where = (expression: string): QuerySpec => ({ ...DEFAULT_SPEC, where: expression });
const volumes = (expression: string) => runQuery(rows, where(expression)).map((r) => r.volume);
const errorOf = (expression: string) => {
  const r = parseExpression(expression, COLUMNS);
  return r.ok ? null : r.error;
};

describe('toRows', () => {
  it('splits exchange-local time into date and clock', () => {
    expect(rows[0]).toMatchObject({ date: '2026-11-12', clock: '09:30', session: 'regular' });
  });
});

describe('runQuery', () => {
  it('returns everything in time order by default', () => {
    expect(runQuery(rows, DEFAULT_SPEC).map((r) => r.volume)).toEqual([500, 50, 2000]);
  });

  it('sorts descending', () => {
    expect(runQuery(rows, { ...DEFAULT_SPEC, orderBy: { column: 'volume', direction: 'desc' } }).map((r) => r.volume)).toEqual([2000, 500, 50]);
  });
});

describe('WHERE expressions', () => {
  it('ANDs numeric and session comparisons, case-insensitively', () => {
    expect(volumes("volume > 100 and session = 'REGULAR'")).toEqual([500, 2000]);
  });

  it('supports OR, XOR and NOT', () => {
    expect(volumes('volume < 100 OR close >= 14')).toEqual([50, 2000]);
    // regular XOR big: row 1 is regular but small, row 3 is both, row 2 neither.
    expect(volumes('session = regular XOR volume > 1000')).toEqual([500]);
    expect(volumes('NOT session = regular')).toEqual([50]);
  });

  it('binds NOT tighter than AND, AND tighter than XOR, XOR tighter than OR', () => {
    expect(volumes('NOT volume > 100 AND session = post')).toEqual([50]);
    expect(volumes('volume = 50 OR volume = 500 AND session = post')).toEqual([50]);
    expect(volumes('(volume = 50 OR volume = 500) AND session = regular')).toEqual([500]);
    expect(volumes('NOT (volume > 100 OR session = post)')).toEqual([]);
  });

  it('compares datapoints with each other', () => {
    expect(volumes('close > open')).toEqual([500, 50, 2000]);
    expect(volumes('high = close OR low = open')).toEqual([2000]);
  });

  it('compares dates and clock times as text, with or without quotes', () => {
    expect(volumes('date >= 2026-11-13')).toEqual([2000]);
    expect(volumes("clock < '16:00'")).toEqual([500, 2000]);
    expect(volumes('time CONTAINS T16')).toEqual([50]);
  });

  it('accepts symbol aliases', () => {
    expect(volumes('volume > 100 && !(session <> regular)')).toEqual([500, 2000]);
  });

  it('treats blank or invalid text as no filter', () => {
    expect(volumes('   ')).toEqual([500, 50, 2000]);
    expect(volumes('volume >')).toEqual([500, 50, 2000]);
  });

  it('explains what is wrong, and where', () => {
    expect(errorOf('volume >')).toMatchObject({ code: 'expectedOperand' });
    expect(errorOf('closee > 5')).toMatchObject({ code: 'unknownDatapoint', token: 'closee', start: 0, end: 6 });
    expect(errorOf('close > abc')).toMatchObject({ code: 'needsNumber', token: 'close', start: 8, end: 11 });
    expect(errorOf('(close > 5')).toMatchObject({ code: 'expectedClose' });
    expect(errorOf("session = 'pre")).toMatchObject({ code: 'unclosedQuote' });
    expect(errorOf('close')).toMatchObject({ code: 'expectedOperator', token: 'close' });
    expect(errorOf('close > 5 close < 9')).toMatchObject({ code: 'unexpected', token: 'close' });
    expect(errorOf('1 = 1')).toMatchObject({ code: 'noDatapoint' });
  });

  it('only knows the datapoints it is given', () => {
    expect(filterRows(rows, 'event = click')).toHaveLength(3);
    expect(errorOf('event = click')).toMatchObject({ code: 'unknownDatapoint', token: 'event' });
  });
});

describe('toSql', () => {
  it('renders the query as readable SQL', () => {
    const spec: QuerySpec = {
      select: ['date', 'close'],
      where: "session != 'o''post' and (volume > 1000 or close > open) xor not date = 2026-11-13",
      orderBy: { column: 'volume', direction: 'desc' },
    };
    expect(toSql({ symbol: 'TSLA', interval: '15m', range: '1mo', extendedHours: false }, spec)).toBe(
      [
        'SELECT date, close',
        "FROM bars('TSLA', interval => '15m', range => '1mo', extended_hours => false)",
        "WHERE session <> 'o''post' AND (volume > 1000 OR close > open) XOR NOT date = '2026-11-13'",
        'ORDER BY volume DESC;',
      ].join('\n'),
    );
  });
});

describe('toCsv', () => {
  it('writes the selected columns with a header', () => {
    expect(toCsv(rows.slice(0, 1), ['date', 'close', 'session'])).toBe('date,close,session\n2026-11-12,11,regular');
  });
});
