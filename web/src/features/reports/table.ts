import { FIELD_BY_KEY } from './fields';
import type { Report } from './model';
import type { Shaped } from './shape';

/*
 * The numbers behind a chart as a flat table: shown under the chart for screen reader and keyboard
 * users (and anyone who wants the exact values), and used for the CSV export.
 */

export interface DataTable {
  columns: string[];
  rows: (string | number | null)[][];
}

export function toTable(s: Shaped, report: Report): DataTable {
  const { enc } = report;
  const f = (k: keyof typeof FIELD_BY_KEY) => FIELD_BY_KEY[k].label;
  switch (s.kind) {
    case 'cartesian':
      return {
        columns: ['Series', f(enc.x), 'Value'],
        rows: s.traces.flatMap((t) => t.x.map((x, i) => [t.name, x, t.y[i] ?? null])),
      };
    case 'ohlc':
      return {
        columns: [f(enc.x), 'Open', 'High', 'Low', 'Close', 'Volume'],
        rows: s.x.map((x, i) => [x, s.open[i]!, s.high[i]!, s.low[i]!, s.close[i]!, s.volume[i]!]),
      };
    case 'histogram':
      return { columns: ['Series', f(enc.x)], rows: s.traces.flatMap((t) => t.values.map((v) => [t.name, v])) };
    case 'box':
      return {
        columns: ['Measure', ...(enc.color ? [f(enc.color)] : []), 'Value'],
        rows: s.traces.flatMap((t) => t.values.map((v, i) => [t.name, ...(t.groups ? [t.groups[i]!] : []), v])),
      };
    case 'grid':
      return {
        columns: [f(enc.y), ...s.xLabels],
        rows: s.yLabels.map((y, i) => [y, ...(s.z[i] ?? [])]),
      };
    case 'points3d':
      return {
        columns: ['Series', 'Time', f(enc.x), f(enc.y), f(enc.z)],
        rows: s.traces.flatMap((t) =>
          t.z.map((z, i) => [
            t.name,
            t.text[i]!,
            s.axes.x.labels ? s.axes.x.labels[t.x[i]!]! : t.x[i]!,
            s.axes.y.labels ? s.axes.y.labels[t.y[i]!]! : t.y[i]!,
            z,
          ]),
        ),
      };
  }
}

export function tableToCsv(t: DataTable): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [t.columns.map(esc).join(','), ...t.rows.map((r) => r.map(esc).join(','))].join('\n');
}
