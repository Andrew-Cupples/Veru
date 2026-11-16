import { useId, useMemo } from 'react';
import { useDailySummary, type SeriesRequest } from '../../api/hooks';
import { track } from '../../analytics/tracker';
import { downloadText } from '../../lib/download';
import { useCopy } from '../../lib/useCopy';
import { currentLocale, useT } from '../../i18n/I18nProvider';
import { DAILY_PRECISION, dailyJson } from './dailyJson';
import styles from '../data-query/DataQuery.module.css';

/**
 * The bars grouped by day, as the API's daily endpoint returns them: a table to read and the JSON itself,
 * ready to copy or download in the API's exact format and precision.
 */
export function DailySummaryPanel({ source }: { source: SeriesRequest }) {
  const t = useT();
  const headingId = useId();
  const daily = useDailySummary(source.symbol ? source : null);
  const days = useMemo(() => daily.data ?? [], [daily.data]);
  const json = useMemo(() => dailyJson(days), [days]);
  const { copied, copy } = useCopy();

  const locale = currentLocale();
  const price = useMemo(() => new Intl.NumberFormat(locale, { minimumFractionDigits: DAILY_PRECISION, maximumFractionDigits: DAILY_PRECISION }), [locale]);
  const integer = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const endpoint = `GET /api/market/${source.symbol}/daily?interval=${source.interval}&range=${source.range}${source.extendedHours ? '&extendedHours=true' : ''}`;
  const fileName = `${source.symbol}_${source.interval}_${source.range}_daily.json`;

  const download = () => {
    track('export', { target: 'JSON', detail: 'daily summary', subject: source.symbol, value: days.length });
    downloadText(json, fileName, 'application/json');
  };

  if (!source.symbol) return null;

  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <div className={styles.dailyHead}>
        <div>
          <h2 id={headingId} className={styles.dailyTitle}>
            {t.raw.daily.title}
          </h2>
          <p className={styles.hint}>{t.raw.daily.intro}</p>
          <code className={styles.endpoint} translate="no">
            {endpoint}
          </code>
        </div>
        <span className={styles.downloads}>
          <button type="button" className={styles.secondaryButton} onClick={() => void copy(json)} disabled={!days.length}>
            {copied === json && days.length ? t.raw.daily.copied : t.raw.daily.copy}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={download} disabled={!days.length}>
            {t.raw.daily.download}
          </button>
        </span>
      </div>

      <p className="sr-only" role="status">
        {copied === json && days.length ? t.raw.daily.copied : ''}
      </p>

      {daily.error ? (
        <div className={styles.alert} role="alert">
          {daily.error.message}
        </div>
      ) : daily.isPending ? (
        <p className={styles.hint}>{t.raw.daily.loading}</p>
      ) : !days.length ? (
        <p className={styles.hint}>{t.raw.daily.empty}</p>
      ) : (
        <div className={styles.dailyBody} data-stale={daily.isFetching} aria-busy={daily.isFetching}>
          <div className={styles.tableWrap} tabIndex={0} role="region" aria-label={t.raw.scrollable(t.raw.daily.caption(source.symbol, days.length))}>
            <table className={`${styles.table} ${styles.plainTable}`}>
              <caption className="sr-only">{t.raw.daily.caption(source.symbol, days.length)}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.raw.daily.day}</th>
                  <th scope="col" className={styles.numeric}>
                    {t.raw.daily.lowAverage}
                  </th>
                  <th scope="col" className={styles.numeric}>
                    {t.raw.daily.highAverage}
                  </th>
                  <th scope="col" className={styles.numeric}>
                    {t.raw.daily.volume}
                  </th>
                </tr>
              </thead>
              <tbody translate="no">
                {days.map((d) => (
                  <tr key={d.day}>
                    <td className={styles.mono}>{d.day}</td>
                    <td className={`${styles.numeric} ${styles.mono}`}>{price.format(d.lowAverage)}</td>
                    <td className={`${styles.numeric} ${styles.mono}`}>{price.format(d.highAverage)}</td>
                    <td className={`${styles.numeric} ${styles.mono}`}>{integer.format(d.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <pre className={styles.jsonPreview} tabIndex={0} aria-label={t.raw.daily.jsonLabel(fileName)} translate="no">
            {json}
          </pre>
        </div>
      )}
    </section>
  );
}
