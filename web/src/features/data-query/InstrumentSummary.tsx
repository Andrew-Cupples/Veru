import type { Instrument } from '../../api/client';
import { formatNumber, useT } from '../../i18n/I18nProvider';
import styles from './DataQuery.module.css';

const number = (value: number | null | undefined, digits = 2) =>
  value == null ? '—' : formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** The descriptive fields Yahoo returns alongside the bars. */
export function InstrumentSummary({ instrument }: { instrument: Instrument }) {
  const t = useT();
  const change =
    instrument.regularMarketPrice != null && instrument.previousClose
      ? instrument.regularMarketPrice - instrument.previousClose
      : null;
  const changePct = change != null && instrument.previousClose ? (change / instrument.previousClose) * 100 : null;

  const facts: [string, string][] = [
    [t.instrument.previousClose, number(instrument.previousClose)],
    [t.instrument.dayRange, `${number(instrument.dayLow)} – ${number(instrument.dayHigh)}`],
    [t.instrument.yearRange, `${number(instrument.fiftyTwoWeekLow)} – ${number(instrument.fiftyTwoWeekHigh)}`],
    [t.instrument.dayVolume, number(instrument.dayVolume, 0)],
    [t.instrument.timeZone, instrument.timeZone],
    [t.instrument.firstTrade, instrument.firstTradeDate?.slice(0, 10) ?? '—'],
  ];

  return (
    <section className={styles.summary} aria-label={t.instrument.label}>
      <div className={styles.identity}>
        <div className={styles.symbolLine}>
          <span className={styles.symbol} translate="no">{instrument.symbol}</span>
          {instrument.instrumentType && <span className={styles.tag}>{t.assetTypes[instrument.instrumentType.toLowerCase()] ?? instrument.instrumentType.toLowerCase()}</span>}
        </div>
        <div className={styles.name}>
          {[instrument.name, instrument.exchange, instrument.currency].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div className={styles.price}>
        <span className={styles.priceValue}>{number(instrument.regularMarketPrice)}</span>
        {change != null && changePct != null && (
          <span className={styles.change} data-direction={change >= 0 ? 'up' : 'down'}>
            {change >= 0 ? '+' : ''}
            {number(change)} ({change >= 0 ? '+' : ''}
            {formatNumber(changePct, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)
          </span>
        )}
      </div>
      <dl className={styles.facts}>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
