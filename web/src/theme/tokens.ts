/**
 * The app's color tokens. Every feature stylesheet reads only these CSS variables (`var(--accent)` etc.),
 * so a theme is just a value for each one, per color scheme.
 *
 * TOKENS is the single list the theme engine, the Personalize page and the contrast checks all read.
 * Adding a token here makes TypeScript ask every theme for a value.
 */
export const TOKEN_GROUPS = ['Surfaces', 'Ink', 'Accent', 'State', 'Sessions', 'Depth'] as const;
export type TokenGroup = (typeof TOKEN_GROUPS)[number];

export const TOKENS = [
  { name: 'desk', group: 'Surfaces', use: 'Page background behind everything' },
  { name: 'surface', group: 'Surfaces', use: 'Header, table header, inputs' },
  { name: 'surface-raised', group: 'Surfaces', use: 'Cards, tables, panels' },
  { name: 'surface-sunken', group: 'Surfaces', use: 'Wells: the SQL preview, tags' },
  { name: 'rule', group: 'Surfaces', use: 'Hairline borders and row dividers' },
  { name: 'rule-strong', group: 'Surfaces', use: 'Input and button borders' },

  { name: 'ink', group: 'Ink', use: 'Body text and headings' },
  { name: 'ink-muted', group: 'Ink', use: 'Secondary text, labels' },
  { name: 'ink-faint', group: 'Ink', use: 'Hints, placeholders, disabled' },

  { name: 'accent', group: 'Accent', use: 'Primary buttons, active tab, links' },
  { name: 'accent-hover', group: 'Accent', use: 'Primary button hover' },
  { name: 'accent-soft', group: 'Accent', use: 'Selected chip, row hover tint' },
  { name: 'accent-ink', group: 'Accent', use: 'Text on an accent background' },
  { name: 'keyword', group: 'Accent', use: 'SQL keywords, second brand color' },
  { name: 'focus-ring', group: 'Accent', use: 'Keyboard focus outline (box-shadow)', kind: 'shadow' },

  { name: 'danger', group: 'State', use: 'Errors, invalid input, price down' },
  { name: 'danger-soft', group: 'State', use: 'Error and invalid backgrounds' },
  { name: 'warning', group: 'State', use: 'Warnings' },
  { name: 'warning-soft', group: 'State', use: 'Notice backgrounds' },

  { name: 'session-pre', group: 'Sessions', use: 'Pre-market bars' },
  { name: 'session-regular', group: 'Sessions', use: 'Regular session bars, price up' },
  { name: 'session-post', group: 'Sessions', use: 'After-hours bars' },

  { name: 'shadow', group: 'Depth', use: 'Card shadow', kind: 'shadow' },
] as const satisfies readonly { name: string; group: TokenGroup; use: string; kind?: 'shadow' }[];

export type ThemeToken = (typeof TOKENS)[number]['name'];
export type TokenValues = Record<ThemeToken, string>;
export type ColorScheme = 'light' | 'dark';
export type SchemePreference = ColorScheme | 'system';

/**
 * Text/background pairs worth checking in every theme. `min` is the WCAG AA ratio for how the pair is used:
 * 4.5 for normal text, 3 for large text, icons and hints the UI never relies on.
 */
export const CONTRAST_PAIRS: readonly { fg: ThemeToken; bg: ThemeToken; min: number; where: string }[] = [
  { fg: 'ink', bg: 'surface-raised', min: 4.5, where: 'Card text' },
  { fg: 'ink', bg: 'desk', min: 4.5, where: 'Page headings' },
  { fg: 'ink-muted', bg: 'surface-raised', min: 4.5, where: 'Labels on cards' },
  { fg: 'ink-muted', bg: 'surface', min: 4.5, where: 'Nav links, table headers' },
  { fg: 'ink-faint', bg: 'surface-raised', min: 3, where: 'Hints' },
  { fg: 'accent-ink', bg: 'accent', min: 4.5, where: 'Primary button label' },
  { fg: 'accent-ink', bg: 'accent-hover', min: 4.5, where: 'Primary button hover' },
  { fg: 'accent', bg: 'surface-raised', min: 4.5, where: 'Links, selected chips' },
  { fg: 'keyword', bg: 'surface-raised', min: 4.5, where: 'SQL keywords' },
  { fg: 'danger', bg: 'surface-raised', min: 4.5, where: 'Price down, errors' },
  { fg: 'session-pre', bg: 'surface-raised', min: 4.5, where: 'Pre tag' },
  { fg: 'session-regular', bg: 'surface-raised', min: 4.5, where: 'Regular tag, price up' },
  { fg: 'session-post', bg: 'surface-raised', min: 4.5, where: 'Post tag' },
];
