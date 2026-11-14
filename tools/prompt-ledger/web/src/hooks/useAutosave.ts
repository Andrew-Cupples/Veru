import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Buffers field edits and saves them after a pause in typing. Edits made in quick succession are
 * merged into a single save, and anything still pending is flushed when the component unmounts
 * (for example, when the user moves to another prompt).
 */
export function useAutosave<T extends object>(save: (patch: T) => void, delayMs = 700) {
  const pending = useRef<T | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const saveRef = useRef(save);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const patch = pending.current;
    pending.current = null;
    setDirty(false);
    if (patch) saveRef.current(patch);
  }, []);

  const queue = useCallback(
    (patch: T) => {
      pending.current = { ...pending.current, ...patch } as T;
      setDirty(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, delayMs);
    },
    [delayMs, flush],
  );

  // Flush on unmount so a quick switch to another prompt never loses typing.
  useEffect(() => flush, [flush]);

  return { queue, flush, dirty };
}
