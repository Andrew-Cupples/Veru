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
import { MotionSettings } from './MotionSettings';
import { useMotion } from '../../motion/MotionProvider';
import { useT } from '../../i18n/I18nProvider';
import { swatchName, themeName } from './themeText';
import styles from './Personalize.module.css';

const SCHEMES: readonly SchemePreference[] = ['system', 'light', 'dark'];

export function PersonalizePage() {
  const t = useT();
  useDocumentTitle(t.nav.personalize);
  const { themes, theme, scheme, schemePreference, customColors, setTheme, setSchemePreference, setCustomColors } = useTheme();
  const { copied, copy } = useCopy();
  const css = themeToCss(theme);
  const isCustom = theme.id === CUSTOM_THEME_ID;
  const { fade } = useMotion();

  // Picking a theme or light/dark crossfades the whole screen. Custom color edits stay live (no fade),
  // since a color picker changes them continuously while dragging.
  const pickTheme = (id: string) => {
    if (id !== theme.id) fade(() => setTheme(id));
  };
  const pickScheme = (value: SchemePreference) => {
    if (value !== schemePreference) fade(() => setSchemePreference(value));
  };

  const schemeGroup = radioGroup(SCHEMES, schemePreference, pickScheme);
  const name = themeName(theme, t);

  const editCustom = (colors: CustomTheme) => {
    setCustomColors(colors);
    setTheme(CUSTOM_THEME_ID);
  };

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <h1 className={styles.title}>{t.nav.personalize}</h1>
        <div className={styles.segmented} role="radiogroup" aria-label={t.personalize.lightOrDark} onKeyDown={schemeGroup.onKeyDown}>
          {SCHEMES.map((s) => (
            <button key={s} type="button" {...schemeGroup.radioProps(s)}>
              {t.common[s]}
            </button>
          ))}
        </div>
      </div>

      <section className={styles.section} aria-labelledby="themes-heading">
        <h2 id="themes-heading">{t.personalize.themes}</h2>
        <ThemeGallery themes={themes} activeId={theme.id} scheme={scheme} onPick={pickTheme} />
      </section>

      <MotionSettings />

      {isCustom ? (
        <section className={styles.section} aria-labelledby="custom-heading">
          <h2 id="custom-heading">
            <span aria-hidden="true">🎨</span> {t.personalize.customTheme}
          </h2>
          <CustomThemeEditor colors={customColors} scheme={scheme} onChange={editCustom} />
        </section>
      ) : (
        theme.palette && (
          <section className={styles.section} aria-labelledby="palette-heading">
            <h2 id="palette-heading">
              <span aria-hidden="true">{theme.emoji}</span> {t.personalize.palette(name)}
            </h2>
            <div className={styles.paletteSchemes}>
              {(['light', 'dark'] as const).map((s) => (
                <div key={s} className={styles.paletteGroup} role="group" aria-labelledby={`palette-${s}`}>
                  <h3 id={`palette-${s}`}>
                    {t.common[s]} {s === scheme && <span className={styles.badge}>{t.personalize.showing}</span>}
                  </h3>
                  <div className={styles.palette}>
                    {theme.palette![s].map((sw) => (
                      <button
                        key={sw.slug}
                        type="button"
                        className={styles.paletteSwatch}
                        style={{ background: sw.value, color: readableInk(sw.value) }}
                        onClick={() => copy(sw.value)}
                        aria-label={t.personalize.copySwatch(swatchName(sw.slug, sw.name, t), sw.value)}
                      >
                        <span className={styles.paletteName}>{swatchName(sw.slug, sw.name, t)}</span>
                        <code translate="no">{copied === sw.value ? t.personalize.copiedLower : sw.value}</code>
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
        <h2 id="preview-heading">{t.personalize.preview}</h2>
        <p className="sr-only">{t.personalize.previewNote(name)}</p>
        {/* inert: the sample controls aren't real, so keep them out of the Tab order and the accessibility tree. */}
        <div className={styles.previews} inert>
          <Preview theme={theme} scheme="light" />
          <Preview theme={theme} scheme="dark" />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="export-heading">
        <h2 id="export-heading">{t.common.export}</h2>
        <div className={styles.exportBox}>
          <button type="button" className={styles.copyButton} onClick={() => copy(css)}>
            {copied === css ? t.common.copied : t.personalize.copyCss}
          </button>
          <pre tabIndex={0} aria-label={t.personalize.cssLabel(name)} translate="no">
            {css}
          </pre>
        </div>
      </section>

      <p className="sr-only" role="status">
        {copied ? (copied === css ? t.personalize.cssCopied : t.personalize.copiedValue(copied)) : ''}
      </p>
    </div>
  );
}
