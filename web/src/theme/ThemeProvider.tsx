import { track } from '../analytics/tracker';
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { ThemePreset } from '@veru/prompt-ledger';
import { themeVariables, type Theme } from './theme';
import { THEMES } from './themes';
import { classic } from './themes/classic';
import { buildCustomTheme, colorsFromTheme, parseCustomTheme, type CustomTheme } from './custom';
import type { ColorScheme, SchemePreference } from './tokens';

const STORAGE = { theme: 'veru.theme', scheme: 'veru.scheme', custom: 'veru.customTheme' } as const;

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private window etc.): the choice just won't survive a reload.
  }
}

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

function useSystemScheme(): ColorScheme {
  return useSyncExternalStore(
    (onChange) => {
      const query = darkQuery();
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => (darkQuery().matches ? 'dark' : 'light'),
  );
}

export interface ThemeState {
  /** Built-in themes plus the user's custom one, in display order. */
  themes: readonly Theme[];
  theme: Theme;
  /** What the user picked. */
  schemePreference: SchemePreference;
  /** What is actually showing. */
  scheme: ColorScheme;
  customColors: CustomTheme;
  setTheme: (id: string) => void;
  setSchemePreference: (scheme: SchemePreference) => void;
  setCustomColors: (colors: CustomTheme) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

/** Names of the variables the provider writes, so it can clear the previous theme's ones. */
let applied: string[] = [];

/**
 * Owns the active theme. It writes the theme's tokens as CSS variables on <html>, plus
 * data-theme / data-scheme attributes. This runs in a layout effect, before the first paint,
 * so there is no flash of the default colors.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState(() => readStored(STORAGE.theme) ?? classic.id);
  const [schemePreference, setSchemePref] = useState<SchemePreference>(() => {
    const stored = readStored(STORAGE.scheme);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  });
  const [customColors, setCustom] = useState(() => parseCustomTheme(readStored(STORAGE.custom), colorsFromTheme(classic)));
  const systemScheme = useSystemScheme();

  const themes = useMemo(() => [...THEMES, buildCustomTheme(customColors)], [customColors]);
  const theme = themes.find((t) => t.id === themeId) ?? classic;
  const scheme = schemePreference === 'system' ? systemScheme : schemePreference;

  useLayoutEffect(() => {
    const root = document.documentElement;
    const vars = themeVariables(theme, scheme);
    for (const name of applied) if (!(name in vars)) root.style.removeProperty(name);
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    applied = Object.keys(vars);
    root.dataset.theme = theme.id;
    root.dataset.scheme = scheme;
    root.style.colorScheme = scheme;
  }, [theme, scheme]);

  const setTheme = useCallback((id: string) => {
    setThemeId(id);
    track('setting', { target: 'theme', detail: id });
    writeStored(STORAGE.theme, id);
  }, []);
  const setSchemePreference = useCallback((value: SchemePreference) => {
    setSchemePref(value);
    track('setting', { target: 'light/dark', detail: value });
    writeStored(STORAGE.scheme, value);
  }, []);
  const setCustomColors = useCallback((colors: CustomTheme) => {
    setCustom(colors);
    writeStored(STORAGE.custom, JSON.stringify(colors));
  }, []);

  const value = useMemo<ThemeState>(
    () => ({ themes, theme, schemePreference, scheme, customColors, setTheme, setSchemePreference, setCustomColors }),
    [themes, theme, schemePreference, scheme, customColors, setTheme, setSchemePreference, setCustomColors],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const state = useContext(ThemeContext);
  if (!state) throw new Error('useTheme must be used inside <ThemeProvider>');
  return state;
}

/**
 * Points the Prompt Ledger's own tokens at the app's, so the module follows the active theme.
 * Values are var() references, so they track theme and scheme changes without remounting the module.
 */
export const LEDGER_PRESET: ThemePreset = {
  desk: 'var(--desk)',
  surface: 'var(--surface)',
  'surface-raised': 'var(--surface-raised)',
  'surface-sunken': 'var(--surface-sunken)',
  paper: 'var(--surface-raised)',
  'paper-shadow': 'var(--shadow)',
  ink: 'var(--ink)',
  'ink-muted': 'var(--ink-muted)',
  'ink-faint': 'var(--ink-faint)',
  rule: 'var(--rule)',
  'rule-strong': 'var(--rule-strong)',
  accent: 'var(--accent)',
  'accent-hover': 'var(--accent-hover)',
  'accent-soft': 'var(--accent-soft)',
  'accent-ink': 'var(--accent-ink)',
  'focus-ring': 'var(--focus-ring)',
  success: 'var(--session-regular)',
  'success-soft': 'color-mix(in srgb, var(--session-regular) 13%, transparent)',
  danger: 'var(--danger)',
  'danger-soft': 'var(--danger-soft)',
  'outcome-kept': 'var(--session-regular)',
  'outcome-changed': 'var(--warning)',
  'outcome-rejected': 'var(--danger)',
  'outcome-mixed': 'var(--keyword)',
  'prompt-bg': 'color-mix(in srgb, var(--accent) 7%, var(--surface-raised))',
  'prompt-rule': 'var(--accent)',
  'response-ink': 'var(--ink)',
  'code-bg': 'var(--surface-sunken)',
};
