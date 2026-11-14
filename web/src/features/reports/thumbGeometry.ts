import type { Shaped } from './shape';

/*
 * A report's chart reduced to a few marks for a library thumbnail, drawn from the same shaped data as
 * the real chart. Coordinates are 0..1 (x left to right, y bottom to top); Thumbnail.tsx scales them.
 * No Plotly: thumbnails stay cheap enough to draw for every report on every data change.
 */

export type Thumb =
  | { kind: 'line'; points: [number, number][]; area: boolean }
  | { kind: 'bars'; bars: { x: number; w: number; y0: number; y1: number }[] }
  | { kind: 'candles'; candles: { x: number; w: number; open: number; close: number; high: number; low: number }[] }
  | { kind: 'dots'; points: [number, number][] }
  | { kind: 'cells'; cols: number; rows: number; values: (number | null)[][] };

const MAX_LINE_POINTS = 48;
const MAX_BARS = 18;
const MAX_DOTS = 60;
const MAX_CELLS = { cols: 12, rows: 7 };

const finite = (v: number) => Number.isFinite(v);

/** Maps values into 0..1; a flat series sits in the middle. */
function scaler(values: readonly number[], includeZero = false) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (!finite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (includeZero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (!finite(lo) || !finite(hi)) return null;
  const span = hi - lo;
  return (v: number) => (span === 0 ? 0.5 : (v - lo) / span);
}

/** Every nth index, always keeping the last, so long series keep their overall shape. */
function sampleIndexes(length: number, max: number): number[] {
  if (length <= max) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => Math.round(i * step));
}

/** Splits 0..length into at most `max` contiguous buckets of indexes. */
function buckets(length: number, max: number): number[][] {
  const count = Math.min(length, max);
  return Array.from({ length: count }, (_, b) => {
    const start = Math.floor((b * length) / count);
    const end = Math.floor(((b + 1) * length) / count);
    return Array.from({ length: end - start }, (_, i) => start + i);
  });
}

const mean = (vs: number[]) => {
  const ok = vs.filter(finite);
  return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : NaN;
};

function quantile(sorted: number[], q: number) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

function barsFrom(values: number[], fromZero: boolean): Thumb | null {
  const groups = buckets(values.length, MAX_BARS).map((idx) => mean(idx.map((i) => values[i]!)));
  const s = scaler(groups, fromZero);
  if (!s || !groups.length) return null;
  const base = fromZero ? s(0) : 0;
  const w = 1 / groups.length;
  // A missing value draws as an empty slot, keeping the other bars in place.
  const bar = (v: number, i: number) =>
    finite(v) ? { x: i * w, w, y0: Math.min(base, s(v)), y1: Math.max(base, s(v)) } : { x: i * w, w, y0: base, y1: base };
  return { kind: 'bars', bars: groups.map(bar) };
}

export function thumbnailOf(shaped: Shaped): Thumb | null {
  switch (shaped.kind) {
    case 'cartesian': {
      const trace = shaped.traces[0];
      if (!trace || !trace.y.length) return null;
      if (trace.mark === 'bar') return barsFrom(trace.y, true);
      if (trace.mark === 'scatter') {
        const xs = trace.x.map((v, i) => (typeof v === 'number' ? v : i));
        const sx = scaler(xs);
        const sy = scaler(trace.y);
        if (!sx || !sy) return null;
        const points = sampleIndexes(trace.y.length, MAX_DOTS)
          .filter((i) => finite(trace.y[i]!) && finite(xs[i]!))
          .map((i): [number, number] => [sx(xs[i]!), sy(trace.y[i]!)]);
        return { kind: 'dots', points };
      }
      const sy = scaler(trace.y);
      if (!sy) return null;
      const idx = sampleIndexes(trace.y.length, MAX_LINE_POINTS).filter((i) => finite(trace.y[i]!));
      const last = Math.max(1, trace.y.length - 1);
      return { kind: 'line', area: trace.mark === 'area', points: idx.map((i): [number, number] => [i / last, sy(trace.y[i]!)]) };
    }
    case 'ohlc': {
      const groups = buckets(shaped.close.length, MAX_BARS).map((idx) => ({
        open: shaped.open[idx[0]!]!,
        close: shaped.close[idx[idx.length - 1]!]!,
        high: Math.max(...idx.map((i) => shaped.high[i]!)),
        low: Math.min(...idx.map((i) => shaped.low[i]!)),
      }));
      const s = scaler(groups.flatMap((g) => [g.high, g.low]));
      if (!s || !groups.length) return null;
      const w = 1 / groups.length;
      return {
        kind: 'candles',
        candles: groups.map((g, i) => ({ x: i * w, w, open: s(g.open), close: s(g.close), high: s(g.high), low: s(g.low) })),
      };
    }
    case 'histogram': {
      const values = (shaped.traces[0]?.values ?? []).filter(finite);
      const s = scaler(values);
      if (!s || !values.length) return null;
      const bins = new Array<number>(12).fill(0);
      for (const v of values) bins[Math.min(11, Math.floor(s(v) * 12))]! += 1;
      return barsFrom(bins, true);
    }
    case 'box': {
      // One box per group (or per measure): the middle half, from the 25th to the 75th percentile.
      const groups: number[][] = [];
      for (const trace of shaped.traces) {
        if (!trace.groups) {
          groups.push(trace.values.filter(finite));
          continue;
        }
        const byGroup = new Map<string, number[]>();
        trace.values.forEach((v, i) => {
          if (!finite(v)) return;
          const key = trace.groups![i]!;
          byGroup.set(key, [...(byGroup.get(key) ?? []), v]);
        });
        groups.push(...byGroup.values());
      }
      const ranges = groups
        .filter((g) => g.length)
        .slice(0, MAX_BARS)
        .map((g) => {
          const sorted = [...g].sort((a, b) => a - b);
          return [quantile(sorted, 0.25), quantile(sorted, 0.75)] as const;
        });
      const s = scaler(ranges.flat());
      if (!s || !ranges.length) return null;
      const w = 1 / ranges.length;
      return { kind: 'bars', bars: ranges.map(([lo, hi], i) => ({ x: i * w, w, y0: s(lo), y1: Math.max(s(hi), s(lo) + 0.04) })) };
    }
    case 'grid': {
      const rowsIdx = sampleIndexes(shaped.z.length, MAX_CELLS.rows);
      const colsIdx = sampleIndexes(shaped.z[0]?.length ?? 0, MAX_CELLS.cols);
      const picked = rowsIdx.map((r) => colsIdx.map((c) => shaped.z[r]?.[c] ?? null));
      const s = scaler(picked.flat().filter((v): v is number => v !== null));
      if (!s || !colsIdx.length) return null;
      return { kind: 'cells', rows: rowsIdx.length, cols: colsIdx.length, values: picked.map((row) => row.map((v) => (v === null ? null : s(v)))) };
    }
    case 'points3d': {
      // Seen from above: x across, y up. Enough to tell a cloud from a path.
      const trace = shaped.traces[0];
      if (!trace) return null;
      const sx = scaler(trace.x);
      const sy = scaler(trace.y);
      if (!sx || !sy) return null;
      const points = sampleIndexes(trace.x.length, MAX_DOTS).map((i): [number, number] => [sx(trace.x[i]!), sy(trace.y[i]!)]);
      return { kind: 'dots', points };
    }
  }
}
