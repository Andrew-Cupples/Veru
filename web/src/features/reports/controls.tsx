import { useId, type ReactNode } from 'react';
import { radioGroup } from '../../a11y/radioGroup';
import styles from './Reports.module.css';
import dq from '../data-query/DataQuery.module.css';
import { useT } from '../../i18n/I18nProvider';

/* Small labelled inputs for the report inspector. Every control has a visible label tied to it. */

export function Field({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: string }) {
  const id = useId();
  return (
    <div className={styles.control}>
      <label htmlFor={id} className={dq.fieldLabel}>
        {label}
      </label>
      {children(id)}
      {hint && <span className={styles.controlHint}>{hint}</span>}
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Field label={label}>
      {(id) => (
        <input id={id} className={dq.input} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} className={dq.input} value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/** A slider with its value shown beside it (and announced by the native range input). */
export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => String(v),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <div className={styles.rangeRow}>
          <input
            id={id}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            aria-valuetext={format(value)}
            onChange={(e) => onChange(e.target.valueAsNumber)}
          />
          <output htmlFor={id} className={styles.rangeValue}>
            {format(value)}
          </output>
        </div>
      )}
    </Field>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`${dq.checkbox} ${styles.toggle}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** Mutually exclusive buttons as a radio group: one Tab stop, arrow keys to move. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const labelId = useId();
  const { onKeyDown, radioProps } = radioGroup(
    options.map((o) => o.value),
    value,
    onChange,
  );
  return (
    <div className={styles.control}>
      <span id={labelId} className={dq.fieldLabel}>
        {label}
      </span>
      <div className={`${dq.segmented} ${styles.segmentedFull}`} role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown}>
        {options.map((o) => (
          <button key={o.value} type="button" {...radioProps(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A colour picker with a reset back to automatic (palette / theme). */
export function ColorField({
  label,
  value,
  auto,
  onChange,
}: {
  label: string;
  /** null = automatic. */
  value: string | null;
  /** The colour used when automatic, shown in the swatch. */
  auto: string;
  onChange: (v: string | null) => void;
}) {
  const t = useT();
  return (
    <Field label={label}>
      {(id) => (
        <div className={styles.colorRow}>
          <input id={id} type="color" className={styles.colorInput} value={value ?? auto} onChange={(e) => onChange(e.target.value)} />
          {value ? (
            <button type="button" className={dq.linkButton} onClick={() => onChange(null)} aria-label={t.reports.resetAuto(label.toLowerCase())}>
              {t.reports.auto}
            </button>
          ) : (
            <span className={styles.controlHint}>{t.reports.auto}</span>
          )}
        </div>
      )}
    </Field>
  );
}
