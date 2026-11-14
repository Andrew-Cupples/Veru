import { contrastRatio, mixHex, readableInk } from './contrast';
import { defineTheme, type Theme } from './theme';
import { CONTRAST_PAIRS, type ColorScheme, type ThemeToken } from './tokens';

/**
 * The handful of colors a user picks for their own theme. Every other token is worked out from these,
 * so the editor stays simple and the result still covers the whole app.
 */
export interface CustomColors {
  background: string;
  card: string;
  text: string;
  accent: string;
  secondary: string;
  up: string;
  down: string;
}

export type CustomTheme = Record<ColorScheme, CustomColors>;

export const CUSTOM_FIELDS: { key: keyof CustomColors; label: string; hint: string }[] = [
  { key: 'background', label: 'Background', hint: 'Behind everything' },
  { key: 'card', label: 'Cards', hint: 'Panels, tables, inputs' },
  { key: 'text', label: 'Text', hint: 'Headings and body text' },
  { key: 'accent', label: 'Accent', hint: 'Buttons, active tab, links' },
  { key: 'secondary', label: 'Secondary', hint: 'SQL keywords, after-hours tag' },
  { key: 'up', label: 'Up', hint: 'Price up, regular session' },
  { key: 'down', label: 'Down', hint: 'Price down, errors' },
];

export const CUSTOM_THEME_ID = 'custom';

/** Pulls the editable colors out of an existing theme, for "start from". */
export function colorsFromTheme(theme: Theme): CustomTheme {
  const pick = (scheme: ColorScheme): CustomColors => {
    const t = theme.schemes[scheme];
    return {
      background: t.desk,
      card: t['surface-raised'],
      text: t.ink,
      accent: t.accent,
      secondary: t.keyword,
      up: t['session-regular'],
      down: t.danger,
    };
  };
  return { light: pick('light'), dark: pick('dark') };
}

export function buildCustomTheme(colors: CustomTheme): Theme {
  const tokens = (scheme: ColorScheme) => {
    const c = colors[scheme];
    const dark = scheme === 'dark';
    const warning = dark ? '#f0b34a' : '#9a6700';
    return {
      desk: c.background,
      surface: mixHex(c.card, c.background, 0.55),
      'surface-raised': c.card,
      'surface-sunken': mixHex(c.background, c.text, dark ? 0.85 : 0.96),
      ink: c.text,
      'ink-muted': mixHex(c.text, c.card, 0.7),
      'ink-faint': mixHex(c.text, c.card, 0.56),
      rule: mixHex(c.text, c.card, 0.12),
      'rule-strong': mixHex(c.text, c.card, 0.22),
      accent: c.accent,
      'accent-hover': mixHex(c.accent, dark ? '#ffffff' : '#000000', 0.82),
      'accent-ink': readableInk(c.accent),
      keyword: c.secondary,
      danger: c.down,
      warning,
      'session-pre': warning,
      'session-regular': c.up,
      'session-post': c.secondary,
    };
  };
  const palette = (scheme: ColorScheme) =>
    CUSTOM_FIELDS.map(({ key, label }) => ({ slug: key, name: label, value: colors[scheme][key] }));

  return defineTheme({
    id: CUSTOM_THEME_ID,
    name: 'Custom',
    tagline: 'Your own colors. Edit them below.',
    emoji: '🎨',
    palette: { light: palette('light'), dark: palette('dark') },
    schemes: { light: tokens('light'), dark: tokens('dark') },
  });
}

/** Reads a stored custom theme, falling back to `fallback` for anything missing or malformed. */
export function parseCustomTheme(json: string | null, fallback: CustomTheme): CustomTheme {
  if (!json) return fallback;
  try {
    const raw = JSON.parse(json) as Partial<Record<ColorScheme, Partial<CustomColors>>>;
    const clean = (scheme: ColorScheme): CustomColors => {
      const out = { ...fallback[scheme] };
      for (const { key } of CUSTOM_FIELDS) {
        const value = raw[scheme]?.[key];
        if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) out[key] = value;
      }
      return out;
    };
    return { light: clean('light'), dark: clean('dark') };
  } catch {
    return fallback;
  }
}

/** Which picked color a derived text token comes from, so a readability problem can name (and fix) it. */
const FIELD_FOR_TOKEN: Partial<Record<ThemeToken, keyof CustomColors>> = {
  ink: 'text',
  'ink-muted': 'text',
  'ink-faint': 'text',
  accent: 'accent',
  'accent-ink': 'accent',
  keyword: 'secondary',
  'session-post': 'secondary',
  'session-regular': 'up',
  danger: 'down',
};

export interface ReadabilityIssue {
  field: keyof CustomColors;
  where: string;
  ratio: number;
  min: number;
}

/** Text/background pairs in the custom theme that fall below WCAG AA, grouped under the color to change. */
export function readabilityIssues(colors: CustomTheme, scheme: ColorScheme): ReadabilityIssue[] {
  const tokens = buildCustomTheme(colors).schemes[scheme];
  return CONTRAST_PAIRS.flatMap(({ fg, bg, min, where }) => {
    const field = FIELD_FOR_TOKEN[fg];
    const ratio = contrastRatio(tokens[fg], tokens[bg]);
    return field && ratio !== null && ratio < min ? [{ field, where, ratio, min }] : [];
  });
}

/**
 * Nudges one color toward black or white (whichever the cards contrast with) in small steps,
 * stopping at the first shade where none of its text pairs are hard to read. Keeps the hue as far as possible.
 */
export function fixReadability(colors: CustomTheme, scheme: ColorScheme, field: keyof CustomColors): CustomTheme {
  const original = colors[scheme][field];
  // For the accent this also fixes button labels: once it is dark (or light) enough, the label flips to match.
  const target = readableInk(colors[scheme].card);
  for (let step = 1; step <= 20; step++) {
    const candidate = { ...colors, [scheme]: { ...colors[scheme], [field]: mixHex(original, target, 1 - step / 20) } };
    if (!readabilityIssues(candidate, scheme).some((i) => i.field === field)) return candidate;
  }
  return { ...colors, [scheme]: { ...colors[scheme], [field]: target } };
}
