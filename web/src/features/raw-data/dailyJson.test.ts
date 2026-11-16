import { describe, expect, it } from 'vitest';
import { dailyJson } from './dailyJson';

describe('dailyJson', () => {
  it('matches the assessment sample exactly', () => {
    expect(dailyJson([{ day: '2009-01-30', lowAverage: 40.2958, highAverage: 49.7534, volume: 49073348 }])).toBe(
      ['[', '    {', '        "day": "2009-01-30",', '        "lowAverage": 40.2958,', '        "highAverage": 49.7534,', '        "volume": 49073348', '    }', ']'].join('\n'),
    );
  });

  it('keeps four decimal places on round numbers and parses back to the same values', () => {
    const days = [
      { day: '2026-11-13', lowAverage: 41, highAverage: 42.5, volume: 1 },
      { day: '2026-11-14', lowAverage: 0.1234, highAverage: 9.99, volume: 0 },
    ];
    const text = dailyJson(days);

    expect(text).toContain('"lowAverage": 41.0000,');
    expect(text).toContain('"highAverage": 42.5000,');
    expect(text).toContain('"highAverage": 9.9900,');
    expect(JSON.parse(text)).toEqual(days);
  });

  it('writes an empty array when there are no days', () => {
    expect(dailyJson([])).toBe('[]');
  });
});
