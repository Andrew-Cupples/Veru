import { Clause, ConditionsEditor, MultiSelectChips, SourceFields } from '../data-query/SourceControls';
import { COLUMNS, type ColumnKey, type QuerySpec } from '../data-query/query';
import type { DataSource } from '../data-query/useDataSource';
import styles from '../data-query/DataQuery.module.css';

interface Props {
  ds: DataSource;
  spec: QuerySpec;
  onSpecChange: (spec: QuerySpec) => void;
}

/** The query, laid out clause by clause like SQL. FROM fetches from the API; the rest filters what came back. */
export function QueryEditor({ ds, spec, onSpecChange }: Props) {
  return (
    <form className={styles.editor} onSubmit={ds.submit} aria-label="Query">
      <Clause keyword="SELECT">
        <MultiSelectChips
          label="Columns"
          options={COLUMNS}
          selected={spec.select}
          onChange={(select) => onSpecChange({ ...spec, select })}
        />
      </Clause>

      <Clause keyword="FROM">
        <SourceFields ds={ds} />
      </Clause>

      <Clause keyword="WHERE">
        <ConditionsEditor where={spec.where} onChange={(where) => onSpecChange({ ...spec, where })} />
      </Clause>

      <Clause keyword="ORDER BY">
        <div className={styles.inlineRow}>
          <select
            className={styles.input}
            aria-label="Order by column"
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
            <option value="">(none)</option>
            {COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          {spec.orderBy && (
            <div className={styles.segmented} role="group" aria-label="Direction">
              {(['asc', 'desc'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={spec.orderBy?.direction === d}
                  onClick={() => onSpecChange({ ...spec, orderBy: spec.orderBy && { ...spec.orderBy, direction: d } })}
                >
                  {d.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </Clause>

      <Clause keyword="LIMIT">
        <input
          className={`${styles.input} ${styles.limitInput}`}
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          aria-label="Row limit"
          placeholder="all"
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
