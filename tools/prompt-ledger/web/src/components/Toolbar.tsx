import type { PromptDetail } from '../api/client';
import { useExport, useSync } from '../api/hooks';
import type { ColorScheme } from '../theme/theme';
import { Icon, type IconName } from './Icon';
import { useLedgerI18n } from '../i18n';
import styles from './Toolbar.module.css';

interface ToolbarProps {
  prompts: readonly PromptDetail[];
  scheme: ColorScheme;
  onSchemeChange?: (scheme: ColorScheme) => void;
  showOutline: boolean;
  showAnnotations: boolean;
  onToggleOutline: () => void;
  onToggleAnnotations: () => void;
  saveError: Error | null;
}

const schemeCycle: Record<ColorScheme, { next: ColorScheme; icon: IconName }> = {
  system: { next: 'light', icon: 'monitor' },
  light: { next: 'dark', icon: 'sun' },
  dark: { next: 'system', icon: 'moon' },
};

export function Toolbar(props: ToolbarProps) {
  const { prompts, scheme, onSchemeChange, showOutline, showAnnotations, onToggleOutline, onToggleAnnotations, saveError } = props;
  const { t: all } = useLedgerI18n();
  const t = all.toolbar;
  const sync = useSync();
  const exporter = useExport();
  const reviewed = prompts.filter((p) => p.humanReviewed).length;
  const percent = prompts.length === 0 ? 0 : Math.round((reviewed / prompts.length) * 100);
  const schemeInfo = schemeCycle[scheme];

  let syncLabel = t.sync;
  if (sync.isSuccess) {
    const r = sync.data;
    syncLabel = r.added + r.linked + r.updated === 0 ? t.upToDate : t.synced(r.added, r.updated);
  }

  return (
    <header className={styles.toolbar}>
      <div className={styles.group}>
        <IconButton icon="outline" label={t.toggleOutline} pressed={showOutline} onClick={onToggleOutline} />
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">¶</span>
          <span className={styles.title}>Prompt Ledger</span>
        </div>
      </div>

      <div className={styles.progress} title={t.reviewedTitle(reviewed, prompts.length)}>
        <div className={styles.meter} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={t.reviewedLabel}>
          <div className={styles.meterFill} style={{ width: `${percent}%` }} />
        </div>
        <span className={styles.progressText}>
          {t.reviewed(<strong>{reviewed}</strong>, prompts.length)}
        </span>
      </div>

      <div className={styles.group}>
        {saveError && (
          <span className={styles.error} role="alert" title={saveError.message}>
            <Icon name="alert" size={14} /> {t.saveFailed}
          </span>
        )}
        <button
          type="button"
          className={styles.textButton}
          onClick={() => {
            if (!sync.isPending) sync.mutate();
          }}
          // aria-disabled, not disabled: a disabled button drops keyboard focus mid-press.
          aria-disabled={sync.isPending}
          title={sync.isError ? sync.error.message : t.syncTitle}
        >
          <Icon name="sync" size={15} className={sync.isPending ? styles.spin : undefined} />
          {sync.isPending ? t.syncing : sync.isError ? t.syncFailed : syncLabel}
        </button>
        <span className="pl-sr-only" role="status">
          {sync.isPending ? t.syncingStatus : sync.isError ? t.syncFailedStatus(sync.error.message) : sync.isSuccess ? syncLabel : ''}
        </span>
        <button
          type="button"
          className={styles.textButton}
          onClick={() => {
            if (!exporter.isPending) exporter.mutate();
          }}
          aria-disabled={exporter.isPending}
          title={exporter.isError ? exporter.error.message : t.exportTitle}
        >
          <Icon name={exporter.isSuccess ? 'check' : 'export'} size={15} />
          {exporter.isPending ? t.exporting : exporter.isError ? t.exportFailed : exporter.isSuccess ? t.exported : t.export}
        </button>
        <span className="pl-sr-only" role="status">
          {exporter.isPending ? t.exportingStatus : exporter.isError ? `${t.exportFailed}: ${exporter.error.message}` : exporter.isSuccess ? t.exportedStatus : ''}
        </span>
        {onSchemeChange && (
          <IconButton
            icon={schemeInfo.icon}
            label={t.schemeChange(t.scheme[scheme])}
            onClick={() => onSchemeChange(schemeInfo.next)}
          />
        )}
        <IconButton icon="notes" label={t.toggleAnnotations} pressed={showAnnotations} onClick={onToggleAnnotations} />
      </div>
    </header>
  );
}

function IconButton({ icon, label, pressed, onClick }: { icon: IconName; label: string; pressed?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={styles.iconButton} aria-label={label} title={label} aria-pressed={pressed} onClick={onClick}>
      <Icon name={icon} size={17} />
    </button>
  );
}
