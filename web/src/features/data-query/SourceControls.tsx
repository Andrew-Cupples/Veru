import { useId, type ReactNode } from 'react';
import type { IntervalOption, PriceSeries, RangeOption } from '../../api/client';
import { ApiError } from '../../api/client';
import { SymbolCombobox } from './SymbolCombobox';
import type { DataSource } from './useDataSource';
import { messages, useT } from '../../i18n/I18nProvider';
import styles from './DataQuery.module.css';

/*
 * The building blocks every data page uses to choose its data: FROM (symbol, interval, range, pre/post),
 * multi-select chips with All / None, and the load states around a fetched series.
 */


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
  const t = useT();
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
            {t.source.stock}
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
              invalid={symbolError}
              describedBy={symbolError ? `${ids}-symbol-error` : undefined}
            />
            <FavouriteToggle ds={ds} />
          </span>
        </div>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t.source.interval}</span>
          <select className={styles.input} value={draft.interval} disabled={!ready} onChange={(e) => changeInterval(e.target.value)}>
            {!ready && <option value={draft.interval}>{t.common.loading}</option>}
            {intervals.map((i) => (
              <option key={i.code} value={i.code}>{t.intervals[i.code] ?? i.label}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t.source.range}</span>
          <select
            className={styles.input}
            value={draft.range}
            disabled={!ready}
            onChange={(e) => ds.changeSourceOption({ ...draft, range: e.target.value })}
          >
            {!ready && <option value={draft.range}>{t.common.loading}</option>}
            {ranges.map((r) => (
              <option key={r.code} value={r.code} disabled={!rangeFits(selectedInterval, r)}>
                {t.ranges[r.code] ?? r.label}
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
          {t.source.prePost}
        </label>
        {/* aria-disabled rather than disabled: the button keeps focus while running and stays discoverable. */}
        <button type="submit" className={styles.runButton} aria-disabled={!ready || running}>
          {running ? t.source.running : t.source.run}
        </button>
      </div>
      {symbolError && (
        <p id={`${ids}-symbol-error`} className={styles.fieldError} role="alert">
          {t.source.symbolError}
        </p>
      )}
    </>
  );
}

/** Star for the loaded stock: favourites come first in suggestions and start the comparison on Compare. */
function FavouriteToggle({ ds }: { ds: DataSource }) {
  const t = useT();
  const symbol = ds.source.symbol;
  if (!symbol) return null;
  const on = ds.favourites.includes(symbol);
  return (
    <button
      type="button"
      className={styles.starButton}
      aria-pressed={on}
      aria-label={t.source.favourite(symbol)}
      title={on ? t.source.removeFavourite(symbol) : t.source.addFavourite(symbol)}
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
  const t = useT();
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
            aria-label={t.common.selectAll(label.toLowerCase())}
            aria-disabled={all}
            onClick={() => !all && onChange(options.map((o) => o.key))}
          >
            {t.common.all}
          </button>
          <span aria-hidden="true" className={styles.bulkDivider}>/</span>
          <button
            type="button"
            className={styles.linkButton}
            aria-label={t.common.selectNone(label.toLowerCase())}
            aria-disabled={none}
            onClick={() => !none && onChange([])}
          >
            {t.common.noneLower}
          </button>
        </span>
      )}
    </div>
  );
}

/** Shown when the API can't be reached at all. */
export function ApiAlert({ ds }: { ds: DataSource }) {
  const t = useT();
  if (!ds.options.isError) return null;
  return (
    <div className={styles.alert} role="alert">
      <span>
        <strong>{t.source.apiDown}</strong> {t.source.apiDownHelp(<code translate="no">npm run api</code>, <code translate="no">npm run dev</code>)}
      </span>
    </div>
  );
}

/**
 * The states around a fetch: nothing chosen yet (quick picks), failed (with retry), first load,
 * and finally the loaded series handed to `children`.
 */
export function SeriesGate({ ds, children }: { ds: DataSource; children: (data: PriceSeries) => ReactNode }) {
  const t = useT();
  const { source, series } = ds;
  if (!source.symbol) {
    return (
      <div className={styles.empty}>
        <p id="quick-picks-label">{t.source.pickPrompt}</p>
        <div className={styles.chips} role="group" aria-labelledby="quick-picks-label">
          {ds.picks.map((symbol) => (
            <button key={symbol} type="button" className={styles.chip} translate="no" onClick={() => ds.run({ ...ds.draft, symbol })}>
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
        <strong>{series.error instanceof ApiError && series.error.status === 404 ? t.source.notFound : t.source.failed}{' '}</strong>
        {series.error.message}
        <button type="button" className={styles.linkButton} onClick={() => series.refetch()}>
          {t.common.tryAgain}
        </button>
      </div>
    );
  }
  if (!series.data) {
    return (
      <div className={styles.loading} aria-busy="true">
        {t.source.loadingSymbol(source.symbol)}
      </div>
    );
  }
  return <>{children(series.data)}</>;
}

/** Yahoo sometimes serves coarser bars than asked for long ranges; say so. 60m and 1h are the same thing. */
export function GranularityNotice({ data }: { data: PriceSeries }) {
  const t = useT();
  const a = data.granularity;
  const b = data.query.interval;
  const same = a === b || (a === '1h' && b === '60m') || (a === '60m' && b === '1h');
  if (same) return null;
  return (
    <div className={styles.notice} role="note">
      {t.source.granularity(<strong>{t.intervals[a] ?? a}</strong>, t.intervals[b] ?? b)}
    </div>
  );
}

/** A polite one-line status for screen readers: loading / n rows. */
export function loadStatus(ds: DataSource, loadedText: string): string {
  if (!ds.source.symbol || ds.series.isError) return '';
  if (!ds.series.data || ds.series.isFetching) return messages().source.loadingStatus(ds.source.symbol);
  return loadedText;
}
