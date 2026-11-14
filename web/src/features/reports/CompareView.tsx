import { useEffect, useMemo, useRef, useState } from 'react';
import { useMotion } from '../../motion/MotionProvider';
import { createSyncBus, type ChartSync } from './chartSync';
import type { ThemeColors } from './figure';
import { CHART_BY_TYPE, type Report } from './model';
import { PlotlyChart } from './PlotlyChart';
import type { Shaped } from './shape';
import styles from './Reports.module.css';
import dq from '../data-query/DataQuery.module.css';

export interface CompareItem {
  report: Report;
  /** Null when there's nothing to draw; `message` says why. */
  shaped: Shaped | null;
  message?: string;
  label: string;
}

interface Props {
  items: readonly CompareItem[];
  colors: ThemeColors;
  onOpen: (id: string) => void;
  onUnpin: (id: string) => void;
}

/** Compact charts, two per row; the page scrolls as more are added. */
const COMPARE_HEIGHT = 300;

/**
 * Pinned reports side by side on the same data. 2D charts along the same x share a crosshair (hover one,
 * see that moment on all) and zoom together; others sit alongside without linking.
 */
export function CompareView({ items, colors, onOpen, onUnpin }: Props) {
  const [bus] = useState(createSyncBus);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const { enabled: motion, duration } = useMotion();

  const syncs = useMemo(() => {
    const map = new Map<string, ChartSync>();
    for (const { report: r, shaped } of items) {
      const linked = shaped?.kind === 'cartesian' || shaped?.kind === 'ohlc';
      map.set(r.id, {
        bus,
        id: r.id,
        hoverKey: linked ? `x:${r.enc.x}` : null,
        rangeKey: linked ? `x:${r.enc.x}|${JSON.stringify(r.where)}|${r.style.skipGaps}` : null,
      });
    }
    return map;
  }, [items, bus]);

  // Compact copies of each report, so the grid fits; the saved reports keep their own heights.
  const compact = useMemo(
    () => new Map(items.map(({ report: r }) => [r.id, { ...r, style: { ...r.style, height: COMPARE_HEIGHT } }])),
    [items],
  );

  // On arrival: land focus on the heading (screen readers hear where they are), and let the cards
  // drift in one after another.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    if (!motion) return;
    const cards = gridRef.current?.querySelectorAll<HTMLElement>(`.${styles.compareCard}`) ?? [];
    cards.forEach((card, i) =>
      card.animate?.([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], {
        duration,
        delay: Math.min(i, 5) * 60, // cap the stagger so long grids still arrive quickly
        easing: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
        fill: 'backwards',
      }),
    );
    // Only on arrival, not on every data change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const linkedCount = [...syncs.values()].filter((s) => s.hoverKey).length;

  return (
    <section className={styles.compare} aria-labelledby="compare-heading">
      <div className={styles.compareHead}>
        <h2 id="compare-heading" ref={headingRef} tabIndex={-1}>
          Comparing {items.length} reports
        </h2>
        {linkedCount > 1 && <p className={styles.compareHint}>Charts along the same axis share a crosshair and zoom together.</p>}
      </div>
      <div ref={gridRef} className={styles.compareGrid} data-count={items.length}>
        {items.map(({ report: r, shaped, message, label }) => (
          <article key={r.id} className={styles.compareCard} aria-labelledby={`cmp-${r.id}`}>
            <header className={styles.compareCardHead}>
              <div className={styles.libraryText}>
                <h3 id={`cmp-${r.id}`} className={styles.libraryName}>
                  {r.name}
                </h3>
                <span className={styles.libraryMeta}>
                  {CHART_BY_TYPE[r.chart].label} · {CHART_BY_TYPE[r.chart].dims}D
                </span>
              </div>
              <button type="button" className={dq.linkButton} onClick={() => onOpen(r.id)}>
                Open
              </button>
              <button type="button" className={dq.iconButton} aria-label={`Remove ${r.name} from comparison`} onClick={() => onUnpin(r.id)}>
                ×
              </button>
            </header>
            {shaped ? (
              <PlotlyChart shaped={shaped} report={compact.get(r.id)!} colors={colors} label={label} sync={syncs.get(r.id)} />
            ) : (
              <div className={dq.empty}>{message}</div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
