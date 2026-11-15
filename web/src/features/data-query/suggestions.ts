import type { SymbolMatch } from '../../api/client';

export interface Suggestion {
  symbol: string;
  name: string | null;
  /** Where it came from: one of yours, or the search. */
  source: 'favourite' | 'recent' | 'search';
  /** Exchange · type, for search results. */
  meta: string | null;
}

const MAX_LOCAL = 6;
const MAX_TOTAL = 12;

/**
 * Autocomplete options: your favourites and recents that match what is typed (all of them when nothing is),
 * then search results that aren't already listed. Local matches come first because they are what you
 * bounce between, and they show without waiting for the network.
 */
export function buildSuggestions(
  text: string,
  favourites: readonly string[],
  recent: readonly string[],
  names: Readonly<Record<string, string>>,
  matches: readonly SymbolMatch[],
): Suggestion[] {
  const typed = text.trim().toUpperCase();
  const matchesLocal = (symbol: string) =>
    !typed || symbol.startsWith(typed) || (typed.length >= 2 && (names[symbol] ?? '').toUpperCase().includes(typed));

  const seen = new Set<string>();
  const out: Suggestion[] = [];
  const local: [string, Suggestion['source']][] = [
    ...favourites.map((s) => [s, 'favourite'] as [string, Suggestion['source']]),
    ...recent.map((s) => [s, 'recent'] as [string, Suggestion['source']]),
  ];
  for (const [symbol, source] of local) {
    if (seen.has(symbol) || !matchesLocal(symbol)) continue;
    if (out.length >= MAX_LOCAL) break;
    seen.add(symbol);
    out.push({ symbol, name: names[symbol] ?? null, source, meta: null });
  }
  if (typed) {
    for (const m of matches) {
      if (seen.has(m.symbol) || out.length >= MAX_TOTAL) continue;
      seen.add(m.symbol);
      out.push({ symbol: m.symbol, name: m.name ?? null, source: 'search', meta: [m.exchange, m.type].filter(Boolean).join(' · ') || null });
    }
  }
  return out;
}
