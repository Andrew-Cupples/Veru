import { describe, expect, it } from 'vitest';
import { thumbnailOf } from './thumbGeometry';
import { pointIndexAt, relayoutRange } from './chartSync';
import type { CartesianTrace } from './shape';

const trace = (mark: CartesianTrace['mark'], y: number[]): CartesianTrace => ({
  name: 't',
  field: 'close',
  mark,
  axis: 'left',
  color: null,
  x: y.map((_, i) => `2026-06-0${i + 1} 09:30`),
  y,
});

const inUnit = (v: number) => v >= 0 && v <= 1;

describe('thumbnailOf', () => {
  it('draws a line from first to last point, scaled into 0..1', () => {
    const t = thumbnailOf({ kind: 'cartesian', traces: [trace('line', [10, 20, 15])] });
    expect(t).toEqual({ kind: 'line', area: false, points: [[0, 0], [0.5, 1], [1, 0.5]] });
  });

  it('marks areas, and keeps long series to a handful of points', () => {
    const y = Array.from({ length: 500 }, (_, i) => Math.sin(i / 20));
    const t = thumbnailOf({ kind: 'cartesian', traces: [trace('area', y)] });
    expect(t?.kind).toBe('line');
    if (t?.kind !== 'line') return;
    expect(t.area).toBe(true);
    expect(t.points.length).toBeLessThanOrEqual(48);
    expect(t.points.at(-1)![0]).toBe(1);
    expect(t.points.every(([x, y]) => inUnit(x) && inUnit(y))).toBe(true);
  });

  it('draws bars from zero, including negative values', () => {
    const t = thumbnailOf({ kind: 'cartesian', traces: [trace('bar', [2, -2])] });
    expect(t).toEqual({
      kind: 'bars',
      bars: [
        { x: 0, w: 0.5, y0: 0.5, y1: 1 },
        { x: 0.5, w: 0.5, y0: 0, y1: 0.5 },
      ],
    });
  });

  it('turns OHLC into a few candles with highs above lows', () => {
    const n = 100;
    const t = thumbnailOf({
      kind: 'ohlc',
      x: Array.from({ length: n }, (_, i) => i),
      open: Array.from({ length: n }, (_, i) => 100 + i),
      close: Array.from({ length: n }, (_, i) => 101 + i),
      high: Array.from({ length: n }, (_, i) => 103 + i),
      low: Array.from({ length: n }, (_, i) => 99 + i),
      volume: [],
    });
    expect(t?.kind).toBe('candles');
    if (t?.kind !== 'candles') return;
    expect(t.candles.length).toBeLessThanOrEqual(18);
    expect(t.candles.every((c) => c.high >= c.low && inUnit(c.high) && inUnit(c.low))).toBe(true);
  });

  it('bins histograms, shows boxes as their middle half, and samples grids', () => {
    expect(thumbnailOf({ kind: 'histogram', traces: [{ name: 'h', values: [1, 2, 2, 3, 3, 3] }] })?.kind).toBe('bars');
    const box = thumbnailOf({ kind: 'box', traces: [{ name: 'b', field: 'close', groups: ['Mon', 'Mon', 'Tue', 'Tue'], values: [1, 3, 5, 9] }] });
    expect(box?.kind === 'bars' && box.bars.length).toBe(2);
    const grid = thumbnailOf({ kind: 'grid', xLabels: [], yLabels: [], z: Array.from({ length: 20 }, (_, r) => Array.from({ length: 30 }, (_, c) => r + c)) });
    expect(grid).toMatchObject({ kind: 'cells', rows: 7, cols: 12 });
  });

  it('has nothing to draw for empty data', () => {
    expect(thumbnailOf({ kind: 'cartesian', traces: [] })).toBeNull();
    expect(thumbnailOf({ kind: 'cartesian', traces: [trace('line', [])] })).toBeNull();
    expect(thumbnailOf({ kind: 'histogram', traces: [] })).toBeNull();
  });
});

describe('chart sync helpers', () => {
  it('finds the point at an x value, matching dates and labels as text', () => {
    expect(pointIndexAt(['2026-06-01 09:30', '2026-06-01 11:00'], '2026-06-01 11:00')).toBe(1);
    expect(pointIndexAt([1, 2, 3], 3)).toBe(2);
    expect(pointIndexAt(['Mon'], 'Tue')).toBe(-1);
    expect(pointIndexAt(undefined, 'Mon')).toBe(-1);
  });

  it('reads the x range from Plotly relayout events', () => {
    expect(relayoutRange({ 'xaxis.range[0]': 2, 'xaxis.range[1]': 8 })).toEqual([2, 8]);
    expect(relayoutRange({ 'xaxis.range': [2, 8] })).toEqual([2, 8]);
    expect(relayoutRange({ 'xaxis.autorange': true })).toBeNull();
    expect(relayoutRange({ 'yaxis.range[0]': 1 })).toBeUndefined();
  });
});
