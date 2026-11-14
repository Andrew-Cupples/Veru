import { CHART_BY_TYPE, type Report } from './model';
import { ChartIcon } from './ChartIcon';
import { TEMPLATES } from './templates';
import styles from './Reports.module.css';
import dq from '../data-query/DataQuery.module.css';

interface Props {
  mine: readonly Report[];
  activeId: string;
  onOpen: (id: string) => void;
  onCreate: (dims: 2 | 3) => void;
}

/** Templates and the user's reports. One click opens a report; the chart draws straight away. */
export function ReportLibrary({ mine, activeId, onOpen, onCreate }: Props) {
  const item = (r: Report, showDescription: boolean) => (
    <li key={r.id}>
      <button
        type="button"
        className={styles.libraryItem}
        aria-current={r.id === activeId ? 'true' : undefined}
        onClick={() => onOpen(r.id)}
      >
        <ChartIcon type={r.chart} />
        <span className={styles.libraryText}>
          <span className={styles.libraryName}>{r.name}</span>
          <span className={styles.libraryMeta}>
            {showDescription && r.description ? r.description : `${CHART_BY_TYPE[r.chart].label} · ${CHART_BY_TYPE[r.chart].dims}D`}
          </span>
        </span>
      </button>
    </li>
  );

  return (
    <nav className={styles.library} aria-label="Reports">
      <div className={styles.newButtons}>
        <button type="button" className={dq.secondaryButton} onClick={() => onCreate(2)}>
          <span aria-hidden="true">+ </span>New 2D
        </button>
        <button type="button" className={dq.secondaryButton} onClick={() => onCreate(3)}>
          <span aria-hidden="true">+ </span>New 3D
        </button>
      </div>

      <h2 className={styles.libraryHeading} id="mine-heading">
        My reports
      </h2>
      {mine.length ? (
        <ul className={styles.libraryList} aria-labelledby="mine-heading">
          {mine.map((r) => item(r, false))}
        </ul>
      ) : (
        <p className={styles.libraryEmpty}>None yet. Edit a template or start a new one; changes save automatically.</p>
      )}

      <h2 className={styles.libraryHeading} id="templates-heading">
        Templates
      </h2>
      <ul className={styles.libraryList} aria-labelledby="templates-heading">
        {TEMPLATES.map((r) => item(r, true))}
      </ul>
    </nav>
  );
}
