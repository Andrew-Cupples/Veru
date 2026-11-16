import type { Locale } from '../locales';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { pt } from './pt';

/** The shape every catalog must have: English's. */
export type Messages = typeof en;

export const catalogs: Record<Locale, Messages> = { en, es, fr, 'pt-BR': pt };
