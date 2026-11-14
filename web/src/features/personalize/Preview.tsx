import type { Theme } from '../../theme/theme';
import type { ColorScheme } from '../../theme/tokens';
import { scopeStyle } from './scope';
// The preview uses the real Raw data classes, so what you see here is what that page renders.
import raw from '../raw-data/RawData.module.css';
import styles from './Personalize.module.css';

/** Real UI pieces painted in one theme and scheme, independent of what the app currently shows. */
export function Preview({ theme, scheme }: { theme: Theme; scheme: ColorScheme }) {
  return (
    <div className={styles.preview} style={scopeStyle(theme, scheme)}>
      <div className={styles.previewLabel}>
        {theme.name} · {scheme}
      </div>

      <div className={raw.card}>
        <div className={raw.clause}>
          <span className={raw.keyword}>FROM</span>
          <div className={raw.fromRow}>
            <label className={raw.field}>
              <span className={raw.fieldLabel}>Symbol</span>
              <input className={`${raw.input} ${raw.symbolInput}`} defaultValue="AAPL" />
            </label>
            <label className={raw.field}>
              <span className={raw.fieldLabel}>Invalid</span>
              <input className={raw.input} aria-invalid="true" defaultValue="-3" style={{ width: 70 }} />
            </label>
            <button type="button" className={raw.runButton}>
              Run
            </button>
            <button type="button" className={raw.secondaryButton}>
              Export
            </button>
          </div>
        </div>
        <div className={raw.clause}>
          <span className={raw.keyword}>WHERE</span>
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
            <button type="button" className={raw.linkButton}>
              + Add condition
            </button>
          </div>
        </div>
        <div className={raw.sql}>
          <pre>SELECT * FROM bars WHERE volume &gt; 1000</pre>
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

      <div className={raw.notice}>Heads up: this is the notice style.</div>
      <div className={raw.alert}>
        Something failed: <code>502 Bad Gateway</code>
      </div>
      <p className={raw.hint} style={{ margin: 0 }}>
        Hint text uses ink-faint. <span style={{ color: 'var(--ink-muted)' }}>Muted text uses ink-muted.</span>
      </p>
    </div>
  );
}
