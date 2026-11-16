import { messages } from '../../i18n/I18nProvider';
import { FIELD_BY_KEY, type Dataset, type FieldKey, type FieldKind } from './fields';

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
  /** Order of category bars: their natural order, or largest total first. */
  xOrder: 'natural' | 'value';
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
  /** WHERE as a logical expression over the dataset's datapoints; blank for every row. */
  where: string;
  style: ReportStyle;
  /** Set on built-in templates; editing one saves a copy to My reports. */
  template?: boolean;
  /** Unset means market data. */
  dataset?: Dataset;
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
  xOrder: 'natural',
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

const cartesian = (type: ChartType, mark: Mark, agg: Aggregate): ChartDef => ({
  type,
  get label() { return messages().charts[type].label; },
  dims: 2,
  get description() { return messages().charts[type].description; },
  mark,
  slots: {
    x: { get label() { return messages().slots.xAxis; }, kinds: ANY },
    series: { get label() { return messages().slots.yValues; }, kinds: ['number'] },
    color: { get label() { return messages().slots.splitBy; }, kinds: ['category'], optional: true },
  },
  aggregate: { default: agg },
});

export const CHARTS: readonly ChartDef[] = [
  cartesian('line', 'line', 'none'),
  cartesian('area', 'area', 'none'),
  cartesian('bar', 'bar', 'avg'),
  {
    type: 'scatter',
    get label() { return messages().charts.scatter.label; },
    dims: 2,
    mark: 'scatter',
    get description() { return messages().charts.scatter.description; },
    slots: {
      x: { get label() { return messages().slots.xAxis; }, kinds: ANY },
      series: { get label() { return messages().slots.yValues; }, kinds: ['number'] },
      color: { get label() { return messages().slots.colourBy; }, kinds: ['category', 'number'], optional: true },
      size: { get label() { return messages().slots.sizeBy; }, kinds: ['number'], optional: true },
    },
  },
  {
    type: 'candlestick',
    get label() { return messages().charts.candlestick.label; },
    dims: 2,
    get description() { return messages().charts.candlestick.description; },
    slots: { x: { get label() { return messages().slots.xAxis; }, kinds: ['time', 'category'] } },
  },
  {
    type: 'ohlc',
    get label() { return messages().charts.ohlc.label; },
    dims: 2,
    get description() { return messages().charts.ohlc.description; },
    slots: { x: { get label() { return messages().slots.xAxis; }, kinds: ['time', 'category'] } },
  },
  {
    type: 'histogram',
    get label() { return messages().charts.histogram.label; },
    dims: 2,
    get description() { return messages().charts.histogram.description; },
    slots: {
      x: { get label() { return messages().slots.measure; }, kinds: ['number'] },
      color: { get label() { return messages().slots.splitBy; }, kinds: ['category'], optional: true },
    },
  },
  {
    type: 'box',
    get label() { return messages().charts.box.label; },
    dims: 2,
    get description() { return messages().charts.box.description; },
    slots: {
      series: { get label() { return messages().slots.measures; }, kinds: ['number'] },
      color: { get label() { return messages().slots.groupBy; }, kinds: ['category'], optional: true },
    },
  },
  {
    type: 'heatmap',
    get label() { return messages().charts.heatmap.label; },
    dims: 2,
    get description() { return messages().charts.heatmap.description; },
    slots: {
      x: { get label() { return messages().slots.columns; }, kinds: GRID },
      y: { get label() { return messages().slots.rows; }, kinds: GRID },
      z: { get label() { return messages().slots.cellValue; }, kinds: ['number'] },
    },
    aggregate: { default: 'avg', required: true },
  },
  {
    type: 'scatter3d',
    get label() { return messages().charts.scatter3d.label; },
    dims: 3,
    get description() { return messages().charts.scatter3d.description; },
    slots: {
      x: { get label() { return messages().slots.xAxis; }, kinds: GRID },
      y: { get label() { return messages().slots.yAxis; }, kinds: GRID },
      z: { get label() { return messages().slots.zAxis; }, kinds: ['number'] },
      color: { get label() { return messages().slots.colourBy; }, kinds: ['category', 'number'], optional: true },
      size: { get label() { return messages().slots.sizeBy; }, kinds: ['number'], optional: true },
    },
  },
  {
    type: 'line3d',
    get label() { return messages().charts.line3d.label; },
    dims: 3,
    get description() { return messages().charts.line3d.description; },
    slots: {
      x: { get label() { return messages().slots.xAxis; }, kinds: GRID },
      y: { get label() { return messages().slots.yAxis; }, kinds: GRID },
      z: { get label() { return messages().slots.zAxis; }, kinds: ['number'] },
      color: { get label() { return messages().slots.colourBy; }, kinds: ['number'], optional: true },
    },
  },
  {
    type: 'surface',
    get label() { return messages().charts.surface.label; },
    dims: 3,
    get description() { return messages().charts.surface.description; },
    slots: {
      x: { get label() { return messages().slots.xAxis; }, kinds: GRID },
      y: { get label() { return messages().slots.yAxis; }, kinds: GRID },
      z: { get label() { return messages().slots.height; }, kinds: ['number'] },
    },
    aggregate: { default: 'avg', required: true },
  },
];

export const CHART_BY_TYPE = Object.fromEntries(CHARTS.map((c) => [c.type, c])) as Record<ChartType, ChartDef>;

/** Price charts need open/high/low/close, which only market bars have. */
export const chartsFor = (dataset: Dataset = 'market'): readonly ChartDef[] =>
  dataset === 'market' ? CHARTS : CHARTS.filter((c) => c.type !== 'candlestick' && c.type !== 'ohlc');

/** Per dataset: the measure a new chart plots, the row-order field, and fields to fall back on per slot. */
const DATASET_DEFAULTS: Record<Dataset, { measure: FieldKey; index: FieldKey; second: FieldKey; preferred: Record<'x' | 'y' | 'z', readonly FieldKey[]> }> = {
  market: {
    measure: 'close',
    index: 'bar',
    second: 'close',
    preferred: {
      x: ['time', 'date', 'clock', 'bar', 'changePct', 'close'],
      y: ['clock', 'close', 'hour', 'volume'],
      z: ['volume', 'close', 'changePct'],
    },
  },
  analytics: {
    measure: 'count',
    index: 'seq',
    second: 'hour',
    preferred: {
      x: ['date', 'time', 'clock', 'seq', 'hour'],
      y: ['clock', 'hour', 'seq', 'count'],
      z: ['count', 'duration', 'value'],
    },
  },
};

export const AGGREGATES: readonly { key: Aggregate; label: string }[] = [
  { key: 'none', get label() { return messages().aggregates.none; } },
  { key: 'avg', get label() { return messages().aggregates.avg; } },
  { key: 'sum', get label() { return messages().aggregates.sum; } },
  { key: 'min', get label() { return messages().aggregates.min; } },
  { key: 'max', get label() { return messages().aggregates.max; } },
  { key: 'median', get label() { return messages().aggregates.median; } },
  { key: 'count', get label() { return messages().aggregates.count; } },
  { key: 'first', get label() { return messages().aggregates.first; } },
  { key: 'last', get label() { return messages().aggregates.last; } },
];

export const fits = (rule: SlotRule | undefined, field: FieldKey | null) =>
  !!rule && field !== null && rule.kinds.includes(FIELD_BY_KEY[field].kind);

const pick = (rule: SlotRule | undefined, current: FieldKey, preferred: readonly FieldKey[]): FieldKey =>
  !rule || fits(rule, current) ? current : preferred.find((f) => fits(rule, f)) ?? current;

/**
 * Changes the chart type, keeping every field that still fits and picking sensible ones where not,
 * so switching type is one click and never leaves an empty or broken chart.
 */
export function switchChart(report: Report, chart: ChartType): Report {
  const def = CHART_BY_TYPE[chart];
  const { enc } = report;
  const d = DATASET_DEFAULTS[report.dataset ?? 'market'];
  let series = def.slots.series ? enc.series.filter((s) => fits(def.slots.series, s.field)) : enc.series;
  if (def.slots.series && !series.length) series = [newSeries(d.measure)];
  // Heatmap and surface need two different groupings.
  let x = pick(def.slots.x, enc.x, d.preferred.x);
  let y = pick(def.slots.y, enc.y, d.preferred.y);
  if (chart === 'heatmap' || chart === 'surface') {
    if (!fits(def.slots.x, x) || FIELD_BY_KEY[x].kind === 'number') x = 'date';
    if (!fits(def.slots.y, y) || y === x) y = 'clock';
  }
  if (def.dims === 3 && (chart === 'scatter3d' || chart === 'line3d') && x === y) y = x === d.index ? d.second : d.index;
  const z = pick(def.slots.z, enc.z, d.preferred.z);
  const color = fits(def.slots.color, enc.color) ? enc.color : null;
  const size = fits(def.slots.size, enc.size) ? enc.size : null;
  // Analytics rows are one event each, so grouping them means counting (summing): that's its default.
  const defaultAgg = (a: ChartDef['aggregate']) => (a && report.dataset === 'analytics' ? 'sum' : a?.default);
  const previous = CHART_BY_TYPE[report.chart].aggregate;
  const keepAgg = def.aggregate && previous && enc.aggregate !== defaultAgg(previous) && !(def.aggregate.required && enc.aggregate === 'none');
  const aggregate = def.aggregate ? (keepAgg ? enc.aggregate : defaultAgg(def.aggregate)!) : 'none';
  return { ...report, chart, enc: { x, y, z, series, color, size, aggregate } };
}

export const newSeries = (field: FieldKey): Series => ({ field, mark: null, axis: 'left', color: null });

export function blankReport(dims: 2 | 3, name: string, dataset: Dataset = 'market'): Report {
  if (dataset === 'analytics') {
    const base: Report = {
      id: crypto.randomUUID(),
      name,
      dataset,
      chart: 'bar',
      enc: { x: 'date', y: 'hour', z: 'count', series: [newSeries('count')], color: null, size: null, aggregate: 'sum' },
      where: '',
      style: DEFAULT_STYLE,
      updatedAt: Date.now(),
    };
    return dims === 3 ? switchChart({ ...base, enc: { ...base.enc, x: 'seq', y: 'hour', z: 'duration' } }, 'scatter3d') : base;
  }
  const base: Report = {
    id: crypto.randomUUID(),
    name,
    chart: 'line',
    enc: { x: 'time', y: 'close', z: 'volume', series: [newSeries('close')], color: null, size: null, aggregate: 'none' },
    where: '',
    style: DEFAULT_STYLE,
    updatedAt: Date.now(),
  };
  return dims === 3 ? switchChart({ ...base, enc: { ...base.enc, x: 'bar' } }, 'scatter3d') : base;
}
