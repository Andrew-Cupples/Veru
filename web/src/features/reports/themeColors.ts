import { useMemo } from 'react';
import { useTheme } from '../../theme/ThemeProvider';
import { tokenValue, type Theme } from '../../theme/theme';
import type { ColorScheme } from '../../theme/tokens';
import type { ThemeColors } from './figure';

/** The active theme's colours as concrete values for Plotly, read from the theme itself (not the DOM). */
export function themeColors(theme: Theme, scheme: ColorScheme): ThemeColors {
  const t = (token: Parameters<typeof tokenValue>[2]) => tokenValue(theme, scheme, token);
  return {
    ink: t('ink'),
    inkMuted: t('ink-muted'),
    inkFaint: t('ink-faint'),
    rule: t('rule'),
    ruleStrong: t('rule-strong'),
    surface: t('surface'),
    surfaceRaised: t('surface-raised'),
    accent: t('accent'),
    keyword: t('keyword'),
    up: t('session-regular'),
    down: t('danger'),
    pre: t('session-pre'),
    post: t('session-post'),
    warning: t('warning'),
    fontFamily: "'Inter Variable', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  };
}

export function useThemeColors(): ThemeColors {
  const { theme, scheme } = useTheme();
  return useMemo(() => themeColors(theme, scheme), [theme, scheme]);
}
