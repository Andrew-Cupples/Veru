import { useId, useRef, useState, type ReactNode } from 'react';
import type { IntervalOption, PriceSeries, RangeOption } from '../../api/client';
import { ApiError } from '../../api/client';
import { COLUMNS, CONDITION_COLUMN_BY_KEY, OPERATORS_BY_KIND, isActive, type ColumnDef, type Condition, type ConditionColumn, type Operator } from './query';
import { SymbolCombobox } from './SymbolCombobox';
import type { DataSource } from './useDataSource';
import styles from './DataQuery.module.css';

/*
 * The building blocks every data page uses to choose its data: FROM (symbol, interval, range, pre/post),
 * WHERE conditions, multi-select chips with All / None, and the load states around a fetched series.
 */

const SESSIONS = ['pre', 'regular', 'post'] as const;

export function rangeFits(interval: IntervalOption | undefined, range: RangeOption): boolean {
  if (!interval || interval.maxLookbackDays == null) return true;
  return range.days != null && range.days <= interval.maxLookbackDays;
}

/** One labelled row of the editor, keyword on the left like a SQL clause. */
export function Clause({ keyword, children }: { keyword: string; children: ReactNode }) {
  return (
    <div className={styles.clause}>
      <span className={styles.keyword}>{keyword}</span>
      <div className={styles.clauseBody}>{children}</div>
    </div>
  );
}

/** Symbol, interval, range, pre/post and Run. Place inside a form whose onSubmit is `ds.submit`. */
export function SourceFields({ ds }: { ds: DataSource }) {
  const ids = useId();
  const { draft, ready, running, symbolError, symbolRef } = ds;
  const intervals = ds.options.data?.intervals ?? [];
  const ranges = ds.options.data?.ranges ?? [];
  const selectedInterval = intervals.find((i) => i.code === draft.interval);

  const changeInterval = (code: string) => {
    const interval = intervals.find((i) => i.code === code);
    const current = ranges.find((r) => r.code === draft.range);
    // Keep the range if it still fits; otherwise fall back to the longest one that does.
    const range = current && rangeFits(interval, current)
      ? current.code
      : [...ranges].reverse().find((r) => rangeFits(interval, r))?.code ?? draft.range;
    ds.changeSourceOption({ ...draft, interval: code, range });
  };

  return (
    <>
      <div className={styles.fromRow}>
        <div className={styles.field}>
          <label htmlFor={`${ids}-symbol`} className={styles.fieldLabel}>
            Stock
          </label>
          <span className={styles.symbolGroup}>
            <SymbolCombobox
              id={`${ids}-symbol`}
              inputRef={symbolRef}
              className={`${styles.input} ${styles.symbolInput}`}
              value={draft.symbol}
              onChange={(symbol) => ds.setDraft({ ...draft, symbol })}
              onPick={ds.switchTo}
              favourites={ds.favourites}
              recent={ds.recent}
              names={ds.names}
              onMatches={ds.learnMatches}
              keyShortcut="/"
              invalid={symbolError}
              describedBy={symbolError ? `${ids}-symbol-error` : undefined}
            />
            <FavouriteToggle ds={ds} />
          </span>
        </div>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Interval</span>
          <select className={styles.input} value={draft.interval} disabled={!ready} onChange={(e) => changeInterval(e.target.value)}>
            {!ready && <option value={draft.interval}>loading…</option>}
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
            disabled={!ready}
            onChange={(e) => ds.changeSourceOption({ ...draft, range: e.target.value })}
          >
            {!ready && <option value={draft.range}>loading…</option>}
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
            onChange={(e) => ds.changeSourceOption({ ...draft, extendedHours: e.target.checked })}
          />
          Pre/post market
        </label>
        {/* aria-disabled rather than disabled: the button keeps focus while running and stays discoverable. */}
        <button type="submit" className={styles.runButton} aria-disabled={!ready || running}>
          {running ? 'Running…' : 'Run'}
        </button>
      </div>
      {symbolError && (
        <p id={`${ids}-symbol-error`} className={styles.fieldError} role="alert">
          Enter a stock to query, like TSLA.
        </p>
      )}
    </>
  );
}

/** Star for the loaded stock: favourites come first in suggestions and start the comparison on Compare. */
function FavouriteToggle({ ds }: { ds: DataSource }) {
  const symbol = ds.source.symbol;
  if (!symbol) return null;
  const on = ds.favourites.includes(symbol);
  return (
    <button
      type="button"
      className={styles.starButton}
      aria-pressed={on}
      aria-label={`Favourite ${symbol}`}
      title={on ? `Remove ${symbol} from favourites` : `Add ${symbol} to favourites`}
      onClick={() => ds.toggleFavourite(symbol)}
    >
      <span aria-hidden="true">{on ? '★' : '☆'}</span>
    </button>
  );
}

export interface ChipOption<K extends string> {
  key: K;
  label: string;
  description?: string;
}

/**
 * Toggle chips for picking several items, with All and None for one-click bulk changes.
 * The selection is always returned in the options' order, whatever the click order.
 */
export function MultiSelectChips<K extends string>({
  label,
  options,
  selected,
  onChange,
  bulk = true,
}: {
  /** Names the group for screen readers and the All / None buttons. */
  label: string;
  options: readonly ChipOption<K>[];
  selected: readonly K[];
  onChange: (next: K[]) => void;
  bulk?: boolean;
}) {
  const toggle = (key: K) => {
    const set = new Set(selected);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    onChange(options.map((o) => o.key).filter((k) => set.has(k)));
  };
  const all = selected.length === options.length;
  const none = selected.length === 0;

  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className={styles.chip}
          aria-pressed={selected.includes(o.key)}
          title={o.description}
          onClick={() => toggle(o.key)}
        >
          {o.label}
        </button>
      ))}
      {bulk && (
        <span className={styles.bulk}>
          <button
            type="button"
            className={styles.linkButton}
            aria-label={`Select all ${label.toLowerCase()}`}
            aria-disabled={all}
            onClick={() => !all && onChange(options.map((o) => o.key))}
          >
            all
          </button>
          <span aria-hidden="true" className={styles.bulkDivider}>/</span>
          <button
            type="button"
            className={styles.linkButton}
            aria-label={`Select no ${label.toLowerCase()}`}
            aria-disabled={none}
            onClick={() => !none && onChange([])}
          >
            none
          </button>
        </span>
      )}
    </div>
  );
}

/** WHERE: AND-ed conditions over the raw bar columns. New conditions take focus; removing one returns it to Add. */
export function ConditionsEditor({
  where,
  onChange,
  columns = COLUMNS,
  defaultColumn = 'volume',
}: {
  where: readonly Condition[];
  onChange: (where: Condition[]) => void;
  /** The columns a condition can test; the raw bar columns unless given. */
  columns?: readonly ColumnDef<ConditionColumn>[];
  defaultColumn?: ConditionColumn;
}) {
  const [newConditionId, setNewConditionId] = useState<string | null>(null);
  const addConditionRef = useRef<HTMLButtonElement>(null);

  const update = (id: string, patch: Partial<Condition>) => onChange(where.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const add = () => {
    const id = crypto.randomUUID();
    setNewConditionId(id);
    const kind = CONDITION_COLUMN_BY_KEY[defaultColumn].kind;
    onChange([...where, { id, column: defaultColumn, operator: OPERATORS_BY_KIND[kind][0]!, value: '' }]);
  };

  const remove = (id: string) => {
    onChange(where.filter((w) => w.id !== id));
    addConditionRef.current?.focus();
  };

  return (
    <div className={styles.conditions}>
      {where.map((c, i) => (
        <ConditionRow
          key={c.id}
          condition={c}
          index={i}
          columns={columns}
          autoFocus={c.id === newConditionId}
          onChange={(patch) => update(c.id, patch)}
          onRemove={() => remove(c.id)}
        />
      ))}
      <span className={styles.inlineRow}>
        <button ref={addConditionRef} type="button" className={styles.linkButton} onClick={add}>
          <span aria-hidden="true">+ </span>
          Add condition
        </button>
        {where.length > 1 && (
          <button type="button" className={styles.linkButton} onClick={() => onChange([])}>
            Clear all
          </button>
        )}
      </span>
    </div>
  );
}

function ConditionRow({
  condition,
  index,
  columns,
  autoFocus,
  onChange,
  onRemove,
}: {
  condition: Condition;
  index: number;
  columns: readonly ColumnDef<ConditionColumn>[];
  autoFocus: boolean;
  onChange: (patch: Partial<Condition>) => void;
  onRemove: () => void;
}) {
  const errorId = useId();
  const n = index + 1;
  const kind = CONDITION_COLUMN_BY_KEY[condition.column].kind;
  const operators = OPERATORS_BY_KIND[kind];
  const invalid = condition.value.trim() !== '' && !isActive(condition);
  const choicesOf = (column: ConditionColumn) =>
    CONDITION_COLUMN_BY_KEY[column].choices ?? (CONDITION_COLUMN_BY_KEY[column].kind === 'session' ? SESSIONS : null);
  const choices = choicesOf(condition.column);

  const changeColumn = (column: ConditionColumn) => {
    const nextKind = CONDITION_COLUMN_BY_KEY[column].kind;
    const nextOps = OPERATORS_BY_KIND[nextKind];
    const nextChoices = choicesOf(column);
    const keep = nextKind === kind && (!nextChoices || nextChoices.includes(condition.value));
    onChange({
      column,
      operator: nextOps.includes(condition.operator) ? condition.operator : nextOps[0]!,
      value: keep ? condition.value : '',
    });
  };

  return (
    <div className={styles.conditionWrap} role="group" aria-label={`Condition ${n}`}>
      <div className={styles.condition}>
        <span className={styles.conjunction}>{index === 0 ? '' : 'AND'}</span>
        <select
          className={styles.input}
          aria-label={`Condition ${n} column`}
          value={condition.column}
          onChange={(e) => changeColumn(e.target.value as ConditionColumn)}
        >
          {columns.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
        <select
          className={`${styles.input} ${styles.operator}`}
          aria-label={`Condition ${n} operator`}
          value={condition.operator}
          onChange={(e) => onChange({ operator: e.target.value as Operator })}
        >
          {operators.map((op) => (
            <option key={op} value={op}>{op === '!=' ? '≠' : op === '>=' ? '≥' : op === '<=' ? '≤' : op}</option>
          ))}
        </select>
        {choices && condition.operator !== 'contains' ? (
          <select
            className={styles.input}
            aria-label={`Condition ${n} value`}
            autoFocus={autoFocus}
            value={condition.value}
            onChange={(e) => onChange({ value: e.target.value })}
          >
            <option value="">choose…</option>
            {choices.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : (
          <input
            className={styles.input}
            aria-label={`Condition ${n} value`}
            autoFocus={autoFocus}
            aria-invalid={invalid}
            aria-describedby={invalid ? errorId : undefined}
            inputMode={kind === 'number' ? 'decimal' : 'text'}
            placeholder={placeholderFor(condition.column)}
            value={condition.value}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        )}
        <button type="button" className={styles.iconButton} aria-label={`Remove condition ${n}`} onClick={onRemove}>
          ×
        </button>
      </div>
      {invalid && (
        <p id={errorId} className={styles.fieldError}>
          {CONDITION_COLUMN_BY_KEY[condition.column].label} needs a number, like {placeholderFor(condition.column)}.
        </p>
      )}
    </div>
  );
}

function placeholderFor(column: ConditionColumn): string {
  switch (column) {
    case 'date': return 'YYYY-MM-DD';
    case 'clock': return 'HH:MM';
    case 'time': return '2026-11-13T09:30';
    case 'volume': return '1000000';
    default: return '0.00';
  }
}

/** Shown when the API can't be reached at all. */
export function ApiAlert({ ds }: { ds: DataSource }) {
  if (!ds.options.isError) return null;
  return (
    <div className={styles.alert} role="alert">
      <span>
        <strong>Market data API not reachable.</strong> Start it with <code>npm run api</code> (or everything with{' '}
        <code>npm run dev</code>). This page reconnects automatically.
      </span>
    </div>
  );
}

/**
 * The states around a fetch: nothing chosen yet (quick picks), failed (with retry), first load,
 * and finally the loaded series handed to `children`.
 */
export function SeriesGate({ ds, children }: { ds: DataSource; children: (data: PriceSeries) => ReactNode }) {
  const { source, series } = ds;
  if (!source.symbol) {
    return (
      <div className={styles.empty}>
        <p id="quick-picks-label">Enter a stock and press Enter, or pick one to load it now:</p>
        <div className={styles.chips} role="group" aria-labelledby="quick-picks-label">
          {ds.picks.map((symbol) => (
            <button key={symbol} type="button" className={styles.chip} onClick={() => ds.run({ ...ds.draft, symbol })}>
              {symbol}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (series.isError) {
    return (
      <div className={styles.alert} role="alert">
        <strong>{series.error instanceof ApiError && series.error.status === 404 ? 'Stock not found. ' : 'Query failed. '}</strong>
        {series.error.message}
        <button type="button" className={styles.linkButton} onClick={() => series.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (!series.data) {
    return (
      <div className={styles.loading} aria-busy="true">
        Loading {source.symbol}…
      </div>
    );
  }
  return <>{children(series.data)}</>;
}

/** Yahoo sometimes serves coarser bars than asked for long ranges; say so. 60m and 1h are the same thing. */
export function GranularityNotice({ data }: { data: PriceSeries }) {
  const a = data.granularity;
  const b = data.query.interval;
  const same = a === b || (a === '1h' && b === '60m') || (a === '60m' && b === '1h');
  if (same) return null;
  return (
    <div className={styles.notice} role="note">
      Yahoo returned <strong>{a}</strong> bars instead of {b} for this range.
    </div>
  );
}

/** A polite one-line status for screen readers: loading / n rows. */
export function loadStatus(ds: DataSource, loadedText: string): string {
  if (!ds.source.symbol || ds.series.isError) return '';
  if (!ds.series.data || ds.series.isFetching) return `Loading ${ds.source.symbol}`;
  return loadedText;
}
