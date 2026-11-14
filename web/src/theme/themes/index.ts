import type { Theme } from '../theme';
import { classic } from './classic';
import { leafGreen } from './leafGreen';
import { hearth } from './hearth';
import { tidepool } from './tidepool';

/**
 * The built-in themes, in display order. The user's Custom theme is added after these by ThemeProvider.
 * To add one: copy a theme file, change its id/name/colors, and list it here.
 */
export const THEMES: readonly Theme[] = [classic, leafGreen, hearth, tidepool];
