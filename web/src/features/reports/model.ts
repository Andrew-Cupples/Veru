import type { Condition } from '../data-query/query';
import { FIELD_BY_KEY, type FieldKey, type FieldKind } from './fields';

/*
 * A report is a chart definition that works on whatever symbol is loaded: chart type, which fields go
 * where (encoding), WHERE filters, and its look (style). Pure data, so it serialises to storage as is.
 */

export type ChartType =
  | 'line'
  | 'area'
  | 'bar'
  | 'scatter'
  | 'candlestick'
  | 'ohlc'
  | 'histogram'
  | 'box'
  | 'heatmap'
  | 'scatter3d'
  | 'line3d'
  | 'surface';

export type Mark = 'line' | 'area' | 'bar' | 'scatter';
export type Aggregate = 'none' | 'avg' | 'sum' | 'min' | 'max' | 'median' | 'count' | 'first' | 'last';
export type Axis = 'left' | 'right';

export interface Series {
  field: FieldKey;
  /** Overrides the chart's mark, to mix lines and bars in one chart. */
  mark: Mark | null;
  axis: Axis;
  /** Overrides the palette colour. */
  color: string | null;
}

export interface Encoding {
  x: FieldKey;
  /** Second grid dimension (heatmap, surface) or the Y axis of a 3D chart. */
  y: FieldKey;
  /** Measures plotted against x (2D cartesian, box). */
  series: Series[];
  /** Height of a 3D chart, or the cell value of a heatmap / surface. */
  z: FieldKey;
  /** Colour by a field: a category splits into series, a number becomes a colour scale. */
  color: FieldKey | null;
  /** Marker size by a number (scatter). */
  size: FieldKey | null;
  /** How bars that share an x (and colour) are combined. */
  aggregate: Aggregate;
}

export const PALETTES = ['theme', 'colorblind', 'vivid', 'warm', 'cool', 'mono'] as const;
export type PaletteId = (typeof PALETTES)[number];
export const COLORSCALES = ['Viridis', 'Cividis', 'Blues', 'Greens', 'YlOrRd', 'RdBu', 'Portland', 'Electric', 'Hot'] as const;
export type Colorscale = (typeof COLORSCALES)[number];
export type LegendPosition = 'auto' | 'top' | 'bottom' | 'right' | 'hidden';
export type NumberFormat = 'auto' | 'price' | 'compact' | 'integer' | 'percent';
export type HoverMode = 'closest' | 'x' | 'none';
export type CameraPreset = 'iso' | 'front' | 'side' | 'top';

export interface ReportStyle {
  /** Empty shows the report name. */
  title: string;
  subtitle: string;
  showTitle: boolean;
  palette: PaletteId;
  colorscale: Colorscale;
  reverseScale: boolean;
  showScale: boolean;

  lineWidth: number;
  lineShape: 'linear' | 'spline' | 'hv';
  markers: boolean;
  markerSize: number;
  markerSymbol: 'circle' | 'square' | 'diamond' | 'triangle-up' | 'cross';
  opacity: number;
  barMode: 'group' | 'stack' | 'overlay';
  bins: number;
  upColor: string | null;
  downColor: string | null;
  volumeOverlay: boolean;

  /** Empty uses the field name. */
  xTitle: string;
  yTitle: string;
  y2Title: string;
  zTitle: string;
  showGrid: boolean;
  yLog: boolean;
  yFormat: NumberFormat;
  skipGaps: boolean;
  rangeSlider: boolean;

  legend: LegendPosition;
  hover: HoverMode;
  spikes: boolean;

  height: number;
  fontSize: number;
  background: 'card' | 'transparent' | 'custom';
  backgroundColor: string;

  camera: CameraPreset;
  aspect: 'cube' | 'data';
  projection: 'perspective' | 'orthographic';
  contours: boolean;
}

export interface Report {
  id: string;
  name: string;
  chart: ChartType;
  enc: Encoding;
  where: Condition[];
  style: ReportStyle;
  /** Set on built-in templates; editing one saves a copy to My reports. */
  template?: boolean;
  description?: string;
  updatedAt: number;
}

export const DEFAULT_STYLE: ReportStyle = {
  title: '',
  subtitle: '',
  showTitle: true,
  palette: 'theme',
  colorscale: 'Viridis',
  reverseScale: false,
  showScale: true,
  lineWidth: 2,
  lineShape: 'linear',
  markers: false,
  markerSize: 7,
  markerSymbol: 'circle',
  opacity: 0.9,
  barMode: 'group',
  bins: 0,
  upColor: null,
  downColor: null,
  volumeOverlay: false,
  xTitle: '',
  yTitle: '',
  y2Title: '',
  zTitle: '',
  showGrid: true,
  yLog: false,
  yFormat: 'auto',
  skipGaps: true,
  rangeSlider: false,
  legend: 'auto',
  hover: 'x',
  spikes: true,
  height: 480,
  fontSize: 12,
  background: 'card',
  backgroundColor: '#ffffff',
  camera: 'iso',
  aspect: 'cube',
  projection: 'perspective',
  contours: false,
};

/* ---------- Chart catalogue ---------- */

export type Slot = 'x' | 'y' | 'z' | 'series' | 'color' | 'size';

export interface SlotRule {
  label: string;
  kinds: readonly FieldKind[];
  optional?: boolean;
}

export interface ChartDef {
  type: ChartType;
  label: string;
  dims: 2 | 3;
  description: string;
  slots: Partial<Record<Slot, SlotRule>>;
  /** Shown when the chart groups bars; undefined hides the aggregate control. */
  aggregate?: { default: Aggregate; required?: boolean };
  /** Mark used for series without their own. */
  mark?: Mark;
}

const ANY: readonly FieldKind[] = ['time', 'category', 'number'];
const GRID: readonly FieldKind[] = ['category', 'number'];

const cartesian = (type: ChartType, label: string, mark: Mark, description: string, agg: Aggregate): ChartDef => ({
  type,
  label,
  dims: 2,
  description,
  mark,
  slots: {
    x: { label: 'X axis', kinds: ANY },
    series: { label: 'Y values', kinds: ['number'] },
    color: { label: 'Split by', kinds: ['category'], optional: true },
  },
  aggregate: { default: agg },
});

export const CHARTS: readonly ChartDef[] = [
  cartesian('line', 'Line', 'line', 'Values over time or any ordered field', 'none'),
  cartesian('area', 'Area', 'area', 'Line with the area below filled', 'none'),
  cartesian('bar', 'Bar', 'bar', 'Compare values per group', 'avg'),
  {
    type: 'scatter',
    label: 'Scatter',
    dims: 2,
    mark: 'scatter',
    description: 'How two measures relate, one dot per bar',
    slots: {
      x: { label: 'X axis', kinds: ANY },
      series: { label: 'Y values', kinds: ['number'] },
      color: { label: 'Colour by', kinds: ['category', 'number'], optional: true },
      size: { label: 'Size by', kinds: ['number'], optional: true },
    },
  },
  {
    type: 'candlestick',
    label: 'Candlestick',
    dims: 2,
    description: 'Open, high, low and close per bar',
    slots: { x: { label: 'X axis', kinds: ['time', 'category'] } },
  },
  {
    type: 'ohlc',
    label: 'OHLC',
    dims: 2,
    description: 'Open-high-low-close ticks per bar',
    slots: { x: { label: 'X axis', kinds: ['time', 'category'] } },
  },
  {
    type: 'histogram',
    label: 'Histogram',
    dims: 2,
    description: 'Distribution of one measure',
    slots: {
      x: { label: 'Measure', kinds: ['number'] },
      color: { label: 'Split by', kinds: ['category'], optional: true },
    },
  },
  {
    type: 'box',
    label: 'Box',
    dims: 2,
    description: 'Spread of measures, optionally per group',
    slots: {
      series: { label: 'Measures', kinds: ['number'] },
      color: { label: 'Group by', kinds: ['category'], optional: true },
    },
  },
  {
    type: 'heatmap',
    label: 'Heatmap',
    dims: 2,
    description: 'A measure across two groupings',
    slots: {
      x: { label: 'Columns', kinds: GRID },
      y: { label: 'Rows', kinds: GRID },
      z: { label: 'Cell value', kinds: ['number'] },
    },
    aggregate: { default: 'avg', required: true },
  },
  {
    type: 'scatter3d',
    label: '3D scatter',
    dims: 3,
    description: 'Three measures at once, one point per bar',
    slots: {
      x: { label: 'X axis', kinds: GRID },
      y: { label: 'Y axis', kinds: GRID },
      z: { label: 'Z axis', kinds: ['number'] },
      color: { label: 'Colour by', kinds: ['category', 'number'], optional: true },
      size: { label: 'Size by', kinds: ['number'], optional: true },
    },
  },
  {
    type: 'line3d',
    label: '3D line',
    dims: 3,
    description: 'A path through three measures, in bar order',
    slots: {
      x: { label: 'X axis', kinds: GRID },
      y: { label: 'Y axis', kinds: GRID },
      z: { label: 'Z axis', kinds: ['number'] },
      color: { label: 'Colour by', kinds: ['number'], optional: true },
    },
  },
  {
    type: 'surface',
    label: 'Surface',
    dims: 3,
    description: 'A measure as a landscape over two groupings',
    slots: {
      x: { label: 'X axis', kinds: GRID },
      y: { label: 'Y axis', kinds: GRID },
      z: { label: 'Height', kinds: ['number'] },
    },
    aggregate: { default: 'avg', required: true },
  },
];

export const CHART_BY_TYPE = Object.fromEntries(CHARTS.map((c) => [c.type, c])) as Record<ChartType, ChartDef>;

export const AGGREGATES: readonly { key: Aggregate; label: string }[] = [
  { key: 'none', label: 'None (every bar)' },
  { key: 'avg', label: 'Average' },
  { key: 'sum', label: 'Sum' },
  { key: 'min', label: 'Minimum' },
  { key: 'max', label: 'Maximum' },
  { key: 'median', label: 'Median' },
  { key: 'count', label: 'Count' },
  { key: 'first', label: 'First' },
  { key: 'last', label: 'Last' },
];

export const fits = (rule: SlotRule | undefined, field: FieldKey | null) =>
  !!rule && field !== null && rule.kinds.includes(FIELD_BY_KEY[field].kind);

/** Preferred fields per slot, tried in order when a chart switch leaves a slot without a fitting field. */
const PREFERRED: Record<'x' | 'y' | 'z', readonly FieldKey[]> = {
  x: ['time', 'date', 'clock', 'bar', 'changePct', 'close'],
  y: ['clock', 'close', 'hour', 'volume'],
  z: ['volume', 'close', 'changePct'],
};

const pick = (rule: SlotRule | undefined, current: FieldKey, preferred: readonly FieldKey[]): FieldKey =>
  !rule || fits(rule, current) ? current : preferred.find((f) => fits(rule, f)) ?? current;

/**
 * Changes the chart type, keeping every field that still fits and picking sensible ones where not,
 * so switching type is one click and never leaves an empty or broken chart.
 */
export function switchChart(report: Report, chart: ChartType): Report {
  const def = CHART_BY_TYPE[chart];
  const { enc } = report;
  let series = def.slots.series ? enc.series.filter((s) => fits(def.slots.series, s.field)) : enc.series;
  if (def.slots.series && !series.length) series = [newSeries('close')];
  // Heatmap and surface need two different groupings.
  let x = pick(def.slots.x, enc.x, PREFERRED.x);
  let y = pick(def.slots.y, enc.y, PREFERRED.y);
  if (chart === 'heatmap' || chart === 'surface') {
    if (!fits(def.slots.x, x) || FIELD_BY_KEY[x].kind === 'number') x = 'date';
    if (!fits(def.slots.y, y) || y === x) y = 'clock';
  }
  if (def.dims === 3 && (chart === 'scatter3d' || chart === 'line3d') && x === y) y = x === 'bar' ? 'close' : 'bar';
  const z = pick(def.slots.z, enc.z, PREFERRED.z);
  const color = fits(def.slots.color, enc.color) ? enc.color : null;
  const size = fits(def.slots.size, enc.size) ? enc.size : null;
  const previous = CHART_BY_TYPE[report.chart].aggregate;
  const keepAgg = def.aggregate && previous && enc.aggregate !== previous.default && !(def.aggregate.required && enc.aggregate === 'none');
  const aggregate = def.aggregate ? (keepAgg ? enc.aggregate : def.aggregate.default) : 'none';
  return { ...report, chart, enc: { x, y, z, series, color, size, aggregate } };
}

export const newSeries = (field: FieldKey): Series => ({ field, mark: null, axis: 'left', color: null });

export function blankReport(dims: 2 | 3, name: string): Report {
  const base: Report = {
    id: crypto.randomUUID(),
    name,
    chart: 'line',
    enc: { x: 'time', y: 'close', z: 'volume', series: [newSeries('close')], color: null, size: null, aggregate: 'none' },
    where: [],
    style: DEFAULT_STYLE,
    updatedAt: Date.now(),
  };
  return dims === 3 ? switchChart({ ...base, enc: { ...base.enc, x: 'bar' } }, 'scatter3d') : base;
}
