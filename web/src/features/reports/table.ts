import { messages } from '../../i18n/I18nProvider';
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
  const { series, value, measure } = messages().table;
  switch (s.kind) {
    case 'cartesian':
      return {
        columns: [series, f(enc.x), value],
        rows: s.traces.flatMap((t) => t.x.map((x, i) => [t.name, x, t.y[i] ?? null])),
      };
    case 'ohlc':
      return {
        columns: [f(enc.x), f('open'), f('high'), f('low'), f('close'), f('volume')],
        rows: s.x.map((x, i) => [x, s.open[i]!, s.high[i]!, s.low[i]!, s.close[i]!, s.volume[i]!]),
      };
    case 'histogram':
      return { columns: [series, f(enc.x)], rows: s.traces.flatMap((t) => t.values.map((v) => [t.name, v])) };
    case 'box':
      return {
        columns: [measure, ...(enc.color ? [f(enc.color)] : []), value],
        rows: s.traces.flatMap((t) => t.values.map((v, i) => [t.name, ...(t.groups ? [t.groups[i]!] : []), v])),
      };
    case 'grid':
      return {
        columns: [f(enc.y), ...s.xLabels],
        rows: s.yLabels.map((y, i) => [y, ...(s.z[i] ?? [])]),
      };
    case 'points3d':
      return {
        columns: [series, f('time'), f(enc.x), f(enc.y), f(enc.z)],
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
