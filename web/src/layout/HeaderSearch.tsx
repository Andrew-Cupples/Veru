import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { usePriceSeries } from '../api/hooks';
import { track } from '../analytics/tracker';
import { SymbolCombobox } from '../features/data-query/SymbolCombobox';
import { loadFavourites, loadLastSource, loadRecentSymbols, loadSymbolNames } from '../features/data-query/memory';
import { formatNumber, useT } from '../i18n/I18nProvider';
import styles from './AppLayout.module.css';

/** Pages that load a stock from `?symbol=`: a pick here swaps the stock in place, keeping the rest of the view. */
const DATA_PAGES = ['/reports', '/raw-data'];

const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/**
 * Stock search in the menu bar, on every page. On Reports and Raw data it changes the stock in place;
 * anywhere else it opens the stock in Reports. "/" focuses it from anywhere.
 */
export function HeaderSearch() {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const t = useT();

  // Suggestions read the same memory the data pages write; refresh it whenever the page or stock changes.
  const urlSymbol = params.get('symbol') ?? '';
  // Re-read storage when the page or stock changes (the data pages write it).
  const memoryKey = `${pathname}|${urlSymbol}`;
  const [memory, setMemory] = useState(readMemory);
  const [readFor, setReadFor] = useState(memoryKey);
  if (readFor !== memoryKey) {
    setReadFor(memoryKey);
    setMemory(readMemory());
  }

  const onDataPage = DATA_PAGES.includes(pathname);
  const current = (onDataPage && urlSymbol) || loadLastSource()?.symbol || memory.recent[0] || '';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const open = (raw: string) => {
    const symbol = raw.trim().toUpperCase();
    if (!symbol) return;
    track('query', { target: 'header search', subject: symbol });
    setText('');
    inputRef.current?.blur();
    if (onDataPage) {
      setParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set('symbol', symbol);
        return p;
      });
    } else {
      navigate(`/reports?symbol=${encodeURIComponent(symbol)}`);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    open(text);
  };

  return (
    <div className={styles.tools}>
      <form role="search" className={styles.search} onSubmit={submit}>
        <svg className={styles.searchIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" />
        </svg>
        <SymbolCombobox
          id="header-symbol"
          inputRef={inputRef}
          className={styles.searchInput}
          value={text}
          onChange={setText}
          onPick={open}
          favourites={memory.favourites}
          recent={memory.recent}
          names={memory.names}
          placeholder={t.search.placeholder}
          ariaLabel={t.search.placeholder}
          keyShortcut="/"
          align="end"
        />
        <kbd className={styles.searchKey} aria-hidden="true">
          /
        </kbd>
      </form>
      {current && <PriceChip symbol={current} />}
    </div>
  );
}

function readMemory() {
  return { favourites: loadFavourites(), recent: loadRecentSymbols(), names: loadSymbolNames() };
}

/** The stock in view and how it moved since the previous close. Links to its chart. */
function PriceChip({ symbol }: { symbol: string }) {
  const t = useT();
  const daily = usePriceSeries({ symbol, interval: '1d', range: '5d', extendedHours: false });
  const bars = daily.data?.bars ?? [];
  const last = bars.at(-1)?.close;
  const prev = bars.at(-2)?.close;
  const change = last != null && prev ? ((last - prev) / prev) * 100 : null;
  const dir = change == null ? 'flat' : change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  const pct = change == null ? '' : formatNumber(Math.abs(change) / 100, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <Link to={`/reports?symbol=${encodeURIComponent(symbol)}`} className={styles.price} data-dir={dir} aria-label={t.search.price(symbol, change == null ? null : dir, pct)} translate="no">
      <span className={styles.priceSymbol}>{symbol}</span>
      {change != null && (
        <span className={styles.priceChange} aria-hidden="true">
          {dir === 'up' ? '▲' : dir === 'down' ? '▼' : '•'} {pct}
        </span>
      )}
    </Link>
  );
}
