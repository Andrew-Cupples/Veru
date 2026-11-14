import type { PromptDetail } from '../api/client';
import { useSync } from '../api/hooks';
import type { ColorScheme } from '../theme/theme';
import { Icon, type IconName } from './Icon';
import styles from './Toolbar.module.css';

interface ToolbarProps {
  prompts: readonly PromptDetail[];
  scheme: ColorScheme;
  onSchemeChange: (scheme: ColorScheme) => void;
  showOutline: boolean;
  showAnnotations: boolean;
  onToggleOutline: () => void;
  onToggleAnnotations: () => void;
  saveError: Error | null;
}

const schemeCycle: Record<ColorScheme, { next: ColorScheme; icon: IconName; label: string }> = {
  system: { next: 'light', icon: 'monitor', label: 'System theme' },
  light: { next: 'dark', icon: 'sun', label: 'Light theme' },
  dark: { next: 'system', icon: 'moon', label: 'Dark theme' },
};

export function Toolbar(props: ToolbarProps) {
  const { prompts, scheme, onSchemeChange, showOutline, showAnnotations, onToggleOutline, onToggleAnnotations, saveError } = props;
  const sync = useSync();
  const reviewed = prompts.filter((p) => p.humanReviewed).length;
  const percent = prompts.length === 0 ? 0 : Math.round((reviewed / prompts.length) * 100);
  const schemeInfo = schemeCycle[scheme];

  let syncLabel = 'Sync transcripts';
  if (sync.isSuccess) {
    const r = sync.data;
    syncLabel = r.added + r.linked + r.updated === 0 ? 'Up to date' : `Synced: ${r.added} new, ${r.updated} updated`;
  }

  return (
    <header className={styles.toolbar}>
      <div className={styles.group}>
        <IconButton icon="outline" label="Toggle outline" pressed={showOutline} onClick={onToggleOutline} />
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">¶</span>
          <span className={styles.title}>Prompt Ledger</span>
        </div>
      </div>

      <div className={styles.progress} title={`${reviewed} of ${prompts.length} prompts human-reviewed`}>
        <div className={styles.meter} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Reviewed">
          <div className={styles.meterFill} style={{ width: `${percent}%` }} />
        </div>
        <span className={styles.progressText}>
          <strong>{reviewed}</strong> / {prompts.length} reviewed
        </span>
      </div>

      <div className={styles.group}>
        {saveError && (
          <span className={styles.error} role="alert" title={saveError.message}>
            <Icon name="alert" size={14} /> Save failed
          </span>
        )}
        <button
          type="button"
          className={styles.textButton}
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          title={sync.isError ? sync.error.message : 'Import new prompts and replies from Claude Code transcripts'}
        >
          <Icon name="sync" size={15} className={sync.isPending ? styles.spin : undefined} />
          {sync.isPending ? 'Syncing…' : sync.isError ? 'Sync failed' : syncLabel}
        </button>
        <IconButton icon={schemeInfo.icon} label={`${schemeInfo.label} (click to change)`} onClick={() => onSchemeChange(schemeInfo.next)} />
        <IconButton icon="notes" label="Toggle annotations" pressed={showAnnotations} onClick={onToggleAnnotations} />
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
