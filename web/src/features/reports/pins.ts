import { useCallback, useState } from 'react';
import { readJson, writeJson } from '../../lib/storage';

/**
 * Reports added to the comparison, in the order they were added, kept in this browser.
 * No limit: the compare grid keeps two charts per row and the page scrolls as more are added.
 */

const DEFAULT_KEY = 'veru.reports.pinned';

const isIdList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

export function usePins(key: string = DEFAULT_KEY) {
  const [pins, setPins] = useState<string[]>(() => readJson(key, [], isIdList));

  const toggle = useCallback((id: string) => {
    setPins((list) => {
      const next = list.includes(id) ? list.filter((p) => p !== id) : [...list, id];
      writeJson(key, next);
      return next;
    });
  }, [key]);

  return { pins, toggle };
}
