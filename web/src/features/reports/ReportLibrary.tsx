import { useLayoutEffect, useRef } from 'react';
import { CHART_BY_TYPE, type Report } from './model';
import { ChartIcon } from './ChartIcon';

import { Thumbnail } from './Thumbnail';
import type { Thumb } from './thumbGeometry';
import { useT } from '../../i18n/I18nProvider';
import styles from './Reports.module.css';
import dq from '../data-query/DataQuery.module.css';

interface Props {
  mine: readonly Report[];
  templates: readonly Report[];
  activeId: string;
  onOpen: (id: string) => void;
  onCreate: (dims: 2 | 3) => void;
  /** A live miniature of each report on the current data, or null while there's nothing to draw. */
  thumbFor: (report: Report) => Thumb | null;
}

/** Templates and the user's reports. One click opens a report; the chart draws straight away. */
export function ReportLibrary({ mine, templates, activeId, onOpen, onCreate, thumbFor }: Props) {
  const t = useT();
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
      // Measured against the list itself: offsetTop would be relative to the item's own row, which is positioned.
      const box = nav.getBoundingClientRect();
      const item = current.getBoundingClientRect();
      const x = item.left - box.left - nav.clientLeft + nav.scrollLeft;
      const y = item.top - box.top - nav.clientTop + nav.scrollTop;
      highlight.style.transform = `translate(${x}px, ${y}px)`;
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

  const item = (r: Report, showDescription: boolean) => {
    const thumb = thumbFor(r);
    return (
      <li key={r.id} className={styles.libraryRow}>
        <button
          type="button"
          className={styles.libraryItem}
          data-track={r.name}
          aria-current={r.id === activeId ? 'true' : undefined}
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
      </li>
    );
  };

  return (
    <nav ref={navRef} className={styles.library} aria-label={t.nav.reports}>
      <span ref={highlightRef} className={styles.libraryHighlight} aria-hidden="true" hidden />
      <div className={styles.newButtons}>
        <button type="button" className={dq.secondaryButton} onClick={() => onCreate(2)}>
          <span aria-hidden="true">+ </span>{t.reports.new2d}
        </button>
        <button type="button" className={dq.secondaryButton} onClick={() => onCreate(3)}>
          <span aria-hidden="true">+ </span>{t.reports.new3d}
        </button>
      </div>

      <h2 className={styles.libraryHeading} id="mine-heading">
        {t.reports.myReports}
      </h2>
      {mine.length ? (
        <ul className={styles.libraryList} aria-labelledby="mine-heading">
          {mine.map((r) => item(r, false))}
        </ul>
      ) : (
        <p className={styles.libraryEmpty}>{t.reports.noneYet}</p>
      )}

      <h2 className={styles.libraryHeading} id="templates-heading">
        {t.reports.templates}
      </h2>
      <ul className={styles.libraryList} aria-labelledby="templates-heading">
        {templates.map((r) => item(r, true))}
      </ul>
    </nav>
  );
}
