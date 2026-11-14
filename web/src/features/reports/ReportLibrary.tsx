import { useLayoutEffect, useRef } from 'react';
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
  const navRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);

  // One highlight that glides to the open report, rather than each item switching its own background.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const highlight = highlightRef.current;
    if (!nav || !highlight) return;
    const place = () => {
      const current = nav.querySelector<HTMLElement>('[aria-current="true"]');
      highlight.hidden = !current;
      if (!current) return;
      highlight.style.transform = `translate(${current.offsetLeft}px, ${current.offsetTop}px)`;
      highlight.style.width = `${current.offsetWidth}px`;
      highlight.style.height = `${current.offsetHeight}px`;
    };
    place();
    // Glide only after the first placement, so the highlight doesn't fly in from the top on load.
    const frame = requestAnimationFrame(() => (highlight.dataset.ready = ''));
    const observer = new ResizeObserver(place);
    observer.observe(nav);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [activeId, mine]);

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
    <nav ref={navRef} className={styles.library} aria-label="Reports">
      <span ref={highlightRef} className={styles.libraryHighlight} aria-hidden="true" hidden />
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
