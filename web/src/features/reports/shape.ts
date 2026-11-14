import { FIELD_BY_KEY, compareValues, valueOf, type FieldKey, type ReportRow } from './fields';
import { CHART_BY_TYPE, type Aggregate, type Axis, type Mark, type Report } from './model';

/*
 * Turns filtered rows and a report's encoding into plain series: grouped, aggregated and ordered.
 * No Plotly or styling here, so the numbers a chart shows can be unit-tested, and the same shape
 * drives the accessible data table under the chart.
 */

type Value = string | number;

export interface CartesianTrace {
  name: string;
  field: FieldKey;
  mark: Mark;
  axis: Axis;
  color: string | null;
  x: Value[];
  y: number[];
  size?: number[];
  colorValues?: number[];
}

export interface Axis3D {
  /** Present when the axis is a category: values are positions, these are their labels. */
  labels: string[] | null;
}

export interface Trace3D {
  name: string;
  x: number[];
  y: number[];
  z: number[];
  colorValues?: number[];
  size?: number[];
  text: string[];
}

export type Shaped =
  | { kind: 'cartesian'; traces: CartesianTrace[] }
  | { kind: 'ohlc'; x: Value[]; open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }
  | { kind: 'histogram'; traces: { name: string; values: number[] }[] }
  | { kind: 'box'; traces: { name: string; field: FieldKey; groups: string[] | null; values: number[] }[] }
  | { kind: 'grid'; xLabels: string[]; yLabels: string[]; z: (number | null)[][] }
  | { kind: 'points3d'; traces: Trace3D[]; axes: { x: Axis3D; y: Axis3D } };

export function aggregate(values: readonly number[], how: Aggregate): number {
  if (!values.length) return NaN;
  switch (how) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'count':
      return values.length;
    case 'first':
    case 'none':
      return values[0]!;
    case 'last':
      return values[values.length - 1]!;
    case 'median': {
      const s = [...values].sort((a, b) => a - b);
      const mid = s.length >> 1;
      return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
    }
  }
}

const label = (v: string | number | null) => (v === null ? '(none)' : String(v));

/** Distinct values of a field, in its natural order. */
function distinct(rows: readonly ReportRow[], field: FieldKey): (string | number | null)[] {
  const seen = new Set<string | number | null>();
  for (const r of rows) seen.add(valueOf(r, field));
  return [...seen].sort((a, b) => compareValues(field, a, b));
}

function groupBy<K>(rows: readonly ReportRow[], key: (r: ReportRow) => K): Map<K, ReportRow[]> {
  const map = new Map<K, ReportRow[]>();
  for (const r of rows) {
    const k = key(r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}

const num = (r: ReportRow, f: FieldKey) => Number(valueOf(r, f));

/** Category axes in 3D are plotted as positions 0..n-1 and labelled. */
function axis3d(rows: readonly ReportRow[], field: FieldKey): { at: (r: ReportRow) => number; axis: Axis3D } {
  if (FIELD_BY_KEY[field].kind === 'number') return { at: (r) => num(r, field), axis: { labels: null } };
  const values = distinct(rows, field);
  const index = new Map(values.map((v, i) => [v, i]));
  return { at: (r) => index.get(valueOf(r, field)) ?? 0, axis: { labels: values.map(label) } };
}

export function shape(rows: readonly ReportRow[], report: Report): Shaped {
  const { enc, chart } = report;
  const def = CHART_BY_TYPE[chart];

  switch (chart) {
    case 'candlestick':
    case 'ohlc':
      return {
        kind: 'ohlc',
        x: rows.map((r) => valueOf(r, enc.x) ?? ''),
        open: rows.map((r) => r.open),
        high: rows.map((r) => r.high),
        low: rows.map((r) => r.low),
        close: rows.map((r) => r.close),
        volume: rows.map((r) => r.volume),
      };

    case 'histogram': {
      const groups = enc.color ? [...groupBy(rows, (r) => valueOf(r, enc.color!))] : [[null, rows] as const];
      return {
        kind: 'histogram',
        traces: groups
          .sort(([a], [b]) => (enc.color ? compareValues(enc.color, a, b) : 0))
          .map(([key, list]) => ({
            name: enc.color ? label(key) : FIELD_BY_KEY[enc.x].label,
            values: list.map((r) => num(r, enc.x)),
          })),
      };
    }

    case 'box':
      return {
        kind: 'box',
        traces: enc.series.map((s) => ({
          name: FIELD_BY_KEY[s.field].label,
          field: s.field,
          groups: enc.color ? rows.map((r) => label(valueOf(r, enc.color!))) : null,
          values: rows.map((r) => num(r, s.field)),
        })),
      };

    case 'heatmap':
    case 'surface': {
      const xs = distinct(rows, enc.x);
      const ys = distinct(rows, enc.y);
      const cells = groupBy(rows, (r) => `${label(valueOf(r, enc.x))}\u0000${label(valueOf(r, enc.y))}`);
      const how = enc.aggregate === 'none' ? 'avg' : enc.aggregate;
      const z = ys.map((y) =>
        xs.map((x) => {
          const list = cells.get(`${label(x)}\u0000${label(y)}`);
          return list ? round(aggregate(list.map((r) => num(r, enc.z)), how)) : null;
        }),
      );
      return { kind: 'grid', xLabels: xs.map(label), yLabels: ys.map(label), z };
    }

    case 'scatter3d':
    case 'line3d': {
      const x = axis3d(rows, enc.x);
      const y = axis3d(rows, enc.y);
      const colorKind = enc.color ? FIELD_BY_KEY[enc.color].kind : null;
      const groups = colorKind === 'category' ? [...groupBy(rows, (r) => valueOf(r, enc.color!))] : [[null, rows] as const];
      return {
        kind: 'points3d',
        axes: { x: x.axis, y: y.axis },
        traces: groups
          .sort(([a], [b]) => (enc.color && colorKind === 'category' ? compareValues(enc.color, a, b) : 0))
          .map(([key, list]) => ({
            name: colorKind === 'category' ? label(key) : FIELD_BY_KEY[enc.z].label,
            x: list.map(x.at),
            y: list.map(y.at),
            z: list.map((r) => num(r, enc.z)),
            colorValues: colorKind === 'number' ? list.map((r) => num(r, enc.color!)) : undefined,
            size: enc.size ? list.map((r) => num(r, enc.size!)) : undefined,
            text: list.map((r) => label(valueOf(r, 'time'))),
          })),
      };
    }

    default:
      return { kind: 'cartesian', traces: cartesianTraces(rows, report, def.mark ?? 'line') };
  }
}

const round = (n: number) => (Number.isFinite(n) ? Math.round(n * 1e4) / 1e4 : n);

function cartesianTraces(rows: readonly ReportRow[], report: Report, defaultMark: Mark): CartesianTrace[] {
  const { enc, chart } = report;
  const colorKind = enc.color ? FIELD_BY_KEY[enc.color].kind : null;
  const split = colorKind === 'category' ? enc.color : null;
  const groups = split
    ? [...groupBy(rows, (r) => valueOf(r, split))].sort(([a], [b]) => compareValues(split, a, b))
    : [[null, rows as ReportRow[]] as const];
  const grouped = chart !== 'scatter' && enc.aggregate !== 'none';
  // Lines must be drawn in x order or they zig-zag; scatter dots keep bar order.
  const sortByX = chart !== 'scatter' && enc.x !== 'time';

  const traces: CartesianTrace[] = [];
  for (const s of enc.series) {
    for (const [key, list] of groups) {
      const name = split
        ? enc.series.length > 1 ? `${label(key)} · ${FIELD_BY_KEY[s.field].label}` : label(key)
        : FIELD_BY_KEY[s.field].label;
      const base = { name, field: s.field, mark: s.mark ?? defaultMark, axis: s.axis, color: split ? null : s.color };

      if (grouped) {
        const byX = [...groupBy(list, (r) => valueOf(r, enc.x))].sort(([a], [b]) => compareValues(enc.x, a, b));
        traces.push({
          ...base,
          x: byX.map(([k]) => k ?? '(none)'),
          y: byX.map(([, g]) => round(aggregate(g.map((r) => num(r, s.field)), enc.aggregate))),
        });
        continue;
      }

      const ordered = sortByX ? [...list].sort((a, b) => compareValues(enc.x, valueOf(a, enc.x), valueOf(b, enc.x))) : list;
      traces.push({
        ...base,
        x: ordered.map((r) => valueOf(r, enc.x) ?? '(none)'),
        y: ordered.map((r) => num(r, s.field)),
        size: enc.size ? ordered.map((r) => num(r, enc.size!)) : undefined,
        colorValues: colorKind === 'number' ? ordered.map((r) => num(r, enc.color!)) : undefined,
      });
    }
  }
  return traces;
}

/** How many plotted values the shape holds, for the summary line. */
export function pointCount(s: Shaped): number {
  switch (s.kind) {
    case 'cartesian':
      return s.traces.reduce((n, t) => n + t.y.length, 0);
    case 'ohlc':
      return s.close.length;
    case 'histogram':
      return s.traces.reduce((n, t) => n + t.values.length, 0);
    case 'box':
      return s.traces.reduce((n, t) => n + t.values.length, 0);
    case 'grid':
      return s.z.flat().filter((v) => v !== null).length;
    case 'points3d':
      return s.traces.reduce((n, t) => n + t.z.length, 0);
  }
}
