import { useId, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { wordCount } from '../../model';
import { useLedgerI18n } from '../../i18n';
import styles from './DocumentView.module.css';

/** Replies longer than this start collapsed so the document stays easy to skim. */
const COLLAPSE_AT_CHARS = 1600;

export function ResponseBlock({ text, model }: { text: string; model: string | null }) {
  const { t } = useLedgerI18n();
  const long = text.length > COLLAPSE_AT_CHARS;
  const [expanded, setExpanded] = useState(!long);
  const bodyId = useId();

  return (
    <div className={styles.response}>
      <p className={styles.blockLabel}>
        Claude{model && <span className={styles.model}>{model}</span>}
      </p>
      <div id={bodyId} className={styles.markdown} data-collapsed={!expanded || undefined}>
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noreferrer noopener">
                {children}
              </a>
            ),
          }}
        >
          {text}
        </Markdown>
      </div>
      {long && (
        <button
          type="button"
          className={styles.expand}
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t.document.collapse : t.document.expand(wordCount(text))}
        </button>
      )}
    </div>
  );
}
