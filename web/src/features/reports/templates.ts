import { messages } from '../../i18n/I18nProvider';
import type { Messages } from '../../i18n/catalogs';
import { DEFAULT_STYLE, newSeries, type Encoding, type Report, type ReportStyle } from './model';

/** Built-in starting points. They work on any symbol; editing one saves a copy to My reports. */

const enc = (e: Partial<Encoding>): Encoding => ({
  x: 'time',
  y: 'close',
  z: 'volume',
  series: [newSeries('close')],
  color: null,
  size: null,
  aggregate: 'none',
  ...e,
});

/** Name and description come from the active language's catalog, by template id. */
const template = (
  id: keyof Messages['templates'],
  chart: Report['chart'],
  encoding: Partial<Encoding>,
  style: Partial<ReportStyle> = {},
): Report => ({
  id: `template:${id}`,
  get name() {
    return messages().templates[id].name;
  },
  get description() {
    return messages().templates[id].description;
  },
  chart,
  enc: enc(encoding),
  where: [],
  style: { ...DEFAULT_STYLE, ...style },
  template: true,
  updatedAt: 0,
});

export const TEMPLATES: readonly Report[] = [
  template('price-volume', 'line', {
    series: [newSeries('close'), { ...newSeries('volume'), mark: 'bar', axis: 'right' }],
  }, { opacity: 0.85 }),
  template('candles', 'candlestick', { x: 'time' }, {
    volumeOverlay: true,
    hover: 'x',
  }),
  template('return', 'area', {
    series: [newSeries('return')],
  }, { yFormat: 'percent', opacity: 0.35 }),
  template('intraday-volume', 'bar', {
    x: 'clock',
    series: [newSeries('volume')],
    color: 'session',
    aggregate: 'avg',
  }, { barMode: 'stack', yFormat: 'compact' }),
  template('return-dist', 'histogram', {
    x: 'changePct',
    color: 'session',
  }, { barMode: 'overlay', opacity: 0.7, bins: 40 }),
  template('weekday-range', 'box', {
    series: [newSeries('spreadPct')],
    color: 'weekday',
  }, { yFormat: 'percent', legend: 'hidden' }),
  template('volume-move', 'scatter', {
    x: 'changePct',
    series: [newSeries('volume')],
    color: 'session',
    size: 'spread',
  }, { yFormat: 'compact', opacity: 0.7, hover: 'closest', spikes: false }),
  template('session-heatmap', 'heatmap', {
    x: 'date',
    y: 'clock',
    z: 'changePct',
    aggregate: 'avg',
  }, { colorscale: 'RdBu', hover: 'closest' }),
  template('landscape', 'surface', {
    x: 'date',
    y: 'clock',
    z: 'close',
    aggregate: 'avg',
  }, { colorscale: 'Viridis', contours: true, height: 560 }),
  template('trade-cloud', 'scatter3d', {
    x: 'bar',
    y: 'close',
    z: 'volume',
    color: 'changePct',
    size: null,
  }, { colorscale: 'RdBu', markerSize: 4, height: 560, opacity: 0.8 }),
  template('price-path', 'line3d', {
    x: 'bar',
    y: 'close',
    z: 'volume',
    color: 'return',
  }, { colorscale: 'Portland', lineWidth: 5, height: 560 }),
];

export const TEMPLATE_BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));
