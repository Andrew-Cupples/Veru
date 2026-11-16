import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { readJson, writeJson } from '../lib/storage';
import { track } from '../analytics/tracker';
import { catalogs, type Messages } from './catalogs';
import { detectLocale, isLocale, type Locale } from './locales';

const STORAGE_KEY = 'veru.locale';

/*
 * The active language also lives at module level, so plain modules (chart builders, query error
 * messages, template lists) can read it through `messages()` / `currentLocale()` without a hook.
 * The provider keeps it in step and re-renders the tree when it changes.
 */
let active: Locale = readJson(STORAGE_KEY, detectLocale(), isLocale);

/** The catalog for the active language, for code outside React components. Inside one, use `useT()`. */
export const messages = (): Messages => catalogs[active];
export const currentLocale = (): Locale => active;

/**
 * A value built from the active language's strings, built once per language: the same object comes
 * back until the language changes, so it is safe as a React dependency or memo key.
 */
export function perLocale<T>(build: (t: Messages) => T): () => T {
  const cache = new Map<Locale, T>();
  return () => {
    let value = cache.get(active);
    if (value === undefined) {
      value = build(catalogs[active]);
      cache.set(active, value);
    }
    return value;
  };
}

/** Numbers in the active language's style (1,234.5 / 1.234,5 / 1 234,5). */
export const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => value.toLocaleString(active, options);

export const formatDateTime = (value: Date | number | string, options?: Intl.DateTimeFormatOptions) =>
  new Date(value).toLocaleString(active, options);

interface I18nValue {
  locale: Locale;
  t: Messages;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setState] = useState<Locale>(active);

  const setLocale = useCallback((next: Locale) => {
    active = next;
    writeJson(STORAGE_KEY, next);
    track('setting', { target: 'language', detail: next });
    setState(next);
  }, []);

  // Screen readers pick their voice, and browsers their hyphenation and translation offer, from <html lang>.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(() => ({ locale, t: catalogs[locale], setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}

/** The active language's strings. Re-renders the component when the language changes. */
export const useT = (): Messages => useI18n().t;
