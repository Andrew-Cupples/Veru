import { Icon } from './Icon';
import { useLedgerI18n } from '../i18n';
import styles from './StatusStates.module.css';

export function LoadingState() {
  const { t } = useLedgerI18n();
  return (
    <div className={styles.paper} aria-busy="true" aria-label={t.status.loading}>
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
  const { t } = useLedgerI18n();
  return (
    <div className={styles.center}>
      <div className={styles.card} role="alert">
        <div className={styles.cardIcon}>
          <Icon name="alert" size={22} />
        </div>
        <h2>{t.status.errorTitle}</h2>
        <p>{error.message}</p>
        <p className={styles.hint}>
          {t.status.errorHelp(<code translate="no">dotnet run --project tools/prompt-ledger/src/PromptLedger.Api</code>)}
        </p>
        <button type="button" className={styles.button} onClick={onRetry}>
          {t.status.tryAgain}
        </button>
      </div>
    </div>
  );
}

export function EmptyState() {
  const { t } = useLedgerI18n();
  return (
    <div className={styles.center}>
      <div className={styles.card}>
        <div className={styles.cardIcon}>¶</div>
        <h2>{t.status.emptyTitle}</h2>
        <p>{t.status.empty}</p>
        <p className={styles.hint}>
          {t.status.backfill(<strong>{t.toolbar.sync}</strong>)}
        </p>
      </div>
    </div>
  );
}
