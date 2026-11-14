import type { CSSProperties } from 'react';
import { themeVariables, type Theme } from '../../theme/theme';
import type { ColorScheme } from '../../theme/tokens';

/**
 * Inline style that re-scopes every token to one theme and scheme, so a preview can show
 * a theme (or the other scheme) without applying it to the whole app.
 */
export function scopeStyle(theme: Theme, scheme: ColorScheme): CSSProperties {
  return {
    ...themeVariables(theme, scheme),
    colorScheme: scheme,
    background: 'var(--desk)',
    color: 'var(--ink)',
  } as CSSProperties;
}
