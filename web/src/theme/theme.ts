import type { ColorScheme, ThemeToken, TokenValues } from './tokens';

/** A named color shown on the Personalize page and exposed as `--palette-<slug>`. */
export interface Swatch {
  slug: string;
  name: string;
  value: string;
}

export interface Theme {
  id: string;
  name: string;
  tagline: string;
  /** Emoji shown on the theme card. */
  emoji: string;
  /** The full token set for each scheme. */
  schemes: Record<ColorScheme, TokenValues>;
  /** Named colors the theme is built from, per scheme. */
  palette?: Record<ColorScheme, Swatch[]>;
  /** Also restyle the Prompt Ledger module from these tokens (off for Classic, which matches the ledger already). */
  skinsLedger: boolean;
}

/** Tokens every theme must set. The rest are derived from these unless the theme overrides them. */
export type BaseTokens = Omit<TokenValues, 'accent-soft' | 'focus-ring' | 'danger-soft' | 'warning-soft' | 'shadow'> &
  Partial<TokenValues>;

const tint = (token: string, percent: number) => `color-mix(in srgb, ${token} ${percent}%, transparent)`;

/** Fills in the soft tints, focus ring and shadow from the base colors, so a new theme stays short. */
export function completeTokens(base: BaseTokens, scheme: ColorScheme): TokenValues {
  const dark = scheme === 'dark';
  return {
    'accent-soft': tint(base.accent, dark ? 16 : 12),
    'focus-ring': `0 0 0 3px ${tint(base.accent, dark ? 38 : 30)}`,
    'danger-soft': tint(base.danger, dark ? 15 : 10),
    'warning-soft': tint(base.warning, dark ? 15 : 13),
    shadow: dark
      ? '0 1px 2px rgb(0 0 0 / 0.4), 0 10px 32px -8px rgb(0 0 0 / 0.6)'
      : `0 1px 2px ${tint(base.ink, 7)}, 0 8px 28px -6px ${tint(base.ink, 14)}`,
    ...base,
  };
}

export interface ThemeDefinition extends Omit<Theme, 'schemes' | 'skinsLedger'> {
  schemes: Record<ColorScheme, BaseTokens>;
  skinsLedger?: boolean;
}

export function defineTheme(def: ThemeDefinition): Theme {
  return {
    ...def,
    skinsLedger: def.skinsLedger ?? true,
    schemes: { light: completeTokens(def.schemes.light, 'light'), dark: completeTokens(def.schemes.dark, 'dark') },
  };
}

/** CSS variables for a theme in one scheme, ready for a `style` prop or `documentElement.style`. */
export function themeVariables(theme: Theme, scheme: ColorScheme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [token, value] of Object.entries(theme.schemes[scheme])) vars[`--${token}`] = value;
  for (const swatch of theme.palette?.[scheme] ?? []) vars[`--palette-${swatch.slug}`] = swatch.value;
  return vars;
}

/** The theme as a CSS snippet, for copying out of the Personalize page. */
export function themeToCss(theme: Theme): string {
  const block = (selector: string, scheme: ColorScheme) =>
    `${selector} {\n${Object.entries(themeVariables(theme, scheme))
      .map(([name, value]) => `  ${name}: ${value};`)
      .join('\n')}\n}`;
  return `/* ${theme.name} */\n${block(`[data-theme='${theme.id}'][data-scheme='light']`, 'light')}\n\n${block(
    `[data-theme='${theme.id}'][data-scheme='dark']`,
    'dark',
  )}\n`;
}

export function tokenValue(theme: Theme, scheme: ColorScheme, token: ThemeToken): string {
  return theme.schemes[scheme][token];
}
