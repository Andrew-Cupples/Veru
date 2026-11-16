import { useEffect, useId, useMemo, useState, type KeyboardEvent, type Ref } from 'react';
import type { SymbolMatch } from '../../api/client';
import { useSymbolSearch } from '../../api/hooks';
import { useDebounced } from '../../lib/useDebounced';
import { buildSuggestions } from './suggestions';
import { useT } from '../../i18n/I18nProvider';
import styles from './DataQuery.module.css';

interface Props {
  id: string;
  value: string;
  onChange: (text: string) => void;
  /** An option was chosen (Enter on it, or a click): load it now. */
  onPick: (symbol: string) => void;
  favourites: readonly string[];
  recent: readonly string[];
  names: Readonly<Record<string, string>>;
  /** Search results arrived; lets the page remember their names for labels. */
  onMatches?: (matches: readonly SymbolMatch[]) => void;
  inputRef?: Ref<HTMLInputElement>;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  /** Accessible name when there is no visible <label for>. */
  ariaLabel?: string;
  keyShortcut?: string;
  className?: string;
  /** Which edge of the input the suggestions line up with; 'end' for inputs near the right of the screen. */
  align?: 'start' | 'end';
}


/**
 * Symbol input with autocomplete (WAI-ARIA combobox with a listbox popup). Typing shows your matching
 * favourites and recents at once, then search results by ticker or company name. Arrow keys move through
 * the list, Enter loads the highlighted symbol (or what's typed, if nothing is highlighted), Escape closes.
 */
export function SymbolCombobox({
  id,
  value,
  onChange,
  onPick,
  favourites,
  recent,
  names,
  onMatches,
  inputRef,
  placeholder = 'TSLA',
  invalid,
  describedBy,
  ariaLabel,
  keyShortcut,
  className,
  align = 'start',
}: Props) {
  const listId = useId();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Only search for what the user typed, not for a symbol that was picked or loaded.
  const [typed, setTyped] = useState(false);

  const query = useDebounced(typed ? value : '', 150);
  const search = useSymbolSearch(open ? query : '');
  const matches = useMemo(() => search.data?.matches ?? [], [search.data]);
  const stale = typed && query.trim().toUpperCase() !== value.trim().toUpperCase();

  useEffect(() => {
    if (matches.length) onMatches?.(matches);
  }, [matches, onMatches]);

  const options = useMemo(
    () => buildSuggestions(typed ? value : '', favourites, recent, names, typed ? matches : []),
    [typed, value, favourites, recent, names, matches],
  );
  const shown = open && (options.length > 0 || (typed && value.trim() !== ''));
  const activeId = shown && active >= 0 && active < options.length ? `${listId}-${active}` : undefined;

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const pick = (symbol: string) => {
    close();
    setTyped(false);
    onPick(symbol);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) {
          setOpen(true);
          setActive(e.altKey ? -1 : 0);
        } else if (options.length) setActive((i) => (i + 1) % options.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) setOpen(true);
        if (options.length) setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
        break;
      case 'Enter':
        // With an option highlighted, load it; otherwise let the form submit what is typed.
        if (shown && active >= 0 && options[active]) {
          e.preventDefault();
          pick(options[active].symbol);
        } else close();
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        break;
      case 'Tab':
        close();
        break;
    }
  };

  // What the status line says (and what screen readers hear, politely) about the list.
  let status = '';
  if (shown) {
    if (search.isError && typed) status = t.search.unavailable;
    else if (typed && value.trim() && (stale || search.isFetching) && !matches.length) status = t.search.searching;
    else if (!options.length) status = t.search.noMatches(value.trim().toUpperCase());
    else status = t.search.count(options.length);
  }

  return (
    <div className={styles.combo} data-open={shown}>
      <input
        id={id}
        ref={inputRef}
        className={className}
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-label={ariaLabel}
        aria-keyshortcuts={keyShortcut}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        value={value}
        placeholder={placeholder}
        maxLength={40}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="characters"
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setTyped(true);
          setOpen(true);
          setActive(-1);
        }}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        onBlur={close}
      />
      {/* Mouse down on the popup must not blur the input, or the list would close before the click lands. */}
      <div className={styles.comboPopup} data-align={align} hidden={!shown} onMouseDown={(e) => e.preventDefault()}>
        <ul id={listId} role="listbox" aria-label={t.search.suggestions} className={styles.comboList}>
          {options.map((o, i) => (
            <li
              key={o.symbol}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={styles.comboOption}
              onMouseMove={() => i !== active && setActive(i)}
              onClick={() => pick(o.symbol)}
            >
              <span className={styles.comboSymbol} translate="no">{o.symbol}</span>
              <span className={styles.comboName}>{o.name ?? ''}</span>
              <span className={styles.comboMeta}>
                {o.source === 'favourite' && <span aria-hidden="true">★ </span>}
                {o.source === 'favourite' ? t.search.favourite : o.source === 'recent' ? t.search.recent : o.meta}
              </span>
            </li>
          ))}
        </ul>
        {status && (
          <p className={styles.comboStatus} aria-hidden="true">
            {status}
          </p>
        )}
      </div>
      {/* Always in the page, so screen readers hear the count change even as the popup opens. */}
      <p className="sr-only" role="status">
        {status}
      </p>
    </div>
  );
}
