import type { Messages } from '../../i18n/catalogs';
import type { Theme } from '../../theme/theme';

/*
 * Theme and colour names in the active language, looked up by id and slug. The theme definitions keep
 * their English names (they also name the exported CSS); anything not in the catalog shows as defined.
 */

type ThemeId = keyof Messages['themes'];
type SwatchSlug = keyof Messages['swatches'];

const has = <T extends object>(table: T, key: string): key is Extract<keyof T, string> => Object.hasOwn(table, key);

export const themeName = (theme: Theme, t: Messages) => (has(t.themes, theme.id) ? t.themes[theme.id as ThemeId].name : theme.name);
export const themeTagline = (theme: Theme, t: Messages) =>
  has(t.themes, theme.id) ? t.themes[theme.id as ThemeId].tagline : theme.tagline;
export const swatchName = (slug: string, fallback: string, t: Messages) => (has(t.swatches, slug) ? t.swatches[slug as SwatchSlug] : fallback);
