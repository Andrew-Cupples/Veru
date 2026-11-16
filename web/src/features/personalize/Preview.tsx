import type { Theme } from '../../theme/theme';
import type { ColorScheme } from '../../theme/tokens';
import { scopeStyle } from './scope';
// The preview uses the shared data page classes (Raw data, Reports), so what you see here is what that page renders.
import raw from '../data-query/DataQuery.module.css';
import { useT } from '../../i18n/I18nProvider';
import { themeName } from './themeText';
import styles from './Personalize.module.css';

/** Real UI pieces painted in one theme and scheme, independent of what the app currently shows. */
export function Preview({ theme, scheme }: { theme: Theme; scheme: ColorScheme }) {
  const t = useT();
  return (
    <div className={styles.preview} style={scopeStyle(theme, scheme)}>
      <div className={styles.previewLabel}>
        {themeName(theme, t)} · {t.common[scheme]}
      </div>

      <div className={raw.card}>
        <div className={raw.clause}>
          <span className={raw.keyword}>{t.query.from}</span>
          <div className={raw.fromRow}>
            <label className={raw.field}>
              <span className={raw.fieldLabel}>{t.source.stock}</span>
              <input className={`${raw.input} ${raw.symbolInput}`} defaultValue="AAPL" />
            </label>
            <label className={raw.field}>
              <span className={raw.fieldLabel}>{t.preview.invalid}</span>
              <input className={raw.input} aria-invalid="true" defaultValue="-3" style={{ width: 70 }} />
            </label>
            <button type="button" className={raw.runButton}>
              {t.source.run}
            </button>
            <button type="button" className={raw.secondaryButton}>
              {t.common.export}
            </button>
          </div>
        </div>
        <div className={raw.clause}>
          <span className={raw.keyword}>{t.query.where}</span>
          <div className={raw.chips}>
            <button type="button" className={raw.chip} aria-pressed="true">
              15m
            </button>
            <button type="button" className={raw.chip} aria-pressed="false">
              1h
            </button>
            <div className={raw.segmented}>
              <button type="button" aria-pressed="true">
                asc
              </button>
              <button type="button" aria-pressed="false">
                desc
              </button>
            </div>
            <button type="button" className={`${raw.chip} ${raw.keywordChip}`}>
              AND
            </button>
            <button type="button" className={raw.linkButton}>
              {t.source.clearAll}
            </button>
          </div>
        </div>
      </div>

      <div className={raw.tableWrap} style={{ maxHeight: 'none' }}>
        <table className={raw.table}>
          <thead>
            <tr>
              <th>
                <span className={raw.sortButton}>time</span>
              </th>
              <th>
                <span className={raw.sortButton}>session</span>
              </th>
              <th className={raw.numeric}>
                <span className={raw.sortButton}>change</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['08:45', 'pre', 'up', '+0.42%'],
                ['10:30', 'regular', 'down', '−1.08%'],
                ['16:15', 'post', 'up', '+0.11%'],
              ] as const
            ).map(([time, session, direction, change]) => (
              <tr key={time}>
                <td className={raw.mono}>{time}</td>
                <td>
                  <span className={raw.session} data-session={session}>
                    {session}
                  </span>
                </td>
                <td className={raw.numeric}>
                  <span className={raw.change} data-direction={direction}>
                    {change}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={raw.notice}>{t.preview.notice}</div>
      <div className={raw.alert}>
        {t.preview.failed} <code translate="no">502 Bad Gateway</code>
      </div>
      <p className={raw.hint} style={{ margin: 0 }}>
        {t.preview.hint} <span style={{ color: 'var(--ink-muted)' }}>{t.preview.muted}</span>
      </p>
    </div>
  );
}
