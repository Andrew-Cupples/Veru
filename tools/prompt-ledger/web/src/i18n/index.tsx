import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { en, type LedgerMessages } from './en';
import { es } from './es';
import { fr } from './fr';
import { pt } from './pt';

/*
 * The module's interface languages. The host passes any BCP 47 tag (`locale` on <PromptLedger>); it is
 * matched by language family, so "es-MX" gets Spanish and an unknown language gets English.
 */
const CATALOGS: Record<string, LedgerMessages> = { en, es, fr, pt };

export function resolveLedgerLocale(tag: string | undefined): { locale: string; t: LedgerMessages } {
  const family = (tag ?? 'en').toLowerCase().split('-')[0] ?? 'en';
  const t = CATALOGS[family];
  return t ? { locale: tag!, t } : { locale: 'en', t: en };
}

interface LedgerI18n {
  locale: string;
  t: LedgerMessages;
  formatTime: (iso: string) => string;
  formatDate: (iso: string) => string;
}

const Context = createContext<LedgerI18n | null>(null);

export function LedgerI18nProvider({ locale, children }: { locale?: string; children: ReactNode }) {
  const value = useMemo(() => {
    const resolved = resolveLedgerLocale(locale);
    const time = new Intl.DateTimeFormat(resolved.locale, { hour: 'numeric', minute: '2-digit' });
    const date = new Intl.DateTimeFormat(resolved.locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    return { ...resolved, formatTime: (iso: string) => time.format(new Date(iso)), formatDate: (iso: string) => date.format(new Date(iso)) };
  }, [locale]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLedgerI18n(): LedgerI18n {
  const value = useContext(Context);
  if (!value) throw new Error('useLedgerI18n must be used inside <LedgerI18nProvider>');
  return value;
}

export type { LedgerMessages };
