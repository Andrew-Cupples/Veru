import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { blankReport, type Report } from './model';
import { loadActiveId, loadReports, saveActiveId, saveReports } from './storage';
import { TEMPLATES, TEMPLATE_BY_ID } from './templates';

export type ReportNotice =
  | { kind: 'forked'; name: string; templateId: string }
  | { kind: 'deleted'; report: Report; index: number }
  | null;

/**
 * The open report and the user's saved ones. User reports save on every change (no Save button);
 * editing a template saves a copy to My reports automatically, so work is never lost.
 * The open report's id is in the URL (`?report=`), next to the data source.
 */
export function useReports() {
  const [mine, setMineState] = useState(loadReports);
  const [params, setParams] = useSearchParams();
  const [notice, setNotice] = useState<ReportNotice>(null);

  const requested = params.get('report') ?? loadActiveId();
  const active: Report =
    mine.find((r) => r.id === requested) ?? (requested ? TEMPLATE_BY_ID.get(requested) : undefined) ?? mine[0] ?? TEMPLATES[0]!;

  const setMine = (update: (list: Report[]) => Report[]) =>
    setMineState((list) => {
      const next = update(list);
      saveReports(next);
      return next;
    });

  const open = (id: string, keepNotice = false) => {
    saveActiveId(id);
    if (!keepNotice) setNotice(null);
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('report', id);
        return p;
      },
      { replace: false },
    );
  };

  const update = (change: (r: Report) => Report) => {
    if (active.template) {
      const copy: Report = { ...change(active), id: crypto.randomUUID(), template: undefined, updatedAt: Date.now() };
      setMine((list) => [copy, ...list]);
      setNotice({ kind: 'forked', name: copy.name, templateId: active.id });
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

  const create = (dims: 2 | 3) => add(blankReport(dims, dims === 3 ? 'New 3D report' : 'New report'));

  const duplicate = () =>
    add({ ...active, id: crypto.randomUUID(), name: `${active.name} copy`, template: undefined, updatedAt: Date.now() });

  const remove = () => {
    if (active.template) return;
    const index = mine.findIndex((r) => r.id === active.id);
    const rest = mine.filter((r) => r.id !== active.id);
    setMine(() => rest);
    open(rest[Math.min(index, rest.length - 1)]?.id ?? TEMPLATES[0]!.id, true);
    setNotice({ kind: 'deleted', report: active, index });
  };

  const undoDelete = () => {
    if (notice?.kind !== 'deleted') return;
    const { report, index } = notice;
    setMine((list) => [...list.slice(0, index), report, ...list.slice(index)]);
    open(report.id);
  };

  return { mine, active, open, update, create, duplicate, remove, undoDelete, notice, dismissNotice: () => setNotice(null) };
}
