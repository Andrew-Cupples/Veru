import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { track } from '../../analytics/tracker';
import type { Dataset } from './fields';
import { CHART_BY_TYPE, blankReport, type Report } from './model';
import { MARKET_KEYS, reportStore, type ReportStoreKeys } from './storage';
import { TEMPLATES } from './templates';

export type ReportNotice =
  | { kind: 'forked'; name: string; templateId: string }
  | { kind: 'deleted'; report: Report; index: number }
  | null;

/** What a page's reports are about: its dataset, built-in templates and where its own reports are kept. */
export interface ReportConfig {
  dataset: Dataset;
  templates: readonly Report[];
  keys: ReportStoreKeys;
}

export const MARKET_REPORTS: ReportConfig = { dataset: 'market', templates: TEMPLATES, keys: MARKET_KEYS };

const chartLabel = (r: Report) => CHART_BY_TYPE[r.chart].label;

/**
 * The open report and the user's saved ones. User reports save on every change (no Save button);
 * editing a template saves a copy to My reports automatically, so work is never lost.
 * The open report's id is in the URL (`?report=`), next to the data source.
 */
export function useReports(config: ReportConfig = MARKET_REPORTS) {
  const { dataset, templates, keys } = config;
  const store = useMemo(() => reportStore(keys), [keys]);
  const templateById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);
  const [mine, setMineState] = useState(store.load);
  const [params, setParams] = useSearchParams();
  const [notice, setNotice] = useState<ReportNotice>(null);

  const requested = params.get('report') ?? store.loadActiveId();
  const active: Report =
    mine.find((r) => r.id === requested) ?? (requested ? templateById.get(requested) : undefined) ?? mine[0] ?? templates[0]!;

  const setMine = (update: (list: Report[]) => Report[]) =>
    setMineState((list) => {
      const next = update(list);
      store.save(next);
      return next;
    });

  /** Opening a report always shows it in the editor, leaving the compare view. */
  const open = (id: string, keepNotice = false) => {
    store.saveActiveId(id);
    if (!keepNotice) setNotice(null);
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('report', id);
        p.delete('view');
        return p;
      },
      { replace: false },
    );
  };

  /** Opening from the library: tracked as a report view. */
  const view = (id: string) => {
    const r = mine.find((m) => m.id === id) ?? templateById.get(id);
    if (r) track('report', { target: 'open', detail: chartLabel(r), subject: r.template ? `${r.name} (template)` : r.name });
    open(id);
  };

  // The compare view lives in the URL too (?view=compare), so Back returns to the editor.
  const comparing = params.get('view') === 'compare';
  const setComparing = (on: boolean) => {
    track('report', { target: on ? 'compare' : 'leave compare' });
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (on) p.set('view', 'compare');
        else p.delete('view');
        return p;
      },
      { replace: false },
    );
  };

  const update = (change: (r: Report) => Report) => {
    if (active.template) {
      const copy: Report = { ...change(active), id: crypto.randomUUID(), template: undefined, dataset: active.dataset, updatedAt: Date.now() };
      setMine((list) => [copy, ...list]);
      setNotice({ kind: 'forked', name: copy.name, templateId: active.id });
      track('report', { target: 'save template copy', detail: chartLabel(copy), subject: active.name });
      open(copy.id, true);
      return;
    }
    const id = active.id;
    setMine((list) => list.map((r) => (r.id === id ? { ...change(r), updatedAt: Date.now() } : r)));
  };

  const add = (report: Report) => {
    setMine((list) => [report, ...list]);
    open(report.id);
  };

  const create = (dims: 2 | 3) => {
    track('report', { target: 'create', detail: `${dims}D` });
    add(blankReport(dims, dims === 3 ? 'New 3D report' : 'New report', dataset));
  };

  const duplicate = () => {
    track('report', { target: 'duplicate', detail: chartLabel(active), subject: active.name });
    add({ ...active, id: crypto.randomUUID(), name: `${active.name} copy`, template: undefined, updatedAt: Date.now() });
  };

  const remove = () => {
    if (active.template) return;
    track('report', { target: 'delete', detail: chartLabel(active), subject: active.name });
    const index = mine.findIndex((r) => r.id === active.id);
    const rest = mine.filter((r) => r.id !== active.id);
    setMine(() => rest);
    open(rest[Math.min(index, rest.length - 1)]?.id ?? templates[0]!.id, true);
    setNotice({ kind: 'deleted', report: active, index });
  };

  const undoDelete = () => {
    if (notice?.kind !== 'deleted') return;
    const { report, index } = notice;
    track('report', { target: 'undo delete', detail: chartLabel(report), subject: report.name });
    setMine((list) => [...list.slice(0, index), report, ...list.slice(index)]);
    open(report.id);
  };

  return {
    dataset,
    templates,
    templateById,
    pinsKey: keys.pins,
    mine,
    active,
    open: view,
    update,
    create,
    duplicate,
    remove,
    undoDelete,
    notice,
    dismissNotice: () => setNotice(null),
    comparing,
    setComparing,
  };
}

export type ReportsState = ReturnType<typeof useReports>;
