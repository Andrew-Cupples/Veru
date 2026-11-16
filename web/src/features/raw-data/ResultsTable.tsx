import { COLUMN_BY_KEY, type ColumnKey, type QuerySpec, type Row } from '../data-query/query';
import type { MarketSession } from '../../api/client';
import { currentLocale, messages, useT } from '../../i18n/I18nProvider';
import styles from '../data-query/DataQuery.module.css';

// Built per language and reused across thousands of cells.
const formats = new Map<string, { price: Intl.NumberFormat; integer: Intl.NumberFormat }>();
function numberFormats() {
  const locale = currentLocale();
  let f = formats.get(locale);
  if (!f) {
    f = { price: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 }), integer: new Intl.NumberFormat(locale) };
    formats.set(locale, f);
  }
  return f;
}

/** Rendering thousands of DOM rows gets sluggish; past this, ask for LIMIT or CSV. */
export const MAX_RENDERED_ROWS = 2000;

interface Props {
  rows: readonly Row[];
  columns: readonly ColumnKey[];
  orderBy: QuerySpec['orderBy'];
  onSort: (column: ColumnKey) => void;
  /** Read by screen readers as the table name. */
  caption: string;
}

export function ResultsTable({ rows, columns, orderBy, onSort, caption }: Props) {
  const t = useT();
  const visible = rows.length > MAX_RENDERED_ROWS ? rows.slice(0, MAX_RENDERED_ROWS) : rows;

  return (
    // Focusable so the keyboard can scroll it (arrow keys, Page Up/Down) once the table is taller than the box.
    <div className={styles.tableWrap} tabIndex={0} role="region" aria-label={t.raw.scrollable(caption)}>
      <table className={styles.table}>
        <caption className="sr-only">
          {caption}
          {orderBy ? t.raw.sortedBy(COLUMN_BY_KEY[orderBy.column].label, orderBy.direction === 'asc') : ''}
        </caption>
        <thead>
          <tr>
            {columns.map((key) => {
              const def = COLUMN_BY_KEY[key];
              const sorted = orderBy?.column === key ? orderBy.direction : undefined;
              return (
                <th
                  key={key}
                  scope="col"
                  className={def.kind === 'number' ? styles.numeric : undefined}
                  aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
                >
                  <button type="button" className={styles.sortButton} onClick={() => onSort(key)} title={def.description} aria-description={def.description}>
                    {def.label}
                    <span className={styles.sortMark} aria-hidden="true">
                      {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : ''}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody translate="no">
          {visible.map((row) => (
            <tr key={row.time}>
              {columns.map((key) => (
                <Cell key={key} row={row} column={key} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ row, column }: { row: Row; column: ColumnKey }) {
  const value = row[column];
  switch (column) {
    case 'open':
    case 'high':
    case 'low':
    case 'close':
      return <td className={styles.numeric}>{numberFormats().price.format(value as number)}</td>;
    case 'volume':
      return <td className={styles.numeric}>{numberFormats().integer.format(value as number)}</td>;
    case 'session':
      return (
        <td>
          {value ? <span className={styles.session} data-session={value}>{messages().common.sessions[value as MarketSession]}</span> : <span className={styles.muted}>—</span>}
        </td>
      );
    default:
      return <td className={styles.mono}>{String(value)}</td>;
  }
}
