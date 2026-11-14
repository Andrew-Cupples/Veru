/** Color scheme the module renders in. 'system' follows the OS setting. */
export type ColorScheme = 'light' | 'dark' | 'system';

/**
 * Names of the CSS custom properties a preset may override (see tokens.css).
 * Kept as a union so presets stored in settings can be type-checked when the preset editor arrives.
 */
export type ThemeToken =
  | 'font-ui' | 'font-doc' | 'font-mono' | 'doc-size' | 'doc-leading'
  | 'desk' | 'surface' | 'surface-raised' | 'surface-sunken' | 'paper' | 'paper-edge' | 'paper-shadow'
  | 'ink' | 'ink-muted' | 'ink-faint' | 'rule' | 'rule-strong'
  | 'accent' | 'accent-hover' | 'accent-soft' | 'accent-ink' | 'focus-ring'
  | 'success' | 'success-soft' | 'danger' | 'danger-soft' | 'star'
  | 'outcome-kept' | 'outcome-changed' | 'outcome-rejected' | 'outcome-mixed'
  | 'prompt-bg' | 'prompt-rule' | 'response-ink' | 'code-bg' | 'highlight'
  | 'radius-sm' | 'radius-md' | 'radius-lg' | 'doc-width';

/** A partial set of token overrides, applied on top of the active color scheme. */
export type ThemePreset = Partial<Record<ThemeToken, string>>;

/** Turns a preset into inline CSS variables for the module root. */
export function presetStyle(preset: ThemePreset | undefined): Record<string, string> {
  const style: Record<string, string> = {};
  if (!preset) return style;
  for (const [token, value] of Object.entries(preset)) {
    if (value) style[`--pl-${token}`] = value;
  }
  return style;
}
