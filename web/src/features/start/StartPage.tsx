import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useDocumentTitle } from '../../a11y/useDocumentTitle';
import { useT } from '../../i18n/I18nProvider';
import { ChartIcon } from '../reports/ChartIcon';
import type { ChartType } from '../reports/model';
import styles from './Start.module.css';

/**
 * Start page: every area of the app as a card, side by side. They are separate tools, not steps, so no
 * card leads to another. Each card is a miniature of the real screen and a link to it; illustrations are
 * decorative, and the link's name is the page, described by its one-line summary.
 */

const QUICK = ['TSLA', 'AAPL', 'NVDA', 'SPY', 'BTC-USD'];

export function StartPage() {
  const t = useT();
  useDocumentTitle(t.nav.start);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1>
          {t.start.headline} <span className={styles.accent}>{t.start.headlineAccent}</span>
        </h1>
        <div className={styles.quick} role="group" aria-label={t.start.quickGroup}>
          {QUICK.map((s) => (
            <Link key={s} to={`/reports?symbol=${encodeURIComponent(s)}`} className={styles.ticker} aria-label={t.start.chartIn(s)} translate="no">
              {s}
            </Link>
          ))}
        </div>
      </header>

      <ul className={styles.features} aria-label={t.start.features}>
        <Feature to="/reports" title={t.nav.reports} desc={t.start.desc.reports} art={<ChartArt />} />
        <Feature to="/compare" title={t.nav.compare} desc={t.start.desc.compare} art={<CompareArt />} />
        <Feature to="/raw-data" title={t.nav.rawData} desc={t.start.desc.rawData} art={<ExportArt />} />
        <Feature to="/analytics" title={t.nav.analytics} desc={t.start.desc.analytics} art={<AnalyticsArt />} />
        <Feature to="/personalize" title={t.nav.personalize} desc={t.start.desc.personalize} art={<ThemeArt />} />
        <Feature to="/ledger" title={t.nav.ledger} desc={t.start.desc.ledger} art={<LedgerArt />} />
      </ul>
    </div>
  );
}

function Feature({ to, title, desc, art }: { to: string; title: string; desc: string; art: ReactNode }) {
  const id = useId();
  return (
    <li className={styles.featureItem}>
      <Link to={to} className={styles.feature} aria-labelledby={`${id}-title`} aria-describedby={`${id}-desc`}>
        <div className={styles.art} aria-hidden="true">
          {art}
        </div>
        <span id={`${id}-title`} className={styles.featureTitle}>
          {title}
        </span>
        <span id={`${id}-desc`} className={styles.featureDesc}>
          {desc}
        </span>
      </Link>
    </li>
  );
}

/* ---------- Illustrations (decorative miniatures of the real screens) ---------- */

const PICKER: ChartType[] = ['line', 'candlestick', 'bar', 'scatter', 'heatmap', 'surface'];

function ChartArt() {
  return (
    <div className={styles.chartArt}>
      <div className={styles.picker}>
        {PICKER.map((t, i) => (
          <span key={t} className={styles.pickerCell} data-active={i === 1 || undefined}>
            <ChartIcon type={t} />
          </span>
        ))}
      </div>
      <svg className={styles.candles} viewBox="0 0 120 70" preserveAspectRatio="none">
        {CANDLES.map(([o, c, h, l], i) => {
          const x = 8 + i * 13;
          const up = c < o; // y grows downwards
          return (
            <g key={i} className={up ? styles.up : styles.down}>
              <line x1={x} x2={x} y1={h} y2={l} />
              <rect x={x - 3.5} y={Math.min(o, c)} width="7" height={Math.max(2, Math.abs(o - c))} rx="1" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// [open, close, high, low] in SVG y units (smaller is higher)
const CANDLES: readonly (readonly [number, number, number, number])[] = [
  [48, 40, 36, 52],
  [40, 44, 34, 50],
  [44, 32, 28, 47],
  [32, 36, 26, 40],
  [36, 24, 20, 39],
  [24, 28, 18, 33],
  [28, 16, 12, 31],
  [16, 20, 10, 25],
];

const SPARKS: { symbol: string; d: string; up: boolean }[] = [
  { symbol: 'TSLA', d: 'M0 22 L10 18 L20 20 L30 12 L40 14 L50 6 L60 9 L70 3', up: true },
  { symbol: 'AAPL', d: 'M0 14 L10 15 L20 11 L30 13 L40 10 L50 11 L60 8 L70 9', up: true },
  { symbol: 'NVDA', d: 'M0 6 L10 9 L20 8 L30 14 L40 12 L50 18 L60 16 L70 21', up: false },
];

function CompareArt() {
  return (
    <div className={styles.compare}>
      {SPARKS.map((s) => (
        <div key={s.symbol} className={styles.spark}>
          <b>{s.symbol}</b>
          <svg viewBox="0 0 70 24" preserveAspectRatio="none" className={s.up ? styles.up : styles.down}>
            <path d={`${s.d} L70 24 L0 24 Z`} className={styles.sparkFill} />
            <path d={s.d} className={styles.sparkLine} />
          </svg>
        </div>
      ))}
    </div>
  );
}

function ExportArt() {
  return (
    <div className={styles.export}>
      <div className={styles.table}>
        {[0, 1, 2, 3].map((r) => (
          <div key={r} className={styles.row} data-head={r === 0 || undefined}>
            <span style={{ width: '34%' }} />
            <span style={{ width: '22%' }} />
            <span style={{ width: '26%' }} />
          </div>
        ))}
      </div>
      <div className={styles.files}>
        <span className={styles.file}>
          <FileGlyph />
          CSV
        </span>
      </div>
    </div>
  );
}

const USAGE = [38, 62, 45, 80, 56, 92, 70];

function AnalyticsArt() {
  return (
    <div className={styles.analytics}>
      <div className={styles.kpiRow}>
        {[['128', 72], ['4.2k', 48]].map(([value, width]) => (
          <span key={value} className={styles.kpiChip}>
            <b>{value}</b>
            <span className={styles.bar} style={{ width: `${width}%` }} />
          </span>
        ))}
      </div>
      <div className={styles.usage}>
        {USAGE.map((h, i) => (
          <span key={i} style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

const THEMES = [
  { surface: 'var(--surface)', accent: 'var(--accent)' },
  { surface: '#f6f4ef', accent: '#c2410c' },
  { surface: '#0f172a', accent: '#38bdf8' },
];

function ThemeArt() {
  return (
    <div className={styles.themes}>
      {THEMES.map((th, i) => (
        <span key={i} className={styles.themeCard} data-active={i === 0 || undefined} style={{ background: th.surface }}>
          <span className={styles.themeBar} style={{ background: th.accent }} />
          <span className={styles.themeLine} />
          <span className={styles.themeLine} style={{ width: '60%' }} />
        </span>
      ))}
    </div>
  );
}

function LedgerArt() {
  return (
    <div className={styles.ledger}>
      {[['72%', 'feat'], ['54%', 'fix'], ['66%', 'ui']].map(([width, tag]) => (
        <div key={tag} className={styles.ledgerRow}>
          <span className={styles.ledgerDot} />
          <span className={styles.bar} style={{ width }} />
          <span className={styles.ledgerTag}>{tag}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Glyphs ---------- */

function FileGlyph() {
  return (
    <svg className={styles.glyph} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4 2h5l3 3v9H4z" />
      <path d="M8 7v5M6 10l2 2 2-2" />
    </svg>
  );
}
