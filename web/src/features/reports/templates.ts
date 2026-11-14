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

const template = (
  id: string,
  name: string,
  description: string,
  chart: Report['chart'],
  encoding: Partial<Encoding>,
  style: Partial<ReportStyle> = {},
): Report => ({
  id: `template:${id}`,
  name,
  description,
  chart,
  enc: enc(encoding),
  where: [],
  style: { ...DEFAULT_STYLE, ...style },
  template: true,
  updatedAt: 0,
});

export const TEMPLATES: readonly Report[] = [
  template('price-volume', 'Price & volume', 'Close as a line over volume bars on a second axis', 'line', {
    series: [newSeries('close'), { ...newSeries('volume'), mark: 'bar', axis: 'right' }],
  }, { y2Title: 'Volume', opacity: 0.85 }),
  template('candles', 'Candlesticks', 'Classic OHLC candles with volume underneath', 'candlestick', { x: 'time' }, {
    volumeOverlay: true,
    hover: 'x',
  }),
  template('return', 'Cumulative return', 'Percent change since the first bar shown', 'area', {
    series: [newSeries('return')],
  }, { yFormat: 'percent', opacity: 0.35 }),
  template('intraday-volume', 'Intraday volume profile', 'Average volume at each time of day, by session', 'bar', {
    x: 'clock',
    series: [newSeries('volume')],
    color: 'session',
    aggregate: 'avg',
  }, { barMode: 'stack', yFormat: 'compact' }),
  template('return-dist', 'Move distribution', 'How often each size of bar move happens', 'histogram', {
    x: 'changePct',
    color: 'session',
  }, { barMode: 'overlay', opacity: 0.7, bins: 40 }),
  template('weekday-range', 'Range by weekday', 'Spread of high minus low for each weekday', 'box', {
    series: [newSeries('spreadPct')],
    color: 'weekday',
  }, { yFormat: 'percent', legend: 'hidden' }),
  template('volume-move', 'Volume vs move', 'Do bigger moves come with more volume?', 'scatter', {
    x: 'changePct',
    series: [newSeries('volume')],
    color: 'session',
    size: 'spread',
  }, { yFormat: 'compact', opacity: 0.7, hover: 'closest', spikes: false }),
  template('session-heatmap', 'Session heatmap', 'Average move for each day and time of day', 'heatmap', {
    x: 'date',
    y: 'clock',
    z: 'changePct',
    aggregate: 'avg',
  }, { colorscale: 'RdBu', hover: 'closest' }),
  template('landscape', 'Price landscape', 'Close as a 3D surface over day and time of day', 'surface', {
    x: 'date',
    y: 'clock',
    z: 'close',
    aggregate: 'avg',
  }, { colorscale: 'Viridis', contours: true, height: 560 }),
  template('trade-cloud', 'Trade cloud', 'Every bar placed by time, price and volume', 'scatter3d', {
    x: 'bar',
    y: 'close',
    z: 'volume',
    color: 'changePct',
    size: null,
  }, { colorscale: 'RdBu', markerSize: 4, height: 560, opacity: 0.8 }),
  template('price-path', 'Price path', 'Close and volume traced through time in 3D', 'line3d', {
    x: 'bar',
    y: 'close',
    z: 'volume',
    color: 'return',
  }, { colorscale: 'Portland', lineWidth: 5, height: 560 }),
];

export const TEMPLATE_BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));
