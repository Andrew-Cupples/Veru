import { useLayoutEffect, useRef } from 'react';
import { CHART_BY_TYPE, type Report } from './model';
import { ChartIcon } from './ChartIcon';
import { TEMPLATES } from './templates';
import { Thumbnail } from './Thumbnail';
import type { Thumb } from './thumbGeometry';
import styles from './Reports.module.css';
import dq from '../data-query/DataQuery.module.css';

interface Props {
  mine: readonly Report[];
  activeId: string;
  onOpen: (id: string) => void;
  onCreate: (dims: 2 | 3) => void;
  /** A live miniature of each report on the current data, or null while there's nothing to draw. */
  thumbFor: (report: Report) => Thumb | null;
  pins: readonly string[];
  onTogglePin: (id: string) => void;
  comparing: boolean;
  onCompare: (on: boolean) => void;
}

/** Templates and the user's reports. One click opens a report; the chart draws straight away. */
export function ReportLibrary({ mine, activeId, onOpen, onCreate, thumbFor, pins, onTogglePin, comparing, onCompare }: Props) {
  const navRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  // While comparing, no single report is "open", so nothing is marked current.
  const currentId = comparing ? null : activeId;

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
  }, [currentId, mine]);

  const item = (r: Report, showDescription: boolean) => {
    const thumb = thumbFor(r);
    const pinned = pins.includes(r.id);
    return (
      <li key={r.id} className={styles.libraryRow} data-pinned={pinned || undefined}>
        <button
          type="button"
          className={styles.libraryItem}
          aria-current={r.id === currentId ? 'true' : undefined}
          onClick={() => onOpen(r.id)}
        >
          <span className={styles.thumbSlot}>{thumb ? <Thumbnail thumb={thumb} /> : <ChartIcon type={r.chart} />}</span>
          <span className={styles.libraryText}>
            <span className={styles.libraryName}>{r.name}</span>
            <span className={styles.libraryMeta}>
              {showDescription && r.description ? r.description : `${CHART_BY_TYPE[r.chart].label} · ${CHART_BY_TYPE[r.chart].dims}D`}
            </span>
          </span>
        </button>
        <button
          type="button"
          className={styles.compareToggle}
          aria-pressed={pinned}
          aria-label={`Compare ${r.name}`}
          title={pinned ? 'In comparison: click to remove' : 'Add to comparison'}
          onClick={() => onTogglePin(r.id)}
        >
          {pinned ? <CheckIcon /> : <PlusIcon />}
        </button>
      </li>
    );
  };

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

      <div className={styles.compareBox}>
        <button
          type="button"
          className={comparing ? dq.secondaryButton : dq.runButton}
          disabled={!comparing && pins.length < 2}
          aria-describedby="compare-hint"
          onClick={() => onCompare(!comparing)}
        >
          {comparing ? 'Back to editor' : `Compare (${pins.length})`}
        </button>
        <p id="compare-hint" className={styles.compareHint}>
          {comparing
            ? 'Hover one chart to see the same moment on the others. Add more with +.'
            : pins.length < 2
              ? 'Add 2 or more reports with + to compare them side by side.'
              : `${pins.length} reports ready to compare.`}
        </p>
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
