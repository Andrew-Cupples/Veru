import { useI18n } from '../i18n/I18nProvider';
import { LOCALES, isLocale } from '../i18n/locales';
import styles from './AppLayout.module.css';

/**
 * Language, in the menu bar on every page, so someone who lands in a language they can't read can still
 * find it: a globe and each language's own name. A native select, so it works with any keyboard or
 * screen reader. Names are never machine-translated (translate="no"), and each option carries its own
 * `lang` so a screen reader says "Français" with a French voice.
 */
export function LanguagePicker() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className={styles.language} translate="no">
      <svg className={styles.languageIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="6.25" />
        <path d="M1.75 8h12.5M8 1.75c1.8 1.7 2.7 3.8 2.7 6.25S9.8 12.55 8 14.25C6.2 12.55 5.3 10.45 5.3 8S6.2 3.45 8 1.75z" />
      </svg>
      <span className="sr-only">{t.nav.language}</span>
      <select
        className={styles.languageSelect}
        value={locale}
        data-track="language"
        onChange={(e) => isLocale(e.target.value) && setLocale(e.target.value)}
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
