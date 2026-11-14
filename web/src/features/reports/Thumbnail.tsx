import type { Thumb } from './thumbGeometry';
import styles from './Reports.module.css';

const W = 56;
const H = 34;
const PAD = 3;

const px = (x: number) => PAD + x * (W - PAD * 2);
const py = (y: number) => H - PAD - y * (H - PAD * 2);

/**
 * A live miniature of a report's chart, in the item's text colour. Decorative (the item's text names
 * the report and its chart type), so it's hidden from assistive tech.
 */
export function Thumbnail({ thumb }: { thumb: Thumb }) {
  return (
    <svg className={styles.thumbnail} viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" focusable="false">
      {marks(thumb)}
    </svg>
  );
}

function marks(t: Thumb) {
  switch (t.kind) {
    case 'line': {
      const d = t.points.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)},${py(y).toFixed(1)}`).join('');
      const first = t.points[0];
      const last = t.points[t.points.length - 1];
      return (
        <>
          {t.area && first && last && (
            <path d={`${d}L${px(last[0]).toFixed(1)},${H - PAD}L${px(first[0]).toFixed(1)},${H - PAD}Z`} fill="currentColor" fillOpacity="0.18" />
          )}
          <path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
        </>
      );
    }
    case 'bars':
      return t.bars.map((b, i) => {
        const gap = Math.min(1, (b.w * (W - PAD * 2)) * 0.25);
        return (
          <rect
            key={i}
            x={px(b.x) + gap / 2}
            y={py(b.y1)}
            width={Math.max(0.8, b.w * (W - PAD * 2) - gap)}
            height={Math.max(0.6, py(b.y0) - py(b.y1))}
            fill="currentColor"
            fillOpacity="0.6"
            rx="0.6"
          />
        );
      });
    case 'candles':
      return t.candles.map((c, i) => {
        const cx = px(c.x + c.w / 2);
        const bodyW = Math.max(1, c.w * (W - PAD * 2) * 0.6);
        const up = c.close >= c.open;
        const top = py(Math.max(c.open, c.close));
        return (
          <g key={i}>
            <line x1={cx} x2={cx} y1={py(c.high)} y2={py(c.low)} stroke="currentColor" strokeWidth="0.8" />
            {/* Up candles hollow, down candles filled: readable without colour. */}
            <rect
              x={cx - bodyW / 2}
              y={top}
              width={bodyW}
              height={Math.max(0.8, py(Math.min(c.open, c.close)) - top)}
              fill={up ? 'var(--surface)' : 'currentColor'}
              stroke="currentColor"
              strokeWidth="0.7"
            />
          </g>
        );
      });
    case 'dots':
      return t.points.map(([x, y], i) => <circle key={i} cx={px(x)} cy={py(y)} r="1.1" fill="currentColor" fillOpacity="0.7" />);
    case 'cells': {
      const cw = (W - PAD * 2) / t.cols;
      const ch = (H - PAD * 2) / t.rows;
      return t.values.flatMap((row, r) =>
        row.map((v, c) =>
          v === null ? null : (
            <rect key={`${r}-${c}`} x={PAD + c * cw} y={PAD + r * ch} width={cw - 0.6} height={ch - 0.6} fill="currentColor" fillOpacity={0.12 + v * 0.75} />
          ),
        ),
      );
    }
  }
}
