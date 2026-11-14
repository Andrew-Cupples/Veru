import type { Theme } from '../../theme/theme';
import type { ColorScheme } from '../../theme/tokens';
import { radioGroup } from '../../a11y/radioGroup';
import { scopeStyle } from './scope';
import styles from './Personalize.module.css';

interface Props {
  themes: readonly Theme[];
  activeId: string;
  scheme: ColorScheme;
  onPick: (id: string) => void;
}

/**
 * One card per theme, each a tiny mock of the app painted in that theme's colors.
 * A radio group: Tab lands on the active theme, arrow keys switch theme immediately.
 */
export function ThemeGallery({ themes, activeId, scheme, onPick }: Props) {
  const group = radioGroup(
    themes.map((t) => t.id),
    activeId,
    onPick,
  );

  return (
    <div className={styles.gallery} role="radiogroup" aria-label="Theme" onKeyDown={group.onKeyDown}>
      {themes.map((theme) => {
        const active = theme.id === activeId;
        return (
          <button
            key={theme.id}
            type="button"
            className={styles.themeCard}
            aria-label={theme.name}
            aria-describedby={`theme-${theme.id}-tagline`}
            {...group.radioProps(theme.id)}
          >
            <div className={styles.mock} style={scopeStyle(theme, scheme)} aria-hidden="true">
              <div className={styles.mockHeader}>
                <span className={styles.mockMark} />
                <span className={styles.mockTab} data-active="true" />
                <span className={styles.mockTab} />
              </div>
              <div className={styles.mockBody}>
                <div className={styles.mockCard}>
                  <span className={styles.mockLine} style={{ width: '60%', background: 'var(--ink)' }} />
                  <span className={styles.mockLine} style={{ width: '40%', background: 'var(--ink-muted)' }} />
                  <div className={styles.mockRow}>
                    <span className={styles.mockButton} />
                    <span className={styles.mockChip} />
                    <span className={styles.mockDot} style={{ background: 'var(--keyword)' }} />
                    <span className={styles.mockDot} style={{ background: 'var(--session-regular)' }} />
                    <span className={styles.mockDot} style={{ background: 'var(--danger)' }} />
                  </div>
                </div>
              </div>
              {theme.palette && (
                <div className={styles.mockPalette}>
                  {theme.palette[scheme].map((s) => (
                    <span key={s.slug} style={{ background: s.value }} />
                  ))}
                </div>
              )}
            </div>
            <div className={styles.themeMeta}>
              <span className={styles.themeName}>
                <span aria-hidden="true">{theme.emoji}</span> {theme.name}
                {active && (
                  <span className={styles.badge} aria-hidden="true">
                    Active
                  </span>
                )}
              </span>
              <span id={`theme-${theme.id}-tagline`} className={styles.themeTagline}>
                {theme.tagline}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
