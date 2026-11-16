import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { buildFigure, type ThemeColors } from './figure';
import type { Report } from './model';
import { pointIndexAt, relayoutRange, type ChartSync } from './chartSync';
import type { Shaped } from './shape';
import { currentLocale, useI18n } from '../../i18n/I18nProvider';
import styles from './Reports.module.css';

type PlotlyModule = typeof import('plotly.js-dist-min').default;

// Plotly is large, so it loads on first use of Reports and is shared after that.
let plotlyPromise: Promise<PlotlyModule> | null = null;
const loadPlotly = () => (plotlyPromise ??= import('plotly.js-dist-min').then((m) => m.default));

/*
 * Dates and numbers inside charts in the app's language: month and day names come from the browser's own
 * Intl data, so no Plotly locale bundles are needed. Registered once per language, on first use.
 */
const registered = new Set<string>();
function plotlyLocale(Plotly: PlotlyModule): string {
  const locale = currentLocale();
  if (!registered.has(locale)) {
    const names = (options: Intl.DateTimeFormatOptions, count: number, at: (i: number) => number) =>
      Array.from({ length: count }, (_, i) => new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(at(i)));
    // 2023-01-01 was a Sunday, which is where Plotly's day lists start.
    const day = (i: number) => Date.UTC(2023, 0, 1 + i);
    const month = (i: number) => Date.UTC(2023, i, 1);
    const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
    Plotly.register({
      moduleType: 'locale',
      name: locale,
      dictionary: {},
      format: {
        days: names({ weekday: 'long' }, 7, day),
        shortDays: names({ weekday: 'short' }, 7, day),
        months: names({ month: 'long' }, 12, month),
        shortMonths: names({ month: 'short' }, 12, month),
        // d3's time formatter maps over every list here: a missing one breaks any date axis.
        periods: [Date.UTC(2023, 0, 1, 9), Date.UTC(2023, 0, 1, 21)].map(
          (at) =>
            new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: true, timeZone: 'UTC' }).formatToParts(at).find((p) => p.type === 'dayPeriod')?.value ?? '',
        ),
        dateTime: '%x, %X',
        date: '%-m/%-d/%Y',
        time: '%H:%M:%S',
        grouping: [3],
        currency: ['$', ''],
        decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
        thousands: parts.find((p) => p.type === 'group')?.value ?? ',',
      },
    });
    registered.add(locale);
  }
  return locale;
}

export interface ChartHandle {
  download: (format: 'png' | 'svg', filename: string) => void;
}

interface Props {
  shaped: Shaped;
  report: Report;
  colors: ThemeColors;
  /** Accessible name: the plot is a picture to assistive tech; its numbers are in the data table. */
  label: string;
  /** In the compare view: share the crosshair and x range with the other charts. */
  sync?: ChartSync;
  ref?: Ref<ChartHandle>;
}

export function PlotlyChart({ shaped, report, colors, label, sync, ref }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Redraws in the new language's month names and number style.
  const { locale } = useI18n();

  useEffect(() => {
    const gd = host.current as PlotlyElement | null;
    if (!sync || !loaded || !gd || typeof gd.on !== 'function') return;
    const { bus, id, hoverKey, rangeKey } = sync;
    // Set while applying another chart's event, so this chart doesn't echo it back.
    let applying = false;

    const onHover = (e: { points?: { x?: string | number }[] }) => {
      const x = e.points?.[0]?.x;
      if (!applying && hoverKey && x !== undefined) bus.emit({ type: 'hover', from: id, key: hoverKey, x });
    };
    const onUnhover = () => {
      if (!applying) bus.emit({ type: 'unhover', from: id });
    };
    const onRelayout = (e: Record<string, unknown>) => {
      const range = relayoutRange(e);
      if (!applying && rangeKey && range !== undefined) bus.emit({ type: 'range', from: id, key: rangeKey, range });
    };
    gd.on('plotly_hover', onHover);
    gd.on('plotly_unhover', onUnhover);
    gd.on('plotly_relayout', onRelayout);

    const unsubscribe = bus.subscribe((event) => {
      if (event.from === id) return;
      void loadPlotly().then((Plotly) => {
        if (event.type === 'hover') {
          if (event.key !== hoverKey) return;
          const i = pointIndexAt(gd.data?.[0]?.x, event.x);
          applying = true;
          if (i < 0) Plotly.Fx.unhover(gd);
          else Plotly.Fx.hover(gd, [{ curveNumber: 0, pointNumber: i }], 'xy', true);
          applying = false;
        } else if (event.type === 'unhover') {
          applying = true;
          Plotly.Fx.unhover(gd);
          applying = false;
        } else if (event.key === rangeKey) {
          applying = true;
          void Plotly.relayout(gd, event.range ? { 'xaxis.range': event.range } : { 'xaxis.autorange': true }).finally(() => {
            applying = false;
          });
        }
      });
    });

    return () => {
      unsubscribe();
      gd.removeListener('plotly_hover', onHover);
      gd.removeListener('plotly_unhover', onUnhover);
      gd.removeListener('plotly_relayout', onRelayout);
    };
  }, [sync, loaded]);

  useImperativeHandle(ref, () => ({
    download: (format, filename) => {
      const el = host.current;
      if (!el) return;
      void loadPlotly().then((Plotly) =>
        Plotly.downloadImage(el, { format, filename, width: el.clientWidth, height: report.style.height, scale: format === 'png' ? 2 : 1 }),
      );
    },
  }));

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    loadPlotly()
      .then((Plotly) => {
        if (cancelled) return;
        const figure = buildFigure(shaped, report, colors);
        return Plotly.react(el, figure.data, figure.layout, {
          responsive: true,
          displaylogo: false,
          displayModeBar: 'hover',
          locale: plotlyLocale(Plotly),
          modeBarButtonsToRemove: ['sendDataToCloud', 'lasso2d', 'select2d', 'toImage'],
        }).then(() => {
          if (!cancelled) setLoaded(true);
        });
      })
      .catch((error: unknown) => {
        console.error('Chart failed to draw', error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [shaped, report, colors, locale]);

  // Panels opening and closing change the width without a window resize.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (el.querySelector('.plot-container')) void loadPlotly().then((Plotly) => Plotly.Plots.resize(el));
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      void loadPlotly().then((Plotly) => Plotly.purge(el));
    };
  }, []);

  if (failed) {
    return (
      <div className={styles.chartMessage} role="alert">
        The charting library failed to load. Reload the page to try again.
      </div>
    );
  }

  return (
    <div className={styles.chartFrame} style={{ minHeight: report.style.height }}>
      {!loaded && (
        <div className={styles.chartMessage} aria-hidden="true">
          Drawing chart…
        </div>
      )}
      <div ref={host} className={styles.chart} role="img" aria-label={label} />
    </div>
  );
}
