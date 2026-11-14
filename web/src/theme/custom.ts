import { mixHex, readableInk } from './contrast';
import { defineTheme, type Theme } from './theme';
import type { ColorScheme } from './tokens';

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
      'ink-faint': mixHex(c.text, c.card, 0.48),
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
