import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { radioGroup } from '../../a11y/radioGroup';
import { useDocumentTitle } from '../../a11y/useDocumentTitle';
import { ApiError, type SymbolMatch } from '../../api/client';
import { usePriceSeriesMany, useQueryOptions } from '../../api/hooks';
import { track } from '../../analytics/tracker';
import { loadFavourites, loadRecentSymbols, loadSymbolNames, rememberNames } from '../data-query/memory';
import { filterRows, toRows } from '../data-query/query';
import { Clause, rangeFits } from '../data-query/SourceControls';
import { SymbolCombobox } from '../data-query/SymbolCombobox';
import { CompareView, type CompareItem } from '../reports/CompareView';
import { describe } from '../reports/ReportWorkspace';
import { toReportRows } from '../reports/fields';
import { CHART_BY_TYPE, type Report } from '../reports/model';
import { pointCount, shape } from '../reports/shape';
import { loadReports } from '../reports/storage';
import { TEMPLATES } from '../reports/templates';
import { useThemeColors } from '../reports/themeColors';
import { MAX_REPORTS, MAX_STOCKS, useCompareState, type CompareState } from './compareState';
import styles from './Compare.module.css';
import dq from '../data-query/DataQuery.module.css';
import { messages, useT } from '../../i18n/I18nProvider';

const GROUPINGS = ['report', 'stock'] as const;

/**
 * Compare: the same reports across several stocks. Its own page, separate from the Reports editor: pick
 * stocks, pick reports, choose the bars, and every report is drawn for every stock. Each card opens that
 * report on that stock in the editor.
 */
export function ComparePage() {
  const navigate = useNavigate();
  const t = useT();
  const { state, set } = useCompareState();
  const { stocks, interval, range, extendedHours, groupBy } = state;
  const options = useQueryOptions();
  const colors = useThemeColors();
  const [names, setNames] = useState(loadSymbolNames);
  const learn = useCallback((entries: readonly (readonly [string, string | null | undefined])[]) => {
    const next = rememberNames(entries);
    if (next) setNames(next);
  }, []);

  // Your reports and the templates, looked up by id; a report deleted since is just left out.
  const [mine] = useState(loadReports);
  const reportById = useMemo(() => new Map([...mine, ...TEMPLATES].map((r) => [r.id, r])), [mine]);
  const reports = useMemo(
    () => state.reports.map((id) => reportById.get(id)).filter((r): r is Report => r !== undefined),
    [state.reports, reportById],
  );

  const requests = useMemo(() => stocks.map((symbol) => ({ symbol, interval, range, extendedHours })), [stocks, interval, range, extendedHours]);
  const series = usePriceSeriesMany(requests);
  const loading = series.some((s) => s.isFetching);

  // Instrument names arrive with the bars; shown next to each ticker.
  const loadedNames = useMemo(() => {
    const extra: Record<string, string> = {};
    series.forEach((s, i) => {
      const name = s.data?.instrument.name;
      if (name) extra[stocks[i]!] = name;
    });
    return { ...names, ...extra };
  }, [series, stocks, names]);

  const items = useMemo<CompareItem[]>(() => {
    const rowsByStock = series.map((s) => (s.data ? toRows(s.data.bars) : null));
    const out: CompareItem[] = [];
    for (const r of reports) {
      stocks.forEach((symbol, i) => {
        const state = series[i];
        const base = { key: `${r.id}|${symbol}`, report: r, symbol, label: `${r.name}, ${symbol}` };
        const needs = !!CHART_BY_TYPE[r.chart].slots.series && !r.enc.series.length;
        const rows = rowsByStock[i];
        if (needs) out.push({ ...base, shaped: null, message: t.compare.nothingToPlot });
        else if (!rows) out.push({ ...base, shaped: null, message: state?.error ? errorText(symbol, state.error) : t.source.loadingSymbol(symbol) });
        else {
          const reportRows = toReportRows(filterRows(rows, r.where));
          if (!reportRows.length) out.push({ ...base, shaped: null, message: t.compare.noBars });
          else {
            const s = shape(reportRows, r);
            out.push({ ...base, shaped: s, label: describe(r, pointCount(s), symbol) });
          }
        }
      });
    }
    // Ordered for the grouping: rows of stocks under each report, or rows of reports under each stock.
    if (groupBy === 'stock') out.sort((a, b) => stocks.indexOf(a.symbol!) - stocks.indexOf(b.symbol!));
    return out;
  }, [reports, stocks, series, groupBy, t]);

  const heading = t.compare.heading(reports.length, stocks.length);
  useDocumentTitle(`${t.nav.compare}${stocks.length ? ` · ${stocks.join(', ')}` : ''}`);

  const removeStock = (symbol: string) => {
    track('report', { target: 'compare remove stock', subject: symbol });
    set((s) => ({ ...s, stocks: s.stocks.filter((x) => x !== symbol) }));
  };
  const removeReport = (id: string) => {
    track('report', { target: 'compare remove report', subject: reportById.get(id)?.name ?? '' });
    set((s) => ({ ...s, reports: s.reports.filter((x) => x !== id) }));
  };
  const open = (item: CompareItem) => {
    const p = new URLSearchParams({ report: item.report.id, symbol: item.symbol ?? '', interval, range });
    if (extendedHours) p.set('ext', '1');
    track('report', { target: 'compare open', detail: item.symbol ?? '', subject: item.report.name });
    navigate(`/reports?${p.toString()}`);
  };

  const status = !stocks.length
    ? t.compare.statusAddStock
    : !reports.length
      ? t.compare.statusAddReport
      : loading
        ? t.compare.loadingStocks(stocks.length)
        : heading;

  return (
    <div className={dq.page}>
      <div className={dq.heading}>
        <h1>{t.nav.compare}</h1>
      </div>

      {options.isError && (
        <div className={dq.alert} role="alert">
          <span>
            <strong>{t.source.apiDown}</strong> {t.compare.apiDownHelp(<code translate="no">npm run api</code>)}
          </span>
        </div>
      )}

      <div className={dq.card}>
        <div className={dq.editor} role="group" aria-label={t.compare.comparison}>
          <Clause keyword={t.compare.stocksKeyword}>
            <StockPicker stocks={stocks} names={loadedNames} onLearn={learn} set={set} onRemove={removeStock} />
          </Clause>
          <Clause keyword={t.compare.reportsKeyword}>
            <ReportPicker reports={reports} mine={mine} chosen={state.reports} set={set} onRemove={removeReport} />
          </Clause>
          <Clause keyword={t.compare.overKeyword}>
            <BarsPicker state={state} set={set} options={options.data} />
          </Clause>
        </div>
      </div>

      <p className="sr-only" role="status">
        {status}
      </p>

      {!stocks.length ? (
        <div className={dq.empty}>{t.compare.emptyStocks}</div>
      ) : !reports.length ? (
        <div className={dq.empty}>{t.compare.emptyReports}</div>
      ) : colors ? (
        <div aria-busy={loading}>
          <CompareView
            autoFocus={false}
            items={items}
            colors={colors}
            heading={heading}
            groupBy={groupBy}
            names={loadedNames}
            onOpen={open}
            onRemoveReport={removeReport}
            onRemoveStock={removeStock}
          />
        </div>
      ) : null}
    </div>
  );
}

function errorText(symbol: string, error: Error): string {
  const t = messages();
  return error instanceof ApiError && error.status === 404 ? t.compare.noData(symbol) : t.compare.failed(symbol, error.message);
}

type Setter = (change: (s: CompareState) => CompareState) => void;

/** The stocks as removable tags, then an autocomplete box: picking a suggestion or pressing Enter adds one. */
function StockPicker({
  stocks,
  names,
  onLearn,
  set,
  onRemove,
}: {
  stocks: readonly string[];
  names: Readonly<Record<string, string>>;
  onLearn: (entries: readonly (readonly [string, string | null | undefined])[]) => void;
  set: Setter;
  onRemove: (symbol: string) => void;
}) {
  const t = useT();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [favourites] = useState(loadFavourites);
  const [recent] = useState(loadRecentSymbols);
  const full = stocks.length >= MAX_STOCKS;
  const onMatches = useCallback((m: readonly SymbolMatch[]) => onLearn(m.map((x) => [x.symbol, x.name])), [onLearn]);

  const add = (symbol: string) => {
    const s = symbol.trim().toUpperCase();
    if (!s) return setError(t.compare.typeTicker);
    if (stocks.includes(s)) return setError(t.compare.already(s));
    track('report', { target: 'compare add stock', subject: s });
    set((st) => ({ ...st, stocks: [...st.stocks, s] }));
    setText('');
    setError(null);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    add(text);
  };
  // The removed tag's button disappears; land on the add box so the next action is right there.
  const remove = (symbol: string) => {
    onRemove(symbol);
    inputRef.current?.focus();
  };

  return (
    <div className={styles.picker}>
      {stocks.length > 0 && (
        <ul className={styles.tags} aria-label={t.compare.stocksIn}>
          {stocks.map((s) => (
            <li key={s} className={styles.tag} title={names[s]}>
              <span className={styles.tagText} translate="no">{s}</span>
              <button type="button" className={styles.tagRemove} aria-label={t.compare.remove(s)} onClick={() => remove(s)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {full ? (
        <p className={styles.note}>{t.compare.maxStocks(MAX_STOCKS)}</p>
      ) : (
        <form className={styles.addForm} onSubmit={submit} aria-label={t.compare.addStock}>
          <SymbolCombobox
            id="compare-add-stock"
            inputRef={inputRef}
            className={`${dq.input} ${dq.symbolInput}`}
            ariaLabel={t.compare.addStock}
            placeholder={t.compare.addStockPlaceholder}
            value={text}
            onChange={(value) => {
              setText(value);
              setError(null);
            }}
            onPick={add}
            favourites={favourites.filter((s) => !stocks.includes(s))}
            recent={recent.filter((s) => !stocks.includes(s))}
            names={names}
            onMatches={onMatches}
            invalid={!!error}
            describedBy={error ? 'compare-add-stock-error' : undefined}
          />
          {error && (
            <p id="compare-add-stock-error" className={dq.fieldError} role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

/** The reports as removable tags, then a list to add one: your reports and the templates. Choosing adds it. */
function ReportPicker({
  reports,
  mine,
  chosen,
  set,
  onRemove,
}: {
  reports: readonly Report[];
  mine: readonly Report[];
  chosen: readonly string[];
  set: Setter;
  onRemove: (id: string) => void;
}) {
  const t = useT();
  const selectRef = useRef<HTMLSelectElement>(null);
  const full = chosen.length >= MAX_REPORTS;
  const available = (list: readonly Report[]) => list.filter((r) => !chosen.includes(r.id));

  const add = (id: string) => {
    if (!id) return;
    track('report', { target: 'compare add report', subject: [...mine, ...TEMPLATES].find((r) => r.id === id)?.name ?? '' });
    set((s) => ({ ...s, reports: [...s.reports, id] }));
  };
  const remove = (id: string) => {
    onRemove(id);
    selectRef.current?.focus();
  };

  return (
    <div className={styles.picker}>
      {reports.length > 0 && (
        <ul className={styles.tags} aria-label={t.compare.reportsIn}>
          {reports.map((r) => (
            <li key={r.id} className={`${styles.tag} ${styles.reportTag}`}>
              <span className={styles.tagText}>{r.name}</span>
              <button type="button" className={styles.tagRemove} aria-label={t.compare.remove(r.name)} onClick={() => remove(r.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {full ? (
        <p className={styles.note}>{t.compare.maxReports(MAX_REPORTS)}</p>
      ) : (
        <select ref={selectRef} className={dq.input} aria-label={t.compare.addReport} value="" onChange={(e) => add(e.target.value)}>
          <option value="">{t.compare.addReportOption}</option>
          {available(mine).length > 0 && (
            <optgroup label={t.reports.myReports}>
              {available(mine).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label={t.reports.templates}>
            {available(TEMPLATES).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </optgroup>
        </select>
      )}
    </div>
  );
}

/** Interval, range and pre/post for every stock, plus how the charts are grouped. Changes apply at once. */
function BarsPicker({ state, set, options }: { state: CompareState; set: Setter; options: ReturnType<typeof useQueryOptions>['data'] }) {
  const t = useT();
  const intervals = options?.intervals ?? [];
  const ranges = options?.ranges ?? [];
  const ready = !!options;
  const selected = intervals.find((i) => i.code === state.interval);
  const grouping = radioGroup(GROUPINGS, state.groupBy, (groupBy) => set((s) => ({ ...s, groupBy })));

  const changeInterval = (code: string) => {
    const interval = intervals.find((i) => i.code === code);
    const current = ranges.find((r) => r.code === state.range);
    // Keep the range if it still fits; otherwise the longest one that does.
    const range = current && rangeFits(interval, current) ? current.code : ([...ranges].reverse().find((r) => rangeFits(interval, r))?.code ?? state.range);
    set((s) => ({ ...s, interval: code, range, extendedHours: interval?.intraday ? s.extendedHours : false }));
  };

  return (
    <div className={dq.fromRow}>
      <label className={dq.field}>
        <span className={dq.fieldLabel}>{t.source.interval}</span>
        <select className={dq.input} value={state.interval} disabled={!ready} onChange={(e) => changeInterval(e.target.value)}>
          {!ready && <option value={state.interval}>{t.common.loading}</option>}
          {intervals.map((i) => (
            <option key={i.code} value={i.code}>
              {t.intervals[i.code] ?? i.label}
            </option>
          ))}
        </select>
      </label>
      <label className={dq.field}>
        <span className={dq.fieldLabel}>{t.source.range}</span>
        <select className={dq.input} value={state.range} disabled={!ready} onChange={(e) => set((s) => ({ ...s, range: e.target.value }))}>
          {!ready && <option value={state.range}>{t.common.loading}</option>}
          {ranges.map((r) => (
            <option key={r.code} value={r.code} disabled={!rangeFits(selected, r)}>
              {t.ranges[r.code] ?? r.label}
            </option>
          ))}
        </select>
      </label>
      <label className={dq.checkbox}>
        <input
          type="checkbox"
          checked={state.extendedHours}
          disabled={selected ? !selected.intraday : false}
          onChange={(e) => set((s) => ({ ...s, extendedHours: e.target.checked }))}
        />
        {t.source.prePost}
      </label>
      <div className={dq.field}>
        <span className={dq.fieldLabel} id="compare-group-label">
          {t.compare.rows}
        </span>
        <div role="radiogroup" aria-labelledby="compare-group-label" className={styles.segmented} onKeyDown={grouping.onKeyDown}>
          {GROUPINGS.map((g) => (
            <button key={g} type="button" {...grouping.radioProps(g)}>
              {g === 'report' ? t.compare.byReport : t.compare.byStock}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
