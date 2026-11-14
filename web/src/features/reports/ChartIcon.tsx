import type { ReactNode } from 'react';
import type { ChartType } from './model';

/** Small line glyphs for the chart type picker. Decorative: the button text names the type. */
export function ChartIcon({ type }: { type: ChartType }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[type]}
    </svg>
  );
}

const PATHS: Record<ChartType, ReactNode> = {
  line: <path d="M3 17l5-6 4 3 5-8 4 4" />,
  area: (
    <>
      <path d="M3 17l5-6 4 3 5-8 4 4v10H3z" fill="currentColor" fillOpacity="0.25" />
      <path d="M3 17l5-6 4 3 5-8 4 4" />
    </>
  ),
  bar: <path d="M5 20V12M10 20V6M15 20V10M20 20V4" strokeWidth="3" />,
  scatter: (
    <g fill="currentColor" stroke="none">
      <circle cx="6" cy="16" r="1.8" />
      <circle cx="10" cy="11" r="1.8" />
      <circle cx="14" cy="14" r="1.8" />
      <circle cx="17" cy="7" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </g>
  ),
  candlestick: (
    <>
      <path d="M7 3v18M17 5v14" />
      <rect x="5" y="7" width="4" height="9" fill="currentColor" />
      <rect x="15" y="9" width="4" height="6" />
    </>
  ),
  ohlc: <path d="M7 4v16M4 8h3M7 15h3M17 6v13M14 12h3M17 9h3" />,
  histogram: <path d="M3 20h18M4 20v-5h4v5M8 20V8h4v12M12 20V5h4v15M16 20v-8h4v8" />,
  box: <path d="M7 3v4M7 17v4M4 7h6v10H4zM4 12h6M17 6v3M17 15v3M14 9h6v6h-6zM14 12h6" />,
  heatmap: (
    <g stroke="none" fill="currentColor">
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={3 + c * 6.3} y={3 + r * 6.3} width="5.5" height="5.5" rx="1" opacity={0.25 + ((r + c * 2) % 4) * 0.22} />),
      )}
    </g>
  ),
  scatter3d: (
    <>
      <path d="M4 18l8 3 8-3M12 21V9" strokeOpacity="0.5" />
      <g fill="currentColor" stroke="none">
        <circle cx="7" cy="9" r="1.7" />
        <circle cx="16" cy="6" r="1.7" />
        <circle cx="10" cy="14" r="1.7" />
        <circle cx="17" cy="13" r="1.7" />
      </g>
    </>
  ),
  line3d: (
    <>
      <path d="M4 18l8 3 8-3M12 21V9" strokeOpacity="0.5" />
      <path d="M5 13c3-6 6 2 9-4s4 1 5-3" />
    </>
  ),
  surface: <path d="M3 15c3-4 6-4 9-1s6 3 9-1M3 15l3 5h15l-0-5M6 20c3-4 6-4 9-1s4 1 6 1M5 9c3-4 6-4 9-1s4 2 7-1" />,
};
