/**
 * Links charts in the compare view: hovering one shows the same moment on the others (a shared
 * crosshair), and zooming or panning one moves the others to the same x range.
 *
 * Charts only follow each other when their keys match: hover by the x field (values are matched, so
 * different filters still line up), range by x field plus filters (ranges on a category axis are positions).
 */

export type SyncEvent =
  | { type: 'hover'; from: string; key: string; x: string | number }
  | { type: 'unhover'; from: string }
  | { type: 'range'; from: string; key: string; range: [unknown, unknown] | null };

type Listener = (event: SyncEvent) => void;

export interface SyncBus {
  emit: (event: SyncEvent) => void;
  subscribe: (listener: Listener) => () => void;
}

export function createSyncBus(): SyncBus {
  const listeners = new Set<Listener>();
  return {
    emit: (event) => listeners.forEach((l) => l(event)),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export interface ChartSync {
  bus: SyncBus;
  /** This chart's id on the bus, so it ignores its own events. */
  id: string;
  /** Null: this chart doesn't share a crosshair (3D, heatmaps, histograms...). */
  hoverKey: string | null;
  rangeKey: string | null;
}

/** Index of the point at x in a trace's x values, comparing as strings so dates and labels match. */
export function pointIndexAt(xs: readonly unknown[] | undefined, x: string | number): number {
  if (!xs) return -1;
  const target = String(x);
  return xs.findIndex((v) => String(v) === target);
}

/** The x range a plotly_relayout event set: a range, null for "reset to auto", undefined if x didn't change. */
export function relayoutRange(e: Record<string, unknown>): [unknown, unknown] | null | undefined {
  if ('xaxis.range[0]' in e) return [e['xaxis.range[0]'], e['xaxis.range[1]']];
  const r = e['xaxis.range'];
  if (Array.isArray(r) && r.length === 2) return [r[0], r[1]];
  if (e['xaxis.autorange'] === true) return null;
  return undefined;
}
