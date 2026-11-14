import { useState } from 'react';
import { CUSTOM_FIELDS, colorsFromTheme, type CustomColors, type CustomTheme } from '../../theme/custom';
import { THEMES } from '../../theme/themes';
import type { ColorScheme } from '../../theme/tokens';
import styles from './Personalize.module.css';

const HEX = /^#[0-9a-f]{6}$/i;

/** A color picker plus a hex box. The hex box only commits complete, valid colors. */
function ColorField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    // The color changed from outside (picker, "start from"): show it in the hex box.
    setShown(value);
    setDraft(value);
  }

  return (
    <div className={styles.colorField}>
      <input
        type="color"
        className={styles.colorPicker}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} color`}
      />
      <div className={styles.colorText}>
        <span className={styles.colorLabel}>{label}</span>
        <span className={styles.colorHint}>{hint}</span>
      </div>
      <input
        className={styles.hexInput}
        value={draft}
        spellCheck={false}
        aria-label={`${label} hex`}
        aria-invalid={!HEX.test(draft)}
        onChange={(e) => {
          const next = e.target.value.trim();
          setDraft(next);
          const withHash = next.startsWith('#') ? next : `#${next}`;
          if (HEX.test(withHash)) onChange(withHash.toLowerCase());
        }}
        onBlur={() => setDraft(value)}
      />
    </div>
  );
}

interface Props {
  colors: CustomTheme;
  scheme: ColorScheme;
  onChange: (colors: CustomTheme) => void;
}

/** Edit the custom theme's colors, one scheme at a time. Everything else is derived from these. */
export function CustomThemeEditor({ colors, scheme, onChange }: Props) {
  const [editing, setEditing] = useState<ColorScheme>(scheme);

  const set = (key: keyof CustomColors, value: string) =>
    onChange({ ...colors, [editing]: { ...colors[editing], [key]: value } });

  return (
    <div className={styles.editor}>
      <div className={styles.editorBar}>
        <div className={styles.segmented} role="radiogroup" aria-label="Scheme to edit">
          {(['light', 'dark'] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={editing === s} onClick={() => setEditing(s)}>
              {s === 'light' ? 'Light colors' : 'Dark colors'}
            </button>
          ))}
        </div>
        <label className={styles.startFrom}>
          Start from
          <select
            value=""
            onChange={(e) => {
              const base = THEMES.find((t) => t.id === e.target.value);
              if (base) onChange(colorsFromTheme(base));
            }}
          >
            <option value="" disabled>
              Pick a theme…
            </option>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.colorGrid}>
        {CUSTOM_FIELDS.map(({ key, label, hint }) => (
          <ColorField key={key} label={label} hint={hint} value={colors[editing][key]} onChange={(v) => set(key, v)} />
        ))}
      </div>
      <p className={styles.note}>
        Borders, muted text and hover shades are worked out from these. Changes save automatically.
      </p>
    </div>
  );
}
