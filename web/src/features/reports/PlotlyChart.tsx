import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { buildFigure, type ThemeColors } from './figure';
import type { Report } from './model';
import type { Shaped } from './shape';
import styles from './Reports.module.css';

type PlotlyModule = typeof import('plotly.js-dist-min').default;

// Plotly is large, so it loads on first use of Reports and is shared after that.
let plotlyPromise: Promise<PlotlyModule> | null = null;
const loadPlotly = () => (plotlyPromise ??= import('plotly.js-dist-min').then((m) => m.default));

export interface ChartHandle {
  download: (format: 'png' | 'svg', filename: string) => void;
}

interface Props {
  shaped: Shaped;
  report: Report;
  colors: ThemeColors;
  /** Accessible name: the plot is a picture to assistive tech; its numbers are in the data table. */
  label: string;
  ref?: Ref<ChartHandle>;
}

export function PlotlyChart({ shaped, report, colors, label, ref }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

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
  }, [shaped, report, colors]);

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
