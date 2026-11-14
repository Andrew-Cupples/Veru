import { useTheme } from '../../theme/ThemeProvider';
import { themeToCss } from '../../theme/theme';
import { readableInk } from '../../theme/contrast';
import { CUSTOM_THEME_ID, type CustomTheme } from '../../theme/custom';
import type { SchemePreference } from '../../theme/tokens';
import { ThemeGallery } from './ThemeGallery';
import { CustomThemeEditor } from './CustomThemeEditor';
import { Preview } from './Preview';
import { useCopy } from './useCopy';
import styles from './Personalize.module.css';

const SCHEMES: { value: SchemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function PersonalizePage() {
  const { themes, theme, scheme, schemePreference, customColors, setTheme, setSchemePreference, setCustomColors } = useTheme();
  const { copied, copy } = useCopy();
  const css = themeToCss(theme);
  const isCustom = theme.id === CUSTOM_THEME_ID;

  const editCustom = (colors: CustomTheme) => {
    setCustomColors(colors);
    setTheme(CUSTOM_THEME_ID);
  };

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <h1 className={styles.title}>Personalize</h1>
        <div className={styles.segmented} role="radiogroup" aria-label="Color scheme">
          {SCHEMES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={schemePreference === s.value}
              onClick={() => setSchemePreference(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <section className={styles.section}>
        <h2>Themes</h2>
        <ThemeGallery themes={themes} activeId={theme.id} scheme={scheme} onPick={setTheme} />
      </section>

      {isCustom ? (
        <section className={styles.section}>
          <h2>🎨 Custom theme</h2>
          <CustomThemeEditor colors={customColors} scheme={scheme} onChange={editCustom} />
        </section>
      ) : (
        theme.palette && (
          <section className={styles.section}>
            <h2>
              {theme.emoji} {theme.name} palette
            </h2>
            <div className={styles.paletteSchemes}>
              {(['light', 'dark'] as const).map((s) => (
                <div key={s} className={styles.paletteGroup}>
                  <h3>
                    {s === 'light' ? 'Light' : 'Dark'} {s === scheme && <span className={styles.badge}>showing</span>}
                  </h3>
                  <div className={styles.palette}>
                    {theme.palette![s].map((sw) => (
                      <button
                        key={sw.slug}
                        type="button"
                        className={styles.paletteSwatch}
                        style={{ background: sw.value, color: readableInk(sw.value) }}
                        onClick={() => copy(sw.value)}
                        title={`Copy ${sw.value}`}
                      >
                        <span className={styles.paletteName}>{sw.name}</span>
                        <code>{copied === sw.value ? 'copied' : sw.value}</code>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      )}

      <section className={styles.section}>
        <h2>Preview</h2>
        <div className={styles.previews}>
          <Preview theme={theme} scheme="light" />
          <Preview theme={theme} scheme="dark" />
        </div>
      </section>

      <section className={styles.section}>
        <h2>Export</h2>
        <div className={styles.exportBox}>
          <button type="button" className={styles.copyButton} onClick={() => copy(css)}>
            {copied === css ? 'Copied' : 'Copy CSS'}
          </button>
          <pre>{css}</pre>
        </div>
      </section>
    </div>
  );
}
