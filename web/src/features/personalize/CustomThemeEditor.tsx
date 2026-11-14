import { useId, useRef, useState } from 'react';
import {
  CUSTOM_FIELDS,
  colorsFromTheme,
  fixReadability,
  readabilityIssues,
  type CustomColors,
  type CustomTheme,
  type ReadabilityIssue,
} from '../../theme/custom';
import { THEMES } from '../../theme/themes';
import type { ColorScheme } from '../../theme/tokens';
import { radioGroup } from '../../a11y/radioGroup';
import styles from './Personalize.module.css';

const HEX = /^#?[0-9a-f]{6}$/i;
const SCHEMES = ['light', 'dark'] as const;

interface FieldProps {
  label: string;
  hint: string;
  value: string;
  issues: ReadabilityIssue[];
  onChange: (v: string) => void;
  onFix: () => void;
}

/** A color picker, a hex box that only commits valid colors, and any readability warning for this color. */
function ColorField({ label, hint, value, issues, onChange, onFix }: FieldProps) {
  const id = useId();
  const hexRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    // The color changed from outside (picker, "start from", fix): show it in the hex box.
    setShown(value);
    setDraft(value);
  }
  const invalid = !HEX.test(draft);
  const describedBy = [`${id}-hint`, invalid && `${id}-error`, issues.length && `${id}-issue`].filter(Boolean).join(' ');

  return (
    <div className={styles.colorField} data-issue={issues.length > 0 || undefined}>
      <div className={styles.colorRow}>
        <input
          type="color"
          className={styles.colorPicker}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} color picker`}
          aria-describedby={describedBy}
        />
        <div className={styles.colorText}>
          <label className={styles.colorLabel} htmlFor={`${id}-hex`}>
            {label}
          </label>
          <span id={`${id}-hint`} className={styles.colorHint}>
            {hint}
          </span>
        </div>
        <input
          id={`${id}-hex`}
          ref={hexRef}
          className={styles.hexInput}
          value={draft}
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(e) => {
            const next = e.target.value.trim();
            setDraft(next);
            if (HEX.test(next)) onChange(`#${next.replace('#', '').toLowerCase()}`);
          }}
          // Leaving an unfinished value puts the last good color back, so the box never shows a stale lie.
          onBlur={() => setDraft(value)}
        />
      </div>
      {invalid && (
        <p id={`${id}-error`} className={styles.fieldError}>
          Use 6 hex digits, like #3d5afe.
        </p>
      )}
      {issues.length > 0 && (
        <div className={styles.issue}>
          <p id={`${id}-issue`}>
            Hard to read: {issues[0]!.where.toLowerCase()} at {issues[0]!.ratio.toFixed(1)}:1 (needs {issues[0]!.min}:1)
            {issues.length > 1 && ` (and ${issues.length - 1} more ${issues.length === 2 ? 'place' : 'places'})`}.
          </p>
          <button
            type="button"
            className={styles.fixButton}
            aria-label={`Fix ${label}`}
            onClick={() => {
              onFix();
              // The Fix button goes away once fixed; keep keyboard focus on this color instead of losing it.
              hexRef.current?.focus();
            }}
          >
            Fix
          </button>
        </div>
      )}
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
  const summaryRef = useRef<HTMLDivElement>(null);
  const tabs = radioGroup(SCHEMES, editing, setEditing);

  const issues = readabilityIssues(colors, editing);
  const otherIssues = readabilityIssues(colors, editing === 'light' ? 'dark' : 'light').length;
  const fieldsWithIssues = [...new Set(issues.map((i) => i.field))];

  const set = (key: keyof CustomColors, value: string) =>
    onChange({ ...colors, [editing]: { ...colors[editing], [key]: value } });

  const fixAll = () => {
    onChange(fieldsWithIssues.reduce((acc, field) => fixReadability(acc, editing, field), colors));
    // "Fix all" disappears once everything passes; land focus on the result line rather than the page.
    summaryRef.current?.focus();
  };

  return (
    <div className={styles.editor}>
      <div className={styles.editorBar}>
        <div className={styles.segmented} role="radiogroup" aria-label="Colors to edit" onKeyDown={tabs.onKeyDown}>
          {SCHEMES.map((s) => (
            <button key={s} type="button" {...tabs.radioProps(s)}>
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

      {/* Announced when it changes, so screen reader users hear the effect of each color they pick. */}
      <div ref={summaryRef} tabIndex={-1} className={styles.readability} role="status" data-ok={fieldsWithIssues.length === 0}>
        {fieldsWithIssues.length === 0 ? (
          <span>✓ Everything in {editing} mode is easy to read.</span>
        ) : (
          <>
            <span>
              {fieldsWithIssues.length} {fieldsWithIssues.length === 1 ? 'color is' : 'colors are'} hard to read in {editing}{' '}
              mode.
            </span>
            <button type="button" className={styles.fixButton} onClick={fixAll}>
              Fix all
            </button>
          </>
        )}
        {otherIssues > 0 && (
          <button type="button" className={styles.linkButton} onClick={() => setEditing(editing === 'light' ? 'dark' : 'light')}>
            {editing === 'light' ? 'Dark' : 'Light'} mode has issues too
          </button>
        )}
      </div>

      <div className={styles.colorGrid}>
        {CUSTOM_FIELDS.map(({ key, label, hint }) => (
          <ColorField
            key={key}
            label={label}
            hint={hint}
            value={colors[editing][key]}
            issues={issues.filter((i) => i.field === key)}
            onChange={(v) => set(key, v)}
            onFix={() => onChange(fixReadability(colors, editing, key))}
          />
        ))}
      </div>
      <p className={styles.note}>
        Borders, muted text and hover shades are worked out from these. Changes save automatically.
      </p>
    </div>
  );
}
