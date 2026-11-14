import { COLUMN_BY_KEY, type ColumnKey, type QuerySpec, type Row } from './query';
import styles from './RawData.module.css';

const price = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const integer = new Intl.NumberFormat();

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
  const visible = rows.length > MAX_RENDERED_ROWS ? rows.slice(0, MAX_RENDERED_ROWS) : rows;

  return (
    // Focusable so the keyboard can scroll it (arrow keys, Page Up/Down) once the table is taller than the box.
    <div className={styles.tableWrap} tabIndex={0} role="region" aria-label={`${caption} (scrollable)`}>
      <table className={styles.table}>
        <caption className="sr-only">
          {caption}
          {orderBy ? `, sorted by ${orderBy.column} ${orderBy.direction === "asc" ? "ascending" : "descending"}` : ""}
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
        <tbody>
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
      return <td className={styles.numeric}>{price.format(value as number)}</td>;
    case 'volume':
      return <td className={styles.numeric}>{integer.format(value as number)}</td>;
    case 'session':
      return (
        <td>
          {value ? <span className={styles.session} data-session={value}>{value}</span> : <span className={styles.muted}>—</span>}
        </td>
      );
    default:
      return <td className={styles.mono}>{String(value)}</td>;
  }
}
