import type { Instrument } from '../../api/client';
import styles from './RawData.module.css';

const number = (value: number | null | undefined, digits = 2) =>
  value == null ? '—' : value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** The descriptive fields Yahoo returns alongside the bars. */
export function InstrumentSummary({ instrument }: { instrument: Instrument }) {
  const change =
    instrument.regularMarketPrice != null && instrument.previousClose
      ? instrument.regularMarketPrice - instrument.previousClose
      : null;
  const changePct = change != null && instrument.previousClose ? (change / instrument.previousClose) * 100 : null;

  const facts: [string, string][] = [
    ['Previous close', number(instrument.previousClose)],
    ['Day range', `${number(instrument.dayLow)} – ${number(instrument.dayHigh)}`],
    ['52-week range', `${number(instrument.fiftyTwoWeekLow)} – ${number(instrument.fiftyTwoWeekHigh)}`],
    ['Day volume', number(instrument.dayVolume, 0)],
    ['Time zone', instrument.timeZone],
    ['First trade', instrument.firstTradeDate?.slice(0, 10) ?? '—'],
  ];

  return (
    <section className={styles.summary} aria-label="Instrument">
      <div className={styles.identity}>
        <div className={styles.symbolLine}>
          <span className={styles.symbol}>{instrument.symbol}</span>
          {instrument.instrumentType && <span className={styles.tag}>{instrument.instrumentType.toLowerCase()}</span>}
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
            {changePct.toFixed(2)}%)
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
