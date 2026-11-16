import type { Operator } from '../data-query/query';
import { DEFAULT_STYLE, newSeries, type Encoding, type Report, type ReportStyle } from '../reports/model';
import { messages, perLocale } from '../../i18n/I18nProvider';
import type { Messages } from '../../i18n/catalogs';

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

/** One comparison of an analytics datapoint against a text value, as WHERE expression text. */
const is = (column: string, value: string, operator: Operator = '='): string =>
  `${column} ${operator} '${value.replaceAll("'", "''")}'`;

/** Several comparisons that must all hold. */
const all = (...parts: string[]) => parts.join(' AND ');

/** Name, description and any axis titles come from the active language's catalog, by template id. */
const template = (
  id: keyof Messages['analyticsTemplates'],
  chart: Report['chart'],
  encoding: Partial<Encoding>,
  where = '',
  style: Partial<ReportStyle> = {},
): Report => {
  const text = (): { name: string; description: string; xTitle?: string; yTitle?: string } => messages().analyticsTemplates[id];
  const localStyle = perLocale((): ReportStyle => {
    const { xTitle, yTitle } = text();
    return { ...DEFAULT_STYLE, ...style, ...(xTitle ? { xTitle } : {}), ...(yTitle ? { yTitle } : {}) };
  });
  return {
    id: `analytics:${id}`,
    get name() {
      return text().name;
    },
    get description() {
      return text().description;
    },
    dataset: 'analytics',
    chart,
    enc: enc(encoding),
    where,
    get style() {
      return localStyle();
    },
    template: true,
    updatedAt: 0,
  };
};

export const ANALYTICS_TEMPLATES: readonly Report[] = [
  template('activity', 'bar', { x: 'date', color: 'event' }, '', {
    barMode: 'stack',
  }),
  template('top-controls', 'bar', { x: 'target', color: 'page' }, is('event', 'click'), {
    barMode: 'stack',
    xOrder: 'value',
    height: 520,
  }),
  template('report-types', 'bar', { x: 'detail', color: 'target' }, all(is('event', 'report'), is('detail', '(none)', '!=')), {
    barMode: 'stack',
    xOrder: 'value',
  }),
  template('exports', 'bar', { x: 'target', color: 'page' }, is('event', 'export'), {
    barMode: 'stack',
    xOrder: 'value',
  }),
  template('time-on-page', 'bar', { x: 'page', series: [newSeries('duration')] }, is('event', 'page_view'), {
    xOrder: 'value',
  }),
  template('scroll-depth', 'box', { series: [newSeries('value')], color: 'page' }, is('event', 'page_view'), {
    legend: 'hidden',
  }),
  template('when', 'heatmap', { x: 'weekday', y: 'hour', z: 'count', aggregate: 'sum' }, '', {
    colorscale: 'Blues',
    hover: 'closest',
  }),
  template('input', 'bar', { x: 'page', color: 'input' }, is('event', 'click'), {
    barMode: 'stack',
  }),
  template('symbols', 'bar', { x: 'subject', color: 'detail' }, is('event', 'query'), {
    barMode: 'stack',
    xOrder: 'value',
  }),
  template('jank', 'scatter', { x: 'time', series: [newSeries('duration')], color: 'page', aggregate: 'none' }, is('event', 'long_task'), {
    hover: 'closest',
    spikes: false,
  }),
  template('settings', 'bar', { x: 'detail', color: 'target' }, is('event', 'setting'), {
    barMode: 'stack',
    xOrder: 'value',
  }),
  template('environment', 'bar', { x: 'detail', color: 'target' }, is('event', 'env'), {
    barMode: 'stack',
    height: 520,
  }),
  template('landscape', 'surface', { x: 'date', y: 'hour', z: 'count', aggregate: 'sum' }, '', {
    colorscale: 'Viridis',
    height: 560,
  }),
];
