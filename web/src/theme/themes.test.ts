import { describe, expect, it } from 'vitest';
import { THEMES } from './themes';
import { CONTRAST_PAIRS, TOKENS } from './tokens';
import { contrastRatio, parseHex } from './contrast';
import { themeToCss } from './theme';
import { buildCustomTheme, colorsFromTheme, parseCustomTheme } from './custom';
import { leafGreen } from './themes/leafGreen';

describe('custom theme', () => {
  const colors = colorsFromTheme(leafGreen);
  const theme = buildCustomTheme(colors);

  it('round-trips a built-in theme through its editable colors', () => {
    expect(theme.schemes.light.accent).toBe(leafGreen.schemes.light.accent);
    expect(theme.schemes.dark.desk).toBe(leafGreen.schemes.dark.desk);
  });

  it('derives every token, picking readable button text', () => {
    for (const { name } of TOKENS) expect(theme.schemes.light[name], name).toBeTruthy();
    expect(contrastRatio(theme.schemes.dark['accent-ink'], theme.schemes.dark.accent)).toBeGreaterThan(4.5);
    expect(parseHex(theme.schemes.light.rule)).not.toBeNull();
  });

  it('ignores bad stored values', () => {
    const parsed = parseCustomTheme('{"light":{"accent":"red","text":"#123456"}}', colors);
    expect(parsed.light.accent).toBe(colors.light.accent);
    expect(parsed.light.text).toBe('#123456');
    expect(parseCustomTheme('not json', colors)).toBe(colors);
  });
});

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    expect(contrastRatio('rgb(0 0 0)', '#fff')).toBeNull();
  });
});

describe.each(THEMES.map((t) => [t.name, t] as const))('%s', (_name, theme) => {
  it.each(['light', 'dark'] as const)('sets every token in %s', (scheme) => {
    for (const { name } of TOKENS) expect(theme.schemes[scheme][name], name).toBeTruthy();
  });

  // Classic keeps the original palette exactly, misses included; the Personalize page lists them.
  it.skipIf(theme.id === 'classic').each(['light', 'dark'] as const)('meets AA on every checked pair in %s', (scheme) => {
    const tokens = theme.schemes[scheme];
    const failures = CONTRAST_PAIRS.flatMap(({ fg, bg, min }) => {
      const ratio = contrastRatio(tokens[fg], tokens[bg]);
      return ratio === null || ratio >= min ? [] : [`${fg} on ${bg}: ${ratio.toFixed(2)} < ${min}`];
    });
    expect(failures).toEqual([]);
  });

  it('uses hex for every palette swatch', () => {
    for (const swatch of [...(theme.palette?.light ?? []), ...(theme.palette?.dark ?? [])]) {
      expect(parseHex(swatch.value), swatch.slug).not.toBeNull();
    }
  });

  it('exports both schemes as CSS', () => {
    const css = themeToCss(theme);
    expect(css).toContain(`[data-theme='${theme.id}'][data-scheme='dark']`);
    expect(css).toContain('--accent:');
  });
});
