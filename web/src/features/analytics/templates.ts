import type { Condition } from '../data-query/query';
import { DEFAULT_STYLE, newSeries, type Encoding, type Report, type ReportStyle } from '../reports/model';

/** Built-in analytics reports. Like the market templates, editing one saves a copy to My reports. */

const enc = (e: Partial<Encoding>): Encoding => ({
  x: 'date',
  y: 'hour',
  z: 'count',
  series: [newSeries('count')],
  color: null,
  size: null,
  aggregate: 'sum',
  ...e,
});

const is = (column: Condition['column'], value: string, operator: Condition['operator'] = '='): Condition => ({
  id: `${column}-${operator}-${value}`,
  column,
  operator,
  value,
});

const template = (
  id: string,
  name: string,
  description: string,
  chart: Report['chart'],
  encoding: Partial<Encoding>,
  where: Condition[] = [],
  style: Partial<ReportStyle> = {},
): Report => ({
  id: `analytics:${id}`,
  name,
  description,
  dataset: 'analytics',
  chart,
  enc: enc(encoding),
  where,
  style: { ...DEFAULT_STYLE, ...style },
  template: true,
  updatedAt: 0,
});

export const ANALYTICS_TEMPLATES: readonly Report[] = [
  template('activity', 'Activity by day', 'Events per day, split by kind of event', 'bar', { x: 'date', color: 'event' }, [], {
    barMode: 'stack',
  }),
  template('top-controls', 'Most used controls', 'Buttons, links, tabs and toggles by clicks', 'bar', { x: 'target', color: 'page' }, [is('event', 'click')], {
    barMode: 'stack',
    xOrder: 'value',
    height: 520,
  }),
  template('report-types', 'Report types used', 'Chart types opened, created or switched to', 'bar', { x: 'detail', color: 'target' }, [is('event', 'report'), is('detail', '(none)', '!=')], {
    barMode: 'stack',
    xOrder: 'value',
    xTitle: 'Chart type',
  }),
  template('exports', 'Exports', 'What was exported, by format and page', 'bar', { x: 'target', color: 'page' }, [is('event', 'export')], {
    barMode: 'stack',
    xOrder: 'value',
    xTitle: 'Format',
  }),
  template('time-on-page', 'Time on each page', 'Total seconds spent on each page', 'bar', { x: 'page', series: [newSeries('duration')] }, [is('event', 'page_view')], {
    xOrder: 'value',
    yTitle: 'Seconds',
  }),
  template('scroll-depth', 'Scroll depth', 'How far down each page people scroll, %', 'box', { series: [newSeries('value')], color: 'page' }, [is('event', 'page_view')], {
    yTitle: 'Scrolled %',
    legend: 'hidden',
  }),
  template('when', 'When the app is used', 'Events by weekday and hour', 'heatmap', { x: 'weekday', y: 'hour', z: 'count', aggregate: 'sum' }, [], {
    colorscale: 'Blues',
    hover: 'closest',
  }),
  template('input', 'Mouse vs keyboard', 'How controls are used, per page', 'bar', { x: 'page', color: 'input' }, [is('event', 'click')], {
    barMode: 'stack',
  }),
  template('symbols', 'Symbols queried', 'Symbols loaded, by interval and range', 'bar', { x: 'subject', color: 'detail' }, [is('event', 'query')], {
    barMode: 'stack',
    xOrder: 'value',
    xTitle: 'Symbol',
  }),
  template('jank', 'Slow frames', 'Moments the UI was blocked for 50ms or more', 'scatter', { x: 'time', series: [newSeries('duration')], color: 'page', aggregate: 'none' }, [is('event', 'long_task')], {
    yTitle: 'Seconds blocked',
    hover: 'closest',
    spikes: false,
  }),
  template('settings', 'Settings changed', 'Themes, light/dark, motion and other settings picked', 'bar', { x: 'detail', color: 'target' }, [is('event', 'setting')], {
    barMode: 'stack',
    xOrder: 'value',
    xTitle: 'Setting',
  }),
  template('environment', 'Devices and browsers', 'Browser, screen, language and preferences seen', 'bar', { x: 'detail', color: 'target' }, [is('event', 'env')], {
    barMode: 'stack',
    height: 520,
  }),
  template('landscape', 'Activity landscape', 'Events as a 3D surface over day and hour', 'surface', { x: 'date', y: 'hour', z: 'count', aggregate: 'sum' }, [], {
    colorscale: 'Viridis',
    height: 560,
  }),
];
