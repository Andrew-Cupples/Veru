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
import { formatNumber, useT } from '../../i18n/I18nProvider';
import { themeName } from './themeText';
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
  const t = useT();
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
          aria-label={t.custom.picker(label)}
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
          {t.custom.hexError}
        </p>
      )}
      {issues.length > 0 && (
        <div className={styles.issue}>
          <p id={`${id}-issue`}>
            {t.custom.hardToRead(issues[0]!.where.toLowerCase(), formatNumber(issues[0]!.ratio, { maximumFractionDigits: 1, minimumFractionDigits: 1 }), formatNumber(issues[0]!.min), issues.length - 1)}
          </p>
          <button
            type="button"
            className={styles.fixButton}
            aria-label={t.custom.fixLabel(label)}
            onClick={() => {
              onFix();
              // The Fix button goes away once fixed; keep keyboard focus on this color instead of losing it.
              hexRef.current?.focus();
            }}
          >
            {t.custom.fix}
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
  const t = useT();
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
        <div className={styles.segmented} role="radiogroup" aria-label={t.custom.colorsToEdit} onKeyDown={tabs.onKeyDown}>
          {SCHEMES.map((s) => (
            <button key={s} type="button" {...tabs.radioProps(s)}>
              {s === 'light' ? t.custom.lightColors : t.custom.darkColors}
            </button>
          ))}
        </div>
        <label className={styles.startFrom}>
          {t.custom.startFrom}
          <select
            value=""
            onChange={(e) => {
              const base = THEMES.find((th) => th.id === e.target.value);
              if (base) onChange(colorsFromTheme(base));
            }}
          >
            <option value="" disabled>
              {t.custom.pickTheme}
            </option>
            {THEMES.map((th) => (
              <option key={th.id} value={th.id}>
                {themeName(th, t)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Announced when it changes, so screen reader users hear the effect of each color they pick. */}
      <div ref={summaryRef} tabIndex={-1} className={styles.readability} role="status" data-ok={fieldsWithIssues.length === 0}>
        {fieldsWithIssues.length === 0 ? (
          <span>{t.custom.allGood(editing)}</span>
        ) : (
          <>
            <span>{t.custom.someBad(fieldsWithIssues.length, editing)}</span>
            <button type="button" className={styles.fixButton} onClick={fixAll}>
              {t.custom.fixAll}
            </button>
          </>
        )}
        {otherIssues > 0 && (
          <button type="button" className={styles.linkButton} onClick={() => setEditing(editing === 'light' ? 'dark' : 'light')}>
            {t.custom.otherToo(editing === 'light' ? 'dark' : 'light')}
          </button>
        )}
      </div>

      <div className={styles.colorGrid}>
        {CUSTOM_FIELDS.map(({ key }) => (
          <ColorField
            key={key}
            label={t.custom.fields[key].label}
            hint={t.custom.fields[key].hint}
            value={colors[editing][key]}
            issues={issues.filter((i) => i.field === key)}
            onChange={(v) => set(key, v)}
            onFix={() => onChange(fixReadability(colors, editing, key))}
          />
        ))}
      </div>
      <p className={styles.note}>
        {t.custom.derived}
      </p>
    </div>
  );
}
