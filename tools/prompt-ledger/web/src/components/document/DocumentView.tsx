import { memo } from 'react';
import type { PromptDetail } from '../../api/client';
import { SECTION_ATTRIBUTE } from '../../hooks/useScrollSpy';
import { formatDate, formatTime, headline, type SessionGroup } from '../../model';
import { Icon } from '../Icon';
import { ResponseBlock } from './ResponseBlock';
import styles from './DocumentView.module.css';

interface DocumentViewProps {
  groups: readonly SessionGroup[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

/** The whole ledger as one continuous document: sessions are chapters, prompts are sections. */
export function DocumentView({ groups, selectedId, onSelect }: DocumentViewProps) {
  let number = 0;
  return (
    <article className={styles.paper}>
      {groups.map((group) => (
        <div key={group.sessionId} className={styles.session}>
          <header className={styles.sessionHeader}>
            <p className={styles.kicker}>Session · {formatDate(group.startedAt)}</p>
            <h1 className={styles.sessionTitle}>{group.title}</h1>
            <p className={styles.sessionMeta}>
              {group.prompts.length} prompt{group.prompts.length === 1 ? '' : 's'} ·{' '}
              {group.prompts.filter((p) => p.humanReviewed).length} reviewed
            </p>
          </header>

          {group.prompts.map((prompt) => (
            <PromptSection
              key={prompt.id}
              prompt={prompt}
              number={++number}
              selected={prompt.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      ))}
      <footer className={styles.end} aria-hidden="true">
        <span>¶</span>
      </footer>
    </article>
  );
}

interface PromptSectionProps {
  prompt: PromptDetail;
  number: number;
  selected: boolean;
  onSelect: (id: number) => void;
}

const PromptSection = memo(function PromptSection({ prompt, number, selected, onSelect }: PromptSectionProps) {
  const title = headline(prompt.text) || '(empty prompt)';
  return (
    <section
      {...{ [SECTION_ATTRIBUTE]: prompt.id }}
      id={`pl-prompt-${prompt.id}`}
      className={styles.section}
      data-selected={selected || undefined}
      data-excluded={!prompt.includeInLog || undefined}
      aria-labelledby={`pl-prompt-${prompt.id}-title`}
    >
      <header className={styles.sectionHeader}>
        <p className={styles.eyebrow}>
          <span className={styles.number}>Prompt {number}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={prompt.submittedAt}>{formatTime(prompt.submittedAt)}</time>
          {prompt.starred && <Icon name="star" size={13} filled className={styles.star} aria-label="Starred" />}
        </p>
        <h2 id={`pl-prompt-${prompt.id}-title`} className={styles.title}>
          <button type="button" className={styles.titleButton} onClick={() => onSelect(prompt.id)}>
            {title}
          </button>
        </h2>
        <div className={styles.chips}>
          <span className={styles.chip} data-kind={prompt.humanReviewed ? 'reviewed' : 'pending'}>
            {prompt.humanReviewed ? (
              <>
                <Icon name="check" size={12} strokeWidth={2.6} /> Reviewed
              </>
            ) : (
              'Not reviewed'
            )}
          </span>
          {prompt.outcome !== 'Unset' && (
            <span className={styles.chip} data-kind="outcome" data-outcome={prompt.outcome}>
              {prompt.outcome}
            </span>
          )}
          {!prompt.includeInLog && (
            <span className={styles.chip} data-kind="pending">
              <Icon name="hidden" size={12} /> Not in log
            </span>
          )}
          {prompt.tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              #{tag}
            </span>
          ))}
        </div>
      </header>

      <div className={styles.prompt}>
        <p className={styles.blockLabel}>You</p>
        <div className={styles.promptText}>{prompt.text}</div>
      </div>

      {prompt.responseText ? (
        <ResponseBlock text={prompt.responseText} model={prompt.model} />
      ) : (
        <p className={styles.noResponse}>No reply recorded yet. It's added when the turn finishes, or on the next sync.</p>
      )}

      {prompt.comment && (
        <aside className={styles.note} aria-label="Your comment">
          <p className={styles.blockLabel}>Note</p>
          <p className={styles.noteText}>{prompt.comment}</p>
        </aside>
      )}
    </section>
  );
});
