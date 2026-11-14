import { useTheme } from '../../theme/ThemeProvider';
import { themeToCss } from '../../theme/theme';
import { readableInk } from '../../theme/contrast';
import { CUSTOM_THEME_ID, type CustomTheme } from '../../theme/custom';
import type { SchemePreference } from '../../theme/tokens';
import { radioGroup } from '../../a11y/radioGroup';
import { useDocumentTitle } from '../../a11y/useDocumentTitle';
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
  useDocumentTitle('Personalize');
  const { themes, theme, scheme, schemePreference, customColors, setTheme, setSchemePreference, setCustomColors } = useTheme();
  const { copied, copy } = useCopy();
  const css = themeToCss(theme);
  const isCustom = theme.id === CUSTOM_THEME_ID;
  const schemeGroup = radioGroup(
    SCHEMES.map((s) => s.value),
    schemePreference,
    setSchemePreference,
  );

  const editCustom = (colors: CustomTheme) => {
    setCustomColors(colors);
    setTheme(CUSTOM_THEME_ID);
  };

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <h1 className={styles.title}>Personalize</h1>
        <div className={styles.segmented} role="radiogroup" aria-label="Light or dark" onKeyDown={schemeGroup.onKeyDown}>
          {SCHEMES.map((s) => (
            <button key={s.value} type="button" {...schemeGroup.radioProps(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <section className={styles.section} aria-labelledby="themes-heading">
        <h2 id="themes-heading">Themes</h2>
        <ThemeGallery themes={themes} activeId={theme.id} scheme={scheme} onPick={setTheme} />
      </section>

      {isCustom ? (
        <section className={styles.section} aria-labelledby="custom-heading">
          <h2 id="custom-heading">
            <span aria-hidden="true">🎨</span> Custom theme
          </h2>
          <CustomThemeEditor colors={customColors} scheme={scheme} onChange={editCustom} />
        </section>
      ) : (
        theme.palette && (
          <section className={styles.section} aria-labelledby="palette-heading">
            <h2 id="palette-heading">
              <span aria-hidden="true">{theme.emoji}</span> {theme.name} palette
            </h2>
            <div className={styles.paletteSchemes}>
              {(['light', 'dark'] as const).map((s) => (
                <div key={s} className={styles.paletteGroup} role="group" aria-labelledby={`palette-${s}`}>
                  <h3 id={`palette-${s}`}>
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
                        aria-label={`${sw.name}, ${sw.value}. Copy`}
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

      <section className={styles.section} aria-labelledby="preview-heading">
        <h2 id="preview-heading">Preview</h2>
        <p className="sr-only">
          A visual sample of the {theme.name} theme in light and dark. Its controls are pictures only and can't be used.
        </p>
        {/* inert: the sample controls aren't real, so keep them out of the Tab order and the accessibility tree. */}
        <div className={styles.previews} inert>
          <Preview theme={theme} scheme="light" />
          <Preview theme={theme} scheme="dark" />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="export-heading">
        <h2 id="export-heading">Export</h2>
        <div className={styles.exportBox}>
          <button type="button" className={styles.copyButton} onClick={() => copy(css)}>
            {copied === css ? 'Copied' : 'Copy CSS'}
          </button>
          <pre tabIndex={0} aria-label={`${theme.name} theme as CSS`}>
            {css}
          </pre>
        </div>
      </section>

      <p className="sr-only" role="status">
        {copied ? (copied === css ? 'Theme CSS copied' : `Copied ${copied}`) : ''}
      </p>
    </div>
  );
}
