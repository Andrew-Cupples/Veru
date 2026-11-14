import { beforeEach, describe, expect, it } from 'vitest';
import type { PriceBar } from '../../api/client';
import { toRows } from '../data-query/query';
import { toReportRows } from './fields';
import { buildFigure, type ThemeColors } from './figure';
import { CHARTS, CHART_BY_TYPE, blankReport, fits, newSeries, switchChart, type Report } from './model';
import { aggregate, shape } from './shape';
import { loadReports, parseReport, saveReports } from './storage';
import { TEMPLATES } from './templates';

const bar = (time: string, open: number, close: number, volume: number, session: PriceBar['session'] = 'regular'): PriceBar => ({
  time,
  open,
  high: Math.max(open, close) + 1,
  low: Math.min(open, close) - 1,
  close,
  volume,
  session,
});

const bars: PriceBar[] = [
  bar('2026-11-12T09:30:00-05:00', 10, 11, 100),
  bar('2026-11-12T09:45:00-05:00', 11, 12, 300),
  bar('2026-11-13T09:30:00-05:00', 12, 9, 200),
  bar('2026-11-13T16:00:00-05:00', 9, 10, 50, 'post'),
];
const rows = toReportRows(toRows(bars));

const report = (patch: Omit<Partial<Report>, 'enc'> & { enc?: Partial<Report['enc']> } = {}): Report => {
  const base = blankReport(2, 'Test');
  return { ...base, ...patch, enc: { ...base.enc, ...patch.enc } };
};

const colors: ThemeColors = {
  ink: '#111111', inkMuted: '#555555', inkFaint: '#999999', rule: '#eeeeee', ruleStrong: '#cccccc',
  surface: '#fafafa', surfaceRaised: '#ffffff', accent: '#0055cc', keyword: '#7a3cc4', up: '#118844',
  down: '#cc2222', pre: '#aa6600', post: '#3355aa', warning: '#aa7700', fontFamily: 'sans-serif',
};

describe('derived fields', () => {
  it('computes weekday, change and return from the first bar shown', () => {
    expect(rows[0]).toMatchObject({ bar: 0, weekday: 'Thu', hour: 9, change: 1, changePct: 10, return: 0 });
    expect(rows[2]).toMatchObject({ weekday: 'Fri', change: -3, return: -18.1818 });
  });
});

describe('aggregate', () => {
  it.each([
    ['sum', 6], ['avg', 2], ['min', 1], ['max', 3], ['median', 2], ['count', 3], ['first', 1], ['last', 2],
  ] as const)('%s', (how, expected) => expect(aggregate([1, 3, 2], how)).toBe(expected));
});

describe('shape', () => {
  it('groups bars per x and aggregates each series', () => {
    const s = shape(rows, report({ chart: 'bar', enc: { x: 'date', series: [newSeries('volume')], aggregate: 'sum' } }));
    expect(s.kind).toBe('cartesian');
    if (s.kind !== 'cartesian') return;
    expect(s.traces[0]).toMatchObject({ x: ['2026-11-12', '2026-11-13'], y: [400, 250], mark: 'bar' });
  });

  it('splits series by a category in its natural order', () => {
    const s = shape(rows, report({ enc: { color: 'session' } }));
    if (s.kind !== 'cartesian') throw new Error();
    expect(s.traces.map((t) => t.name)).toEqual(['regular', 'post']);
  });

  it('builds a day × time-of-day grid with gaps as null', () => {
    const s = shape(rows, report({ chart: 'heatmap', enc: { x: 'date', y: 'clock', z: 'close', aggregate: 'avg' } }));
    if (s.kind !== 'grid') throw new Error();
    expect(s.xLabels).toEqual(['2026-11-12', '2026-11-13']);
    expect(s.yLabels).toEqual(['09:30', '09:45', '16:00']);
    expect(s.z).toEqual([[11, 9], [12, null], [null, 10]]);
  });

  it('maps category axes to positions in 3D', () => {
    const s = shape(rows, report({ chart: 'scatter3d', enc: { x: 'date', y: 'close', z: 'volume' } }));
    if (s.kind !== 'points3d') throw new Error();
    expect(s.axes.x.labels).toEqual(['2026-11-12', '2026-11-13']);
    expect(s.traces[0]!.x).toEqual([0, 0, 1, 1]);
  });
});

describe('switchChart', () => {
  it('keeps fitting fields and fills the rest for every chart type, from every chart type', () => {
    for (const from of CHARTS) {
      const start = switchChart(blankReport(2, 'x'), from.type);
      for (const to of CHARTS) {
        const r = switchChart(start, to.type);
        const def = CHART_BY_TYPE[to.type];
        for (const slot of ['x', 'y', 'z'] as const) if (def.slots[slot]) expect(fits(def.slots[slot], r.enc[slot])).toBe(true);
        if (def.slots.series) expect(r.enc.series.length).toBeGreaterThan(0);
        if (def.aggregate?.required) expect(r.enc.aggregate).not.toBe('none');
        expect(() => buildFigure(shape(rows, r), r, colors)).not.toThrow();
      }
    }
  });
});

describe('templates', () => {
  it.each(TEMPLATES.map((t) => [t.name, t]))('%s fits its chart and draws', (_, t) => {
    const def = CHART_BY_TYPE[t.chart];
    for (const slot of ['x', 'y', 'z'] as const) if (def.slots[slot]) expect(fits(def.slots[slot], t.enc[slot])).toBe(true);
    const figure = buildFigure(shape(rows, t), t, colors);
    expect(figure.data.length).toBeGreaterThan(0);
  });
});

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips reports and fills in style options added later', () => {
    const r = report({ name: 'Mine' });
    saveReports([r]);
    expect(loadReports()).toEqual([{ ...r, description: undefined }]);
    const { lineWidth: _omit, ...oldStyle } = r.style;
    void _omit;
    expect(parseReport({ ...r, style: oldStyle })?.style.lineWidth).toBe(2);
  });

  it('drops reports it cannot read', () => {
    localStorage.setItem('veru.reports.mine', JSON.stringify([{ id: 'x', name: 'Bad', chart: 'pie' }, report()]));
    expect(loadReports()).toHaveLength(1);
  });
});
