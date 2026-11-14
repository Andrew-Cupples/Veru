/** WCAG 2 contrast helpers. Only opaque hex colors can be measured; anything else returns null. */

export function parseHex(value: string): [number, number, number] | null {
  const hex = value.trim().replace(/^#/, '');
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(fg: string, bg: string): number | null {
  const a = parseHex(fg);
  const b = parseHex(bg);
  if (!a || !b) return null;
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Blends two hex colors; `amount` is how much of `a` to keep (0 to 1). Returns hex. */
export function mixHex(a: string, b: string, amount: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return a;
  return `#${x.map((c, i) => Math.round(c * amount + y[i]! * (1 - amount)).toString(16).padStart(2, '0')).join('')}`;
}

/** Black or white, whichever reads better on the given background. */
export function readableInk(bg: string): string {
  const dark = contrastRatio('#111111', bg);
  const light = contrastRatio('#ffffff', bg);
  if (dark === null || light === null) return 'currentColor';
  return dark >= light ? '#111111' : '#ffffff';
}
