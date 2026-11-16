import { describe, expect, it } from 'vitest';
import { catalogs } from './catalogs';
import { detectLocale, LOCALES } from './locales';

/** Every leaf path in a catalog, with its value: strings and functions. */
function leaves(value: unknown, path = ''): [string, unknown][] {
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [[path, value]];
}

describe('locale detection', () => {
  it('matches by language family, in order of preference', () => {
    expect(detectLocale(['es-MX', 'en'])).toBe('es');
    expect(detectLocale(['fr-CA'])).toBe('fr');
    expect(detectLocale(['pt-PT'])).toBe('pt-BR');
    expect(detectLocale(['de-DE', 'fr'])).toBe('fr');
  });

  it('falls back to English', () => {
    expect(detectLocale(['ja-JP'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });
});

describe('catalogs', () => {
  const english = new Map(leaves(catalogs.en));

  for (const { code } of LOCALES) {
    const entries = leaves(catalogs[code]);

    it(`${code} has exactly the English keys`, () => {
      // tsc checks the shape too, but the interval and range tables are typed loosely.
      expect(entries.map(([k]) => k).sort()).toEqual([...english.keys()].sort());
    });

    it(`${code} has no empty strings, and every function returns text`, () => {
      for (const [key, value] of entries) {
        if (typeof value === 'string') expect(value.trim(), key).not.toBe('');
        else expect(typeof value, key).toBe('function');
      }
    });
  }

  it('counts read naturally (singular and plural)', () => {
    expect(catalogs.en.raw.status(1, 'TSLA')).toBe('1 row for TSLA');
    expect(catalogs.en.raw.status(1234, 'TSLA')).toBe('1,234 rows for TSLA');
    expect(catalogs.es.raw.status(1234, 'TSLA')).toBe('1234 filas de TSLA');
    expect(catalogs.fr.compare.loadingStocks(0)).toBe('Chargement de 0 action');
    expect(catalogs['pt-BR'].compare.loadingStocks(2)).toBe('Carregando 2 ações');
  });
});
