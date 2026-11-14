import { useEffect, useId, useRef, useState, type FocusEvent, type ReactNode } from 'react';
import { OUTCOMES, type PromptDetail, type PromptOutcome, type UpdatePromptRequest } from '../../api/client';
import { useAutosave } from '../../hooks/useAutosave';
import { headline } from '../../model';
import { Icon } from '../Icon';
import { TagInput } from './TagInput';
import styles from './AnnotationPanel.module.css';

type TextField = 'rationale' | 'outcomeNotes' | 'comment';

interface AnnotationPanelProps {
  prompt: PromptDetail;
  position: number;
  total: number;
  /** True when the panel is held on a prompt the document has scrolled away from. */
  pinned: boolean;
  autoFocusComment: boolean;
  onAutoFocused: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onFollowScroll: () => void;
  onEditingChange: (editing: boolean) => void;
  onSave: (id: number, patch: UpdatePromptRequest) => void;
  onSaveTags: (id: number, tags: string[]) => void;
  saving: boolean;
}

const OUTCOME_LABELS: Record<PromptOutcome, string> = {
  Unset: 'Not decided yet',
  Kept: 'Kept: used as is',
  Changed: 'Changed: used with edits',
  Rejected: 'Rejected: not used',
  Mixed: 'Mixed: kept some, rejected some',
};

export function AnnotationPanel(props: AnnotationPanelProps) {
  const { prompt, position, total, pinned, autoFocusComment, onAutoFocused, onPrev, onNext } = props;
  const { onFollowScroll, onEditingChange, onSave, onSaveTags, saving } = props;

  const [draft, setDraft] = useState<Record<TextField, string>>({
    rationale: prompt.rationale ?? '',
    outcomeNotes: prompt.outcomeNotes ?? '',
    comment: prompt.comment ?? '',
  });
  const autosave = useAutosave<UpdatePromptRequest>((patch) => onSave(prompt.id, patch));
  const commentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!autoFocusComment) return;
    const el = commentRef.current;
    if (el) {
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length);
    }
    onAutoFocused();
  }, [autoFocusComment, onAutoFocused]);

  const editText = (field: TextField, value: string) => {
    setDraft((d) => ({ ...d, [field]: value }));
    autosave.queue({ [field]: value });
  };

  const onFocus = () => onEditingChange(true);
  const onBlur = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      autosave.flush();
      onEditingChange(false);
    }
  };

  const status = autosave.dirty ? 'Unsaved changes' : saving ? 'Saving…' : 'All changes saved';

  return (
    <aside className={styles.panel} aria-label="Annotations" onFocus={onFocus} onBlur={onBlur}>
      <div className={styles.header}>
        <div className={styles.position}>
          <span>
            Prompt <strong>{position}</strong> of {total}
          </span>
          <div className={styles.stepper}>
            <button type="button" onClick={onPrev} disabled={!onPrev} aria-label="Previous prompt" title="Previous (k)">
              <Icon name="chevronUp" />
            </button>
            <button type="button" onClick={onNext} disabled={!onNext} aria-label="Next prompt" title="Next (j)">
              <Icon name="chevronDown" />
            </button>
          </div>
        </div>
        <p className={styles.headline}>{headline(prompt.text, 140)}</p>
        {pinned && (
          <div className={styles.pinned}>
            <Icon name="pin" size={13} />
            <span>Held on this prompt while you edit</span>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onFollowScroll}>
              Follow scroll
            </button>
          </div>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.toggles}>
          <Toggle
            checked={prompt.humanReviewed}
            onChange={(v) => onSave(prompt.id, { humanReviewed: v })}
            tone="success"
            label="Human reviewed"
            hint="r"
          />
          <Toggle checked={prompt.starred} onChange={(v) => onSave(prompt.id, { starred: v })} tone="star" label="Starred" hint="s" />
          <Toggle
            checked={prompt.includeInLog}
            onChange={(v) => onSave(prompt.id, { includeInLog: v })}
            label="Include in PROMPT_LOG.md"
          />
        </div>

        <Field label="Outcome">
          {(id) => (
            <div className={styles.selectWrap} data-outcome={prompt.outcome}>
              <span className={styles.outcomeDot} aria-hidden="true" />
              <select
                id={id}
                className={styles.select}
                value={prompt.outcome}
                onChange={(e) => onSave(prompt.id, { outcome: e.target.value as PromptOutcome })}
              >
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {OUTCOME_LABELS[o]}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" size={14} className={styles.selectChevron} />
            </div>
          )}
        </Field>

        <Field label="Why I sent it">
          {(id) => (
            <textarea
              id={id}
              className={styles.textarea}
              rows={2}
              value={draft.rationale}
              onChange={(e) => editText('rationale', e.target.value)}
              placeholder="What were you trying to learn or achieve?"
            />
          )}
        </Field>

        <Field label="What I kept, changed or rejected">
          {(id) => (
            <textarea
              id={id}
              className={styles.textarea}
              rows={2}
              value={draft.outcomeNotes}
              onChange={(e) => editText('outcomeNotes', e.target.value)}
              placeholder="…and why"
            />
          )}
        </Field>

        <Field label="Tags">
          {(id) => <TagInput id={id} tags={prompt.tags} onChange={(tags) => onSaveTags(prompt.id, tags)} />}
        </Field>

        <Field label="Comments" grow hint="#hashtags become tags">
          {(id) => (
            <textarea
              id={id}
              ref={commentRef}
              className={`${styles.textarea} ${styles.comment}`}
              value={draft.comment}
              onChange={(e) => editText('comment', e.target.value)}
              placeholder="Your notes on this prompt and the reply…"
            />
          )}
        </Field>
      </div>

      <footer className={styles.footer}>
        <span className={styles.saveState} role="status" data-dirty={autosave.dirty || saving || undefined}>
          <span className={styles.saveDot} aria-hidden="true" />
          {status}
        </span>
        <span className={styles.shortcuts}>
          <kbd>Ctrl</kbd>+<kbd>Enter</kbd> reviewed &amp; next
        </span>
      </footer>
    </aside>
  );
}

function Field({ label, hint, grow, children }: { label: string; hint?: string; grow?: boolean; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className={styles.field} data-grow={grow || undefined}>
      <div className={styles.fieldLabel}>
        <label htmlFor={id}>{label}</label>
        {hint && <span className={styles.fieldHint}>{hint}</span>}
      </div>
      {children(id)}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  tone = 'accent',
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  tone?: 'accent' | 'success' | 'star';
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={styles.toggle}
      data-tone={tone}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.track}>
        <span className={styles.thumb} />
      </span>
      <span className={styles.toggleLabel}>{label}</span>
      {hint && <kbd className={styles.toggleHint}>{hint}</kbd>}
    </button>
  );
}
