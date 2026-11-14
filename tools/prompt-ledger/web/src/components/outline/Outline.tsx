import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { formatDate, headline, matchesFilter, parseFilter, type SessionGroup } from '../../model';
import { Icon } from '../Icon';
import styles from './Outline.module.css';

interface OutlineProps {
  groups: readonly SessionGroup[];
  activeId: number | null;
  onSelect: (id: number) => void;
  filterRef: RefObject<HTMLInputElement | null>;
}

export function Outline({ groups, activeId, onSelect, filterRef }: OutlineProps) {
  const [query, setQuery] = useState('');
  const filter = useMemo(() => parseFilter(query), [query]);
  const filtering = filter.words.length > 0 || filter.tags.length > 0;
  const listRef = useRef<HTMLDivElement>(null);

  // Numbering is document-wide and stays stable while filtering.
  const numbered = useMemo(() => {
    let n = 0;
    return groups.map((g) => ({ ...g, items: g.prompts.map((p) => ({ prompt: p, number: ++n })) }));
  }, [groups]);

  const visible = numbered
    .map((g) => ({ ...g, items: filtering ? g.items.filter((i) => matchesFilter(i.prompt, filter)) : g.items }))
    .filter((g) => g.items.length > 0);
  const matchCount = visible.reduce((sum, g) => sum + g.items.length, 0);

  // Keep the current item in view as the document scrolls.
  useEffect(() => {
    if (activeId == null) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-outline-id="${activeId}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  return (
    <nav className={styles.outline} aria-label="Prompt outline">
      <div className={styles.search}>
        <Icon name="search" size={15} className={styles.searchIcon} />
        <input
          ref={filterRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQuery('');
              e.currentTarget.blur();
            }
          }}
          placeholder="Filter…  #tag  words"
          aria-label="Filter prompts by text or #tag"
          className={styles.searchInput}
        />
        {filtering && <span className={styles.count}>{matchCount}</span>}
      </div>

      <div ref={listRef} className={styles.list}>
        {visible.length === 0 && <p className={styles.none}>No prompts match “{query}”.</p>}
        {visible.map((group) => (
          <section key={group.sessionId} className={styles.group}>
            <h3 className={styles.groupTitle} title={group.title}>
              <span>{group.title}</span>
              <time>{formatDate(group.startedAt)}</time>
            </h3>
            <ol className={styles.items}>
              {group.items.map(({ prompt, number }) => (
                <li key={prompt.id}>
                  <button
                    type="button"
                    data-outline-id={prompt.id}
                    className={styles.item}
                    aria-current={prompt.id === activeId ? 'location' : undefined}
                    onClick={() => onSelect(prompt.id)}
                  >
                    <span
                      className={styles.status}
                      data-reviewed={prompt.humanReviewed || undefined}
                      data-outcome={prompt.outcome}
                      title={prompt.humanReviewed ? 'Reviewed' : 'Not reviewed'}
                    >
                      {prompt.humanReviewed && <Icon name="check" size={10} strokeWidth={3} />}
                    </span>
                    <span className={styles.number}>{number}</span>
                    <span className={styles.label}>{headline(prompt.text, 70) || '(empty prompt)'}</span>
                    {prompt.starred && <Icon name="star" size={12} filled className={styles.star} />}
                    {!prompt.includeInLog && <Icon name="hidden" size={12} className={styles.excluded} />}
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </nav>
  );
}
