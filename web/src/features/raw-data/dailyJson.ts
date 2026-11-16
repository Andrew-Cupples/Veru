import type { DailySummary } from '../../api/client';

/** Decimal places for the averages, as the API sends them and the assessment's sample shows them. */
export const DAILY_PRECISION = 4;

/**
 * The daily summary as JSON text, in the API's format and precision. JSON.stringify would drop trailing
 * zeros (41.0000 → 41), so the averages are written out with exactly four decimal places.
 */
export function dailyJson(days: readonly DailySummary[]): string {
  if (!days.length) return '[]';
  const entries = days.map(
    (d) =>
      [
        '    {',
        `        "day": ${JSON.stringify(d.day)},`,
        `        "lowAverage": ${d.lowAverage.toFixed(DAILY_PRECISION)},`,
        `        "highAverage": ${d.highAverage.toFixed(DAILY_PRECISION)},`,
        `        "volume": ${Math.round(d.volume)}`,
        '    }',
      ].join('\n'),
  );
  return `[\n${entries.join(',\n')}\n]`;
}
