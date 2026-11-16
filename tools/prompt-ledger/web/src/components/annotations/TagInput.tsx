import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useTags } from '../../api/hooks';
import { normalizeTag } from '../../model';
import { Icon } from '../Icon';
import { useLedgerI18n } from '../../i18n';
import styles from './TagInput.module.css';

interface TagInputProps {
  id: string;
  tags: readonly string[];
  onChange: (tags: string[]) => void;
}

/** Chips plus an autocompleting input. Enter, comma or space adds a tag; Backspace on an empty input removes the last. */
export function TagInput({ id, tags, onChange }: TagInputProps) {
  const l = useLedgerI18n().t.tags;
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const listId = useId();
  const allTags = useTags();

  const query = text.trim().replace(/^#+/, '').toLowerCase();
  const suggestions = useMemo(() => {
    const known = allTags.data ?? [];
    return known
      .filter((t) => !tags.includes(t.name) && (query === '' || t.name.includes(query)))
      .sort((a, b) => Number(b.name.startsWith(query)) - Number(a.name.startsWith(query)) || b.promptCount - a.promptCount)
      .slice(0, 8);
  }, [allTags.data, tags, query]);

  const showList = open && suggestions.length > 0;

  const add = (raw: string) => {
    const name = normalizeTag(raw);
    setText('');
    setHighlight(0);
    if (name && !tags.includes(name)) onChange([...tags, name]);
  };

  const remove = (name: string) => onChange(tags.filter((t) => t !== name));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab' || (e.key === ' ' && text.trim())) {
      const choice = showList && query !== '' ? suggestions[highlight]?.name : undefined;
      const value = choice && choice.startsWith(query) ? choice : text;
      if (!value.trim()) {
        if (e.key === 'Enter' && showList && suggestions[highlight]) {
          e.preventDefault();
          add(suggestions[highlight].name);
        }
        return; // let Tab move focus normally
      }
      e.preventDefault();
      add(value);
    } else if (e.key === 'Backspace' && text === '' && tags.length > 0) {
      remove(tags[tags.length - 1]!);
    } else if (e.key === 'Escape' && showList) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className={styles.box}>
      {tags.map((tag) => (
        <span key={tag} className={styles.chip}>
          #{tag}
          <button type="button" onClick={() => remove(tag)} aria-label={l.remove(tag)}>
            <Icon name="x" size={11} strokeWidth={2.4} />
          </button>
        </span>
      ))}
      <div className={styles.inputWrap}>
        <input
          id={id}
          className={styles.input}
          value={text}
          placeholder={tags.length === 0 ? l.add : ''}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            if (text.trim()) add(text);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${highlight}` : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        {showList && (
          <ul id={listId} role="listbox" className={styles.list}>
            {suggestions.map((s, i) => (
              <li
                key={s.name}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === highlight}
                className={styles.option}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(s.name);
                }}
                onMouseEnter={() => setHighlight(i)}
              >
                <span>
                  {s.color && <span className={styles.swatch} style={{ background: s.color }} />}#{s.name}
                </span>
                <span className={styles.optionCount}>{s.promptCount}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
