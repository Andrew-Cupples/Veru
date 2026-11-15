import { beforeEach, describe, expect, it, vi } from 'vitest';
import { filterRows } from '../features/data-query/query';
import { ANALYTICS_TEMPLATES } from '../features/analytics/templates';
import { buildFigure, type ThemeColors } from '../features/reports/figure';
import { CHART_BY_TYPE, blankReport, chartsFor, fits, switchChart } from '../features/reports/model';
import { aggregate, shape } from '../features/reports/shape';
import { controlName } from './autoTrack';
import { pageLabel, toAnalyticsRows } from './rows';
import { MAX_EVENTS, clearEvents, getEvents, resetForTests, save, setPage, setPaused, track, type AnalyticsEvent } from './tracker';

const colors: ThemeColors = {
  ink: '#111111', inkMuted: '#555555', inkFaint: '#999999', rule: '#eeeeee', ruleStrong: '#cccccc',
  surface: '#fafafa', surfaceRaised: '#ffffff', accent: '#0055cc', keyword: '#7a3cc4', up: '#118844',
  down: '#cc2222', pre: '#aa6600', post: '#3355aa', warning: '#aa7700', fontFamily: 'sans-serif',
};

const event = (n: number, patch: Partial<AnalyticsEvent> = {}): AnalyticsEvent => ({
  n,
  t: new Date(2026, 10, 13, 9 + (n % 3), n % 60, 5).getTime(),
  kind: 'click',
  page: n % 2 ? 'Reports' : 'Raw data',
  target: n % 3 ? 'PNG' : 'Run',
  detail: 'button',
  subject: '',
  input: n % 4 ? 'mouse' : 'keyboard',
  visit: 1 + (n % 2),
  duration: null,
  value: null,
  ...patch,
});

const sample: AnalyticsEvent[] = [
  ...Array.from({ length: 12 }, (_, i) => event(i + 1)),
  event(13, { kind: 'page_view', target: '', detail: '', duration: 42.5, value: 80 }),
  event(14, { kind: 'page_view', page: 'Analytics', target: '', detail: '', duration: 10, value: 100 }),
  event(15, { kind: 'query', target: 'run', subject: 'TSLA', detail: '15m · 1mo' }),
  event(16, { kind: 'export', target: 'CSV', detail: 'Line', subject: 'Price & volume' }),
  event(17, { kind: 'report', target: 'open', detail: 'Candlestick', subject: 'Candlesticks (template)' }),
  event(18, { kind: 'long_task', target: '', detail: '', duration: 0.08 }),
  event(19, { kind: 'setting', target: 'theme', detail: 'tidepool' }),
  event(20, { kind: 'copy', target: 'selection', detail: '', value: 12 }),
  event(21, { kind: 'env', target: 'browser', detail: 'Chrome' }),
];
const rows = toAnalyticsRows(sample);

describe('tracker', () => {
  beforeEach(() => {
    localStorage.clear();
    resetForTests();
  });

  it('records events with the current page and keeps them in storage', () => {
    setPage('Reports');
    track('click', { target: 'PNG', detail: 'button', input: 'mouse' });
    track('export', { target: 'PNG', page: 'Analytics' });
    const [a, b] = getEvents();
    expect(a).toMatchObject({ n: 1, kind: 'click', page: 'Reports', target: 'PNG', input: 'mouse' });
    expect(b).toMatchObject({ n: 2, kind: 'export', page: 'Analytics' });

    save();
    resetForTests();
    expect(getEvents().map((e) => e.target)).toEqual(['PNG', 'PNG']);
    // Numbering carries on after a reload.
    track('click');
    expect(getEvents().at(-1)?.n).toBe(3);
  });

  it('records nothing while paused, and remembers being paused', () => {
    setPaused(true);
    const before = getEvents().length;
    track('click', { target: 'ignored' });
    expect(getEvents()).toHaveLength(before);
    expect(getEvents().some((e) => e.target === 'ignored')).toBe(false);
    expect(localStorage.getItem('veru.analytics.paused')).toBe('true');
  });

  it('keeps only the latest events past the cap', () => {
    for (let i = 0; i < MAX_EVENTS * 1.1 + 1; i++) track('click');
    const all = getEvents();
    expect(all.length).toBeLessThanOrEqual(MAX_EVENTS * 1.1);
    expect(all.at(-1)!.n).toBe(Math.floor(MAX_EVENTS * 1.1) + 1);
  });

  it('clears everything', () => {
    track('click');
    clearEvents();
    expect(getEvents()).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem('veru.analytics.events')!)).toEqual([]);
  });

  it('skips stored entries it cannot read', () => {
    localStorage.setItem('veru.analytics.events', JSON.stringify([[1, 0, 'nonsense'], [2, 5, 'click', 'Reports', 'Run', '', '', 'mouse', 1, null, null]]));
    expect(getEvents().map((e) => e.n)).toEqual([2]);
  });

  it('clips long names', () => {
    track('click', { target: 'x'.repeat(500) });
    expect(getEvents()[0]!.target.length).toBe(80);
  });
});

describe('rows', () => {
  it('derives local time fields', () => {
    const r = toAnalyticsRows([event(1, { t: new Date(2026, 10, 13, 9, 5, 7).getTime() })])[0]!;
    expect(r).toMatchObject({ time: '2026-11-13T09:05:07', date: '2026-11-13', clock: '09:05', weekday: 'Fri', hour: 9, count: 1, visit: '#2' });
  });

  it('labels pages by their nav name', () => {
    expect(pageLabel('/')).toBe('Start');
    expect(pageLabel('/raw-data')).toBe('Raw data');
    expect(pageLabel('/reports')).toBe('Reports');
    expect(pageLabel('/analytics')).toBe('Analytics');
  });

  it('is filtered by WHERE like any other rows', () => {
    const clicks = filterRows(rows, [{ id: '1', column: 'event', operator: '=', value: 'click' }]);
    expect(clicks).toHaveLength(12);
    const slow = filterRows(rows, [{ id: '1', column: 'duration', operator: '>', value: '1' }]);
    expect(slow.map((r) => r.event)).toEqual(['page_view', 'page_view']);
  });
});

describe('charts on analytics', () => {
  it('counts events by summing', () => {
    const r = blankReport(2, 'Clicks', 'analytics');
    const s = shape(filterRows(rows, [{ id: '1', column: 'event', operator: '=', value: 'click' }]), { ...r, enc: { ...r.enc, x: 'target' } });
    if (s.kind !== 'cartesian') throw new Error('expected cartesian');
    expect(Object.fromEntries(s.traces[0]!.x.map((x, i) => [x, s.traces[0]!.y[i]]))).toEqual({ PNG: 8, Run: 4 });
  });

  it('ignores missing values when combining', () => {
    expect(aggregate([1, NaN, 3], 'avg')).toBe(2);
    expect(aggregate([NaN], 'sum')).toBeNaN();
  });

  it('offers no price charts and switches with analytics fields', () => {
    expect(chartsFor('analytics').map((c) => c.type)).not.toContain('candlestick');
    const r = switchChart(blankReport(2, 'x', 'analytics'), 'heatmap');
    expect(r.enc.aggregate).toBe('sum');
    const three = blankReport(3, 'x', 'analytics');
    expect(three.enc.x).not.toBe(three.enc.y);
  });

  it('orders category bars largest first when asked', () => {
    const t = ANALYTICS_TEMPLATES.find((x) => x.id === 'analytics:top-controls')!;
    const figure = buildFigure(shape(filterRows(rows, t.where), t), t, colors);
    expect((figure.layout.xaxis as { categoryarray: string[] }).categoryarray).toEqual(['PNG', 'Run']);
  });

  it.each(ANALYTICS_TEMPLATES.map((t) => [t.name, t]))('%s fits its chart and draws', (_, t) => {
    const def = CHART_BY_TYPE[t.chart];
    for (const slot of ['x', 'y', 'z'] as const) if (def.slots[slot]) expect(fits(def.slots[slot], t.enc[slot])).toBe(true);
    const figure = buildFigure(shape(filterRows(rows, t.where), t), t, colors);
    expect(figure.data.length).toBeGreaterThan(0);
  });
});

describe('control names', () => {
  it('prefers an explicit name, then the accessible name, then the text', () => {
    document.body.innerHTML = `
      <button id="a" data-track="Export PNG" aria-label="ignored">PNG</button>
      <button id="b" aria-label="Export image as SVG">SVG</button>
      <span id="l">Report name</span><input id="c" aria-labelledby="l">
      <button id="d">
        Duplicate
      </button>`;
    const name = (id: string) => controlName(document.getElementById(id)!);
    expect([name('a'), name('b'), name('c'), name('d')]).toEqual(['Export PNG', 'Export image as SVG', 'Report name', 'Duplicate']);
  });

  it('keeps separate pieces of text apart and skips screen-reader-only text', () => {
    document.body.innerHTML = `<button id="x"><span>Bar</span><span class="sr-only">, 2D</span><span>Chart</span><span aria-hidden="true">+</span></button>`;
    expect(controlName(document.getElementById('x')!)).toBe('Bar Chart');
  });

  it('never reads what was typed', () => {
    document.body.innerHTML = `<input id="i" value="secret">`;
    const input = document.getElementById('i') as HTMLInputElement;
    expect(controlName(input)).not.toContain('secret');
    vi.restoreAllMocks();
  });
});
