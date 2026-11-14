import { Icon } from './Icon';
import styles from './StatusStates.module.css';

export function LoadingState() {
  return (
    <div className={styles.paper} aria-busy="true" aria-label="Loading prompts">
      {[0, 1, 2].map((i) => (
        <div key={i} className={styles.skeletonSection}>
          <div className={styles.bar} style={{ width: '22%' }} />
          <div className={styles.bar} style={{ width: '68%', height: 22 }} />
          <div className={styles.block} />
          <div className={styles.bar} style={{ width: '92%' }} />
          <div className={styles.bar} style={{ width: '84%' }} />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className={styles.center}>
      <div className={styles.card} role="alert">
        <div className={styles.cardIcon}>
          <Icon name="alert" size={22} />
        </div>
        <h2>Couldn’t load the ledger</h2>
        <p>{error.message}</p>
        <p className={styles.hint}>
          Is the API running? Start it with <code>dotnet run --project tools/prompt-ledger/src/PromptLedger.Api</code>
        </p>
        <button type="button" className={styles.button} onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className={styles.center}>
      <div className={styles.card}>
        <div className={styles.cardIcon}>¶</div>
        <h2>No prompts yet</h2>
        <p>Prompts appear here as you send them to Claude Code in this repository.</p>
        <p className={styles.hint}>
          To backfill from existing transcripts, use <strong>Sync transcripts</strong> in the toolbar.
        </p>
      </div>
    </div>
  );
}
