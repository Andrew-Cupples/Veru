import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useDocumentTitle } from '../../a11y/useDocumentTitle';
import { useT } from '../../i18n/I18nProvider';
import { ChartIcon } from '../reports/ChartIcon';
import type { ChartType } from '../reports/model';
import styles from './Start.module.css';

/**
 * Start page: the app's flow as pictures. Each step is a miniature of the real screen and a link to it,
 * so there is almost nothing to read. Illustrations are decorative; each card's link names the step.
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
          <span className={styles.quickLabel} aria-hidden="true">
            <ArrowGlyph /> {t.start.try}
          </span>
          {QUICK.map((s) => (
            <Link key={s} to={`/reports?symbol=${encodeURIComponent(s)}`} className={styles.ticker} aria-label={t.start.chartIn(s)} translate="no">
              {s}
            </Link>
          ))}
        </div>
      </header>

      <ol className={styles.flow} aria-label={t.start.howItWorks}>
        <Step n={1} title={t.start.stepPick} to="/reports" cta={t.nav.reports} art={<PickArt />} />
        <Step n={2} title={t.start.stepChart} to="/reports" cta={t.nav.reports} art={<ChartArt />} />
        <Step n={3} title={t.start.stepCompare} to="/compare" cta={t.nav.compare} art={<CompareArt />} />
        <Step n={4} title={t.start.stepExport} to="/raw-data" cta={t.nav.rawData} art={<ExportArt />} last />
      </ol>

      <section className={styles.more} aria-label={t.start.more}>
        <Tile to="/analytics" title={t.nav.analytics} art={<AnalyticsArt />} />
        <Tile to="/personalize" title={t.nav.personalize} art={<ThemeArt />} />
        <Tile to="/ledger" title={t.nav.ledger} art={<LedgerArt />} />
      </section>
    </div>
  );
}

function Step({ n, title, to, cta, art, last = false }: { n: number; title: string; to: string; cta: string; art: ReactNode; last?: boolean }) {
  const t = useT();
  return (
    <li className={styles.stepItem}>
      <Link to={to} className={styles.step} aria-label={t.start.stepLabel(n, title, cta)}>
        <span className={styles.badge} aria-hidden="true">
          {n}
        </span>
        <div className={styles.art} aria-hidden="true">
          {art}
        </div>
        <span className={styles.stepTitle}>{title}</span>
        <span className={styles.cta} aria-hidden="true">
          {cta} <ArrowGlyph />
        </span>
      </Link>
      {!last && (
        <svg className={styles.connector} viewBox="0 0 40 16" aria-hidden="true" focusable="false">
          <path className={styles.connectorLine} d="M2 8H32" />
          <path d="M28 3l6 5-6 5" fill="none" />
        </svg>
      )}
    </li>
  );
}

function Tile({ to, title, art }: { to: string; title: string; art: ReactNode }) {
  return (
    <Link to={to} className={styles.tile}>
      <span className={styles.tileArt} aria-hidden="true">
        {art}
      </span>
      {title}
    </Link>
  );
}

/* ---------- Illustrations (decorative miniatures of the real screens) ---------- */

function PickArt() {
  return (
    <div className={styles.pick}>
      <div className={styles.fakeInput}>
        <SearchGlyph />
        <span className={styles.typed}>TSLA</span>
        <span className={styles.caret} />
      </div>
      <div className={styles.fakeMenu}>
        <div className={styles.fakeOption} data-active="true">
          <b>TSLA</b>
          <span className={styles.bar} style={{ width: '58%' }} />
        </div>
        <div className={styles.fakeOption}>
          <b>TSM</b>
          <span className={styles.bar} style={{ width: '42%' }} />
        </div>
        <div className={styles.fakeOption}>
          <b>TSN</b>
          <span className={styles.bar} style={{ width: '34%' }} />
        </div>
      </div>
    </div>
  );
}

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
        {['PNG', 'SVG', 'CSV'].map((f) => (
          <span key={f} className={styles.file}>
            <FileGlyph />
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}

function AnalyticsArt() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 20V13M9.3 20V8M14.6 20V11M20 20V4" strokeWidth="3" />
    </svg>
  );
}

function ThemeArt() {
  return (
    <span className={styles.swatches}>
      <span style={{ background: 'var(--accent)' }} />
      <span style={{ background: 'var(--keyword)' }} />
      <span style={{ background: 'var(--session-regular)' }} />
    </span>
  );
}

function LedgerArt() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M9 11h7M9 15h7M9 7h3" />
    </svg>
  );
}

/* ---------- Glyphs ---------- */

function ArrowGlyph() {
  return (
    <svg className={styles.glyph} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" />
    </svg>
  );
}

function SearchGlyph() {
  return (
    <svg className={styles.glyph} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}

function FileGlyph() {
  return (
    <svg className={styles.glyph} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4 2h5l3 3v9H4z" />
      <path d="M8 7v5M6 10l2 2 2-2" />
    </svg>
  );
}
