import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export const SECTION_ATTRIBUTE = 'data-prompt-id';

/** How far below the top of the scroll area a section's heading counts as "current". */
const ACTIVATION_OFFSET = 120;
/** Gap left above a section after jumping to it. */
const JUMP_PADDING = 24;

/**
 * Tracks which document section is being read (the last one whose top has passed the activation line),
 * and scrolls smoothly to a section on request. During a programmatic scroll the tracker is paused,
 * so the outline doesn't flicker through every section passed on the way.
 */
export function useScrollSpy(containerRef: RefObject<HTMLElement | null>, ids: readonly number[]) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const jumping = useRef(false);
  const releaseTimer = useRef<number | undefined>(undefined);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container || jumping.current) return;

    const sections = container.querySelectorAll<HTMLElement>(`[${SECTION_ATTRIBUTE}]`);
    if (sections.length === 0) return;

    const line = container.getBoundingClientRect().top + ACTIVATION_OFFSET;
    let current = Number(sections[0]!.getAttribute(SECTION_ATTRIBUTE));
    for (const section of sections) {
      if (section.getBoundingClientRect().top > line) break;
      current = Number(section.getAttribute(SECTION_ATTRIBUTE));
    }
    setActiveId(current);
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame = 0;
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    const resize = new ResizeObserver(onScroll);
    resize.observe(container);
    measure();

    return () => {
      container.removeEventListener('scroll', onScroll);
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [containerRef, measure, ids]);

  const scrollToId = useCallback(
    (id: number) => {
      const container = containerRef.current;
      const section = container?.querySelector<HTMLElement>(`[${SECTION_ATTRIBUTE}="${id}"]`);
      if (!container || !section) return;

      setActiveId(id);
      jumping.current = true;
      window.clearTimeout(releaseTimer.current);

      const release = () => {
        jumping.current = false;
        window.clearTimeout(releaseTimer.current);
        container.removeEventListener('scrollend', release);
      };
      container.addEventListener('scrollend', release);
      // Fallback for engines without `scrollend`, and for jumps that don't scroll at all.
      releaseTimer.current = window.setTimeout(release, 900);

      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      const top = section.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - JUMP_PADDING;
      container.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    },
    [containerRef],
  );

  useEffect(() => () => window.clearTimeout(releaseTimer.current), []);

  return { activeId, scrollToId };
}
