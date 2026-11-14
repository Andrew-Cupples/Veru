import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEC, runQuery, toCsv, toRows, toSql, type Condition, type QuerySpec } from './query';
import type { PriceBar } from '../../api/client';

const bars: PriceBar[] = [
  { time: '2026-11-12T09:30:00-05:00', session: 'regular', open: 10, high: 12, low: 9, close: 11, volume: 500 },
  { time: '2026-11-12T16:15:00-05:00', session: 'post', open: 11, high: 11.5, low: 10.5, close: 11.2, volume: 50 },
  { time: '2026-11-13T09:30:00-05:00', session: 'regular', open: 11, high: 15, low: 11, close: 14, volume: 2000 },
];
const rows = toRows(bars);

const where = (...conditions: Omit<Condition, 'id'>[]): QuerySpec => ({
  ...DEFAULT_SPEC,
  where: conditions.map((c, i) => ({ ...c, id: String(i) })),
});

describe('toRows', () => {
  it('splits exchange-local time into date and clock', () => {
    expect(rows[0]).toMatchObject({ date: '2026-11-12', clock: '09:30', session: 'regular' });
  });
});

describe('runQuery', () => {
  it('returns everything in time order by default', () => {
    expect(runQuery(rows, DEFAULT_SPEC).rows.map((r) => r.volume)).toEqual([500, 50, 2000]);
  });

  it('ANDs numeric and session conditions', () => {
    const spec = where({ column: 'volume', operator: '>', value: '100' }, { column: 'session', operator: '=', value: 'REGULAR' });
    expect(runQuery(rows, spec).rows.map((r) => r.close)).toEqual([11, 14]);
  });

  it('compares dates and clock times as text', () => {
    expect(runQuery(rows, where({ column: 'date', operator: '>=', value: '2026-11-13' })).matched).toBe(1);
    expect(runQuery(rows, where({ column: 'clock', operator: '<', value: '16:00' })).matched).toBe(2);
  });

  it('ignores incomplete or malformed conditions', () => {
    const spec = where({ column: 'volume', operator: '>', value: '' }, { column: 'close', operator: '<', value: 'abc' });
    expect(runQuery(rows, spec).matched).toBe(3);
  });

  it('sorts descending and applies limit after counting matches', () => {
    const result = runQuery(rows, { ...DEFAULT_SPEC, orderBy: { column: 'volume', direction: 'desc' }, limit: 2 });
    expect(result.rows.map((r) => r.volume)).toEqual([2000, 500]);
    expect(result.matched).toBe(3);
  });
});

describe('toSql', () => {
  it('renders the query as readable SQL', () => {
    const spec: QuerySpec = {
      select: ['date', 'close'],
      where: [{ id: '1', column: 'session', operator: '!=', value: "o'post" }, { id: '2', column: 'volume', operator: '>', value: '1000' }],
      orderBy: { column: 'volume', direction: 'desc' },
      limit: 10,
    };
    expect(toSql({ symbol: 'TSLA', interval: '15m', range: '1mo', extendedHours: false }, spec)).toBe(
      [
        'SELECT date, close',
        "FROM bars('TSLA', interval => '15m', range => '1mo', extended_hours => false)",
        "WHERE session <> 'o''post'",
        '  AND volume > 1000',
        'ORDER BY volume DESC',
        'LIMIT 10;',
      ].join('\n'),
    );
  });
});

describe('toCsv', () => {
  it('writes the selected columns with a header', () => {
    expect(toCsv(rows.slice(0, 1), ['date', 'close', 'session'])).toBe('date,close,session\n2026-11-12,11,regular');
  });
});
