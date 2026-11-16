/**
 * The languages the app is translated into. Each has a hand-written catalog in ./catalogs;
 * English is the source, and the other catalogs must match its shape exactly (checked by tsc).
 * Any other language is left to the browser's own page translation, helped by the `lang`
 * attribute and translate="no" on tickers and code.
 */
export const LOCALES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'pt-BR', name: 'Português' },
] as const;

export type Locale = (typeof LOCALES)[number]['code'];

export const DEFAULT_LOCALE: Locale = 'en';

export const isLocale = (value: unknown): value is Locale => LOCALES.some((l) => l.code === value);

/** The best match for the browser's preferred languages, by language family (es-MX → es, pt-PT → pt-BR). */
export function detectLocale(preferred: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages): Locale {
  for (const tag of preferred) {
    const family = tag.toLowerCase().split('-')[0];
    const match = LOCALES.find((l) => l.code.toLowerCase().split('-')[0] === family);
    if (match) return match.code;
  }
  return DEFAULT_LOCALE;
}
