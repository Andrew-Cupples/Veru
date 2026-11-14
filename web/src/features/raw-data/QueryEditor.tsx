import { useId, type FormEvent, type ReactNode } from 'react';
import type { IntervalOption, QueryOptions, RangeOption } from '../../api/client';
import {
  COLUMNS,
  COLUMN_BY_KEY,
  OPERATORS_BY_KIND,
  isActive,
  type ColumnKey,
  type Condition,
  type Operator,
  type QuerySpec,
  type Source,
} from './query';
import styles from './RawData.module.css';

const SESSIONS = ['pre', 'regular', 'post'] as const;

export function rangeFits(interval: IntervalOption | undefined, range: RangeOption): boolean {
  if (!interval || interval.maxLookbackDays == null) return true;
  return range.days != null && range.days <= interval.maxLookbackDays;
}

interface Props {
  draft: Source;
  onDraftChange: (draft: Source) => void;
  onRun: () => void;
  running: boolean;
  options: QueryOptions | undefined;
  spec: QuerySpec;
  onSpecChange: (spec: QuerySpec) => void;
}

/** The query, laid out clause by clause like SQL. FROM fetches from the API; the rest filters what came back. */
export function QueryEditor({ draft, onDraftChange, onRun, running, options, spec, onSpecChange }: Props) {
  const ids = useId();
  const intervals = options?.intervals ?? [];
  const ranges = options?.ranges ?? [];
  const selectedInterval = intervals.find((i) => i.code === draft.interval);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.symbol.trim()) onRun();
  };

  const changeInterval = (code: string) => {
    const interval = intervals.find((i) => i.code === code);
    const current = ranges.find((r) => r.code === draft.range);
    // Keep the range if it still fits; otherwise fall back to the longest one that does.
    const range = current && rangeFits(interval, current)
      ? current.code
      : [...ranges].reverse().find((r) => rangeFits(interval, r))?.code ?? draft.range;
    onDraftChange({ ...draft, interval: code, range });
  };

  const toggleColumn = (key: ColumnKey) => {
    const selected = new Set(spec.select);
    if (selected.has(key)) selected.delete(key);
    else selected.add(key);
    // Keep the natural column order regardless of click order.
    onSpecChange({ ...spec, select: COLUMNS.map((c) => c.key).filter((k) => selected.has(k)) });
  };

  const updateCondition = (id: string, patch: Partial<Condition>) =>
    onSpecChange({ ...spec, where: spec.where.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const addCondition = () =>
    onSpecChange({
      ...spec,
      where: [...spec.where, { id: crypto.randomUUID(), column: 'volume', operator: '>', value: '' }],
    });

  return (
    <form className={styles.editor} onSubmit={submit} aria-label="Query">
      <Clause keyword="SELECT">
        <div className={styles.chips} role="group" aria-label="Columns">
          {COLUMNS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={styles.chip}
              aria-pressed={spec.select.includes(c.key)}
              title={c.description}
              onClick={() => toggleColumn(c.key)}
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => onSpecChange({ ...spec, select: COLUMNS.map((c) => c.key) })}
          >
            all
          </button>
        </div>
      </Clause>

      <Clause keyword="FROM">
        <div className={styles.fromRow}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Symbol</span>
            <input
              className={`${styles.input} ${styles.symbolInput}`}
              value={draft.symbol}
              onChange={(e) => onDraftChange({ ...draft, symbol: e.target.value.toUpperCase() })}
              placeholder="TSLA"
              maxLength={20}
              spellCheck={false}
              autoComplete="off"
              aria-describedby={`${ids}-symbol-hint`}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Interval</span>
            <select className={styles.input} value={draft.interval} onChange={(e) => changeInterval(e.target.value)}>
              {intervals.map((i) => (
                <option key={i.code} value={i.code}>{i.label}</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Range</span>
            <select
              className={styles.input}
              value={draft.range}
              onChange={(e) => onDraftChange({ ...draft, range: e.target.value })}
            >
              {ranges.map((r) => (
                <option key={r.code} value={r.code} disabled={!rangeFits(selectedInterval, r)}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={draft.extendedHours}
              disabled={selectedInterval ? !selectedInterval.intraday : false}
              onChange={(e) => onDraftChange({ ...draft, extendedHours: e.target.checked })}
            />
            Pre/post market
          </label>
          <button type="submit" className={styles.runButton} disabled={!draft.symbol.trim() || running}>
            {running ? 'Running…' : 'Run'}
          </button>
        </div>
        <p id={`${ids}-symbol-hint`} className={styles.hint}>
          Stocks, ETFs, indexes (^GSPC), crypto (BTC-USD) and currencies (EURUSD=X).
          {selectedInterval?.maxLookbackDays != null &&
            ` Bars of ${selectedInterval.label} reach back ${selectedInterval.maxLookbackDays} days.`}
        </p>
      </Clause>

      <Clause keyword="WHERE">
        <div className={styles.conditions}>
          {spec.where.map((c, i) => (
            <ConditionRow
              key={c.id}
              condition={c}
              first={i === 0}
              onChange={(patch) => updateCondition(c.id, patch)}
              onRemove={() => onSpecChange({ ...spec, where: spec.where.filter((w) => w.id !== c.id) })}
            />
          ))}
          <button type="button" className={styles.linkButton} onClick={addCondition}>
            + condition
          </button>
        </div>
      </Clause>

      <Clause keyword="ORDER BY">
        <div className={styles.inlineRow}>
          <select
            className={styles.input}
            aria-label="Order by column"
            value={spec.orderBy?.column ?? ''}
            onChange={(e) =>
              onSpecChange({
                ...spec,
                orderBy: e.target.value
                  ? { column: e.target.value as ColumnKey, direction: spec.orderBy?.direction ?? 'asc' }
                  : null,
              })
            }
          >
            <option value="">(none)</option>
            {COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          {spec.orderBy && (
            <div className={styles.segmented} role="group" aria-label="Direction">
              {(['asc', 'desc'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={spec.orderBy?.direction === d}
                  onClick={() => onSpecChange({ ...spec, orderBy: spec.orderBy && { ...spec.orderBy, direction: d } })}
                >
                  {d.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </Clause>

      <Clause keyword="LIMIT">
        <input
          className={`${styles.input} ${styles.limitInput}`}
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          aria-label="Row limit"
          placeholder="all"
          value={spec.limit ?? ''}
          onChange={(e) => {
            const n = e.target.valueAsNumber;
            onSpecChange({ ...spec, limit: Number.isFinite(n) && n >= 0 ? Math.floor(n) : null });
          }}
        />
      </Clause>
    </form>
  );
}

function Clause({ keyword, children }: { keyword: string; children: ReactNode }) {
  return (
    <div className={styles.clause}>
      <span className={styles.keyword}>{keyword}</span>
      <div className={styles.clauseBody}>{children}</div>
    </div>
  );
}

function ConditionRow({
  condition,
  first,
  onChange,
  onRemove,
}: {
  condition: Condition;
  first: boolean;
  onChange: (patch: Partial<Condition>) => void;
  onRemove: () => void;
}) {
  const kind = COLUMN_BY_KEY[condition.column].kind;
  const operators = OPERATORS_BY_KIND[kind];
  const invalid = condition.value.trim() !== '' && !isActive(condition);

  const changeColumn = (column: ColumnKey) => {
    const nextKind = COLUMN_BY_KEY[column].kind;
    const nextOps = OPERATORS_BY_KIND[nextKind];
    onChange({
      column,
      operator: nextOps.includes(condition.operator) ? condition.operator : nextOps[0]!,
      value: nextKind === kind ? condition.value : '',
    });
  };

  return (
    <div className={styles.condition}>
      <span className={styles.conjunction}>{first ? '' : 'AND'}</span>
      <select
        className={styles.input}
        aria-label="Column"
        value={condition.column}
        onChange={(e) => changeColumn(e.target.value as ColumnKey)}
      >
        {COLUMNS.map((c) => (
          <option key={c.key} value={c.key}>{c.label}</option>
        ))}
      </select>
      <select
        className={`${styles.input} ${styles.operator}`}
        aria-label="Operator"
        value={condition.operator}
        onChange={(e) => onChange({ operator: e.target.value as Operator })}
      >
        {operators.map((op) => (
          <option key={op} value={op}>{op === '!=' ? '≠' : op === '>=' ? '≥' : op === '<=' ? '≤' : op}</option>
        ))}
      </select>
      {kind === 'session' ? (
        <select
          className={styles.input}
          aria-label="Value"
          value={condition.value}
          onChange={(e) => onChange({ value: e.target.value })}
        >
          <option value="">choose…</option>
          {SESSIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      ) : (
        <input
          className={styles.input}
          aria-label="Value"
          aria-invalid={invalid}
          inputMode={kind === 'number' ? 'decimal' : 'text'}
          placeholder={placeholderFor(condition.column)}
          value={condition.value}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      )}
      <button type="button" className={styles.iconButton} aria-label="Remove condition" onClick={onRemove}>
        ×
      </button>
    </div>
  );
}

function placeholderFor(column: ColumnKey): string {
  switch (column) {
    case 'date': return 'YYYY-MM-DD';
    case 'clock': return 'HH:MM';
    case 'time': return '2026-11-13T09:30';
    case 'volume': return '1000000';
    default: return '0.00';
  }
}
