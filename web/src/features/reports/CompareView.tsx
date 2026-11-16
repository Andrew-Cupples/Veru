import { useEffect, useMemo, useRef, useState } from 'react';
import { useMotion } from '../../motion/MotionProvider';
import { createSyncBus, type ChartSync } from './chartSync';
import type { ThemeColors } from './figure';
import { CHART_BY_TYPE, type Report } from './model';
import { PlotlyChart } from './PlotlyChart';
import type { Shaped } from './shape';
import { useT } from '../../i18n/I18nProvider';
import styles from './Reports.module.css';
import dq from '../data-query/DataQuery.module.css';

export interface CompareItem {
  /** Unique per card: the report id, plus the stock when comparing stocks. */
  key: string;
  report: Report;
  /** Which stock this card draws, on the Compare page; null where the page has one data set (Analytics). */
  symbol: string | null;
  /** Null when there's nothing to draw; `message` says why. */
  shaped: Shaped | null;
  message?: string;
  label: string;
}

/**
 * none: one card per report, each with its own header (Analytics).
 * report: a row of stocks under each report. stock: a row of reports under each stock.
 */
export type CompareGrouping = 'none' | 'report' | 'stock';

interface Props {
  items: readonly CompareItem[];
  colors: ThemeColors;
  heading: string;
  groupBy?: CompareGrouping;
  /** Display names for stocks, shown next to the ticker. */
  names?: Readonly<Record<string, string>>;
  /** Opens a card's report (on its stock, where there is one) in the editor. */
  onOpen: (item: CompareItem) => void;
  onRemoveReport: (id: string) => void;
  onRemoveStock?: (symbol: string) => void;
  /** Move focus to the heading on arrival (when the view replaces what had focus). Default true. */
  autoFocus?: boolean;
}

/** Compact charts, two per row; the page scrolls as more are added. */
const COMPARE_HEIGHT = 300;

/**
 * Charts side by side. 2D charts along the same x share a crosshair (hover one, see that moment on all) and
 * zoom together; others sit alongside without linking. Grouped, each report (or stock) gets its own row.
 */
export function CompareView({ items, colors, heading, groupBy = 'none', names = {}, onOpen, onRemoveReport, onRemoveStock, autoFocus = true }: Props) {
  const [bus] = useState(createSyncBus);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const { enabled: motion, duration } = useMotion();

  const syncs = useMemo(() => {
    const map = new Map<string, ChartSync>();
    for (const { key, report: r, shaped } of items) {
      const linked = shaped?.kind === 'cartesian' || shaped?.kind === 'ohlc';
      map.set(key, {
        bus,
        id: key,
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

  const groups = useMemo(() => {
    if (groupBy === 'none') return [];
    const byKey = new Map<string, CompareItem[]>();
    for (const item of items) {
      const k = groupBy === 'report' ? item.report.id : (item.symbol ?? '');
      byKey.set(k, [...(byKey.get(k) ?? []), item]);
    }
    return [...byKey.entries()];
  }, [items, groupBy]);

  // On arrival: land focus on the heading (screen readers hear where they are), and let the cards
  // drift in one after another.
  useEffect(() => {
    if (autoFocus) headingRef.current?.focus({ preventScroll: true });
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

  const t = useT();
  const linkedCount = [...syncs.values()].filter((s) => s.hoverKey).length;

  const chart = (item: CompareItem) =>
    item.shaped ? (
      <PlotlyChart shaped={item.shaped} report={compact.get(item.report.id)!} colors={colors} label={item.label} sync={syncs.get(item.key)} />
    ) : (
      <div className={dq.empty}>{item.message}</div>
    );

  const reportMeta = (r: Report) => `${CHART_BY_TYPE[r.chart].label} · ${CHART_BY_TYPE[r.chart].dims}D`;
  const openLabel = (item: CompareItem) => t.compare.openLabel(item.report.name, item.symbol);

  /** A card inside a group: titled by what varies along the row (the stock, or the report). */
  const groupedCard = (item: CompareItem) => {
    const title = groupBy === 'report' ? item.symbol : item.report.name;
    const meta = groupBy === 'report' ? (item.symbol ? names[item.symbol] : '') : reportMeta(item.report);
    const context = groupBy === 'report' ? item.report.name : item.symbol;
    return (
      <article key={item.key} className={styles.compareCard} aria-labelledby={`cmp-${item.key}`}>
        <header className={styles.compareSymbolHead}>
          <h4 id={`cmp-${item.key}`} className={groupBy === 'report' ? styles.compareSymbol : styles.compareReportName}>
            <span className="sr-only">{context}, </span>
            <span translate={groupBy === 'report' ? 'no' : undefined}>{title}</span>
          </h4>
          <span className={styles.libraryMeta}>{meta ?? ''}</span>
          <button type="button" className={`${dq.linkButton} ${styles.compareOpen}`} aria-label={openLabel(item)} onClick={() => onOpen(item)}>
            {t.common.open}
          </button>
        </header>
        {chart(item)}
      </article>
    );
  };

  return (
    <section className={styles.compare} aria-labelledby="compare-heading">
      <div className={styles.compareHead}>
        <h2 id="compare-heading" ref={headingRef} tabIndex={-1}>
          {heading}
        </h2>
        {linkedCount > 1 && <p className={styles.compareHint}>{t.compare.linkedHint}</p>}
      </div>

      {groupBy === 'none' ? (
        <div ref={gridRef} className={styles.compareGrid} data-count={items.length}>
          {items.map((item) => (
            <article key={item.key} className={styles.compareCard} aria-labelledby={`cmp-${item.key}`}>
              <header className={styles.compareCardHead}>
                <div className={styles.libraryText}>
                  <h3 id={`cmp-${item.key}`} className={styles.libraryName}>
                    {item.report.name}
                  </h3>
                  <span className={styles.libraryMeta}>{reportMeta(item.report)}</span>
                </div>
                <button type="button" className={dq.linkButton} onClick={() => onOpen(item)}>
                  {t.common.open}
                </button>
                <button type="button" className={dq.iconButton} aria-label={t.compare.removeFrom(item.report.name)} onClick={() => onRemoveReport(item.report.id)}>
                  ×
                </button>
              </header>
              {chart(item)}
            </article>
          ))}
        </div>
      ) : (
        <div ref={gridRef} className={styles.compareGroups}>
          {groups.map(([key, group]) => {
            const first = group[0]!;
            const byReport = groupBy === 'report';
            const title = byReport ? first.report.name : key;
            const meta = byReport ? reportMeta(first.report) : names[key];
            const remove = byReport ? () => onRemoveReport(first.report.id) : () => onRemoveStock?.(key);
            return (
              <section key={key} className={styles.compareGroup} aria-labelledby={`cmpg-${key}`}>
                <header className={styles.compareCardHead}>
                  <div className={styles.libraryText}>
                    <h3 id={`cmpg-${key}`} className={byReport ? styles.libraryName : styles.compareSymbol}>
                      {title}
                    </h3>
                    {meta && <span className={styles.libraryMeta}>{meta}</span>}
                  </div>
                  <button type="button" className={dq.iconButton} aria-label={t.compare.removeFrom(title)} onClick={remove}>
                    ×
                  </button>
                </header>
                <div className={styles.compareGrid}>{group.map(groupedCard)}</div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
