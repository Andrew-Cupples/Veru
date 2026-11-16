import { Clause, ConditionsEditor, MultiSelectChips, SourceFields } from '../data-query/SourceControls';
import { COLUMNS, type ColumnKey, type QuerySpec } from '../data-query/query';
import type { DataSource } from '../data-query/useDataSource';
import { useT } from '../../i18n/I18nProvider';
import styles from '../data-query/DataQuery.module.css';

interface Props {
  ds: DataSource;
  spec: QuerySpec;
  onSpecChange: (spec: QuerySpec) => void;
}

/** The query, laid out clause by clause like SQL. FROM fetches from the API; the rest filters what came back. */
export function QueryEditor({ ds, spec, onSpecChange }: Props) {
  const t = useT();
  return (
    <form className={styles.editor} onSubmit={ds.submit} aria-label={t.raw.query}>
      <Clause keyword={t.query.select}>
        <MultiSelectChips
          label={t.raw.columns}
          options={COLUMNS}
          selected={spec.select}
          onChange={(select) => onSpecChange({ ...spec, select })}
        />
      </Clause>

      <Clause keyword={t.query.from}>
        <SourceFields ds={ds} />
      </Clause>

      <Clause keyword={t.query.where}>
        <ConditionsEditor where={spec.where} onChange={(where) => onSpecChange({ ...spec, where })} />
      </Clause>

      <Clause keyword={t.query.orderBy}>
        <div className={styles.inlineRow}>
          <select
            className={styles.input}
            aria-label={t.raw.orderBy}
            value={spec.orderBy?.column ?? ''}
            onChange={(e) =>
              onSpecChange({
                ...spec,
                orderBy: e.target.value
                  ? { column: e.target.value as ColumnKey, direction: spec.orderBy?.direction ?? 'asc' }
                  : null,
              })
            }
          >
            <option value="">{t.common.none}</option>
            {COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          {spec.orderBy && (
            <div className={styles.segmented} role="group" aria-label={t.raw.direction}>
              {(['asc', 'desc'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={spec.orderBy?.direction === d}
                  title={d === 'asc' ? t.query.ascending : t.query.descending}
                  onClick={() => onSpecChange({ ...spec, orderBy: spec.orderBy && { ...spec.orderBy, direction: d } })}
                >
                  {t.query[d]}
                </button>
              ))}
            </div>
          )}
        </div>
      </Clause>

      <Clause keyword={t.query.limit}>
        <input
          className={`${styles.input} ${styles.limitInput}`}
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          aria-label={t.raw.rowLimit}
          placeholder={t.raw.limitAll}
          value={spec.limit ?? ''}
          onChange={(e) => {
            const n = e.target.valueAsNumber;
            onSpecChange({ ...spec, limit: Number.isFinite(n) && n >= 0 ? Math.floor(n) : null });
          }}
        />
      </Clause>
    </form>
  );
}
