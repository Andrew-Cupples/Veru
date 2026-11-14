import { readJson, writeJson } from '../../lib/storage';
import { isRecord } from '../data-query/memory';
import { isConditionList } from '../data-query/query';
import { FIELD_BY_KEY } from './fields';
import { CHART_BY_TYPE, DEFAULT_STYLE, type Report, type Series } from './model';

/** The user's reports and the one last open, kept in this browser. */

const KEYS = { reports: 'veru.reports.mine', active: 'veru.reports.active' } as const;

const isField = (v: unknown) => v === null || (typeof v === 'string' && v in FIELD_BY_KEY);
const isNonNullField = (v: unknown) => typeof v === 'string' && v in FIELD_BY_KEY;

function isSeries(v: unknown): v is Series {
  return isRecord(v) && isNonNullField(v.field) && (v.axis === 'left' || v.axis === 'right');
}

/**
 * Reads one stored report, or null if it is unusable. Style is merged over the defaults, so reports
 * saved before a style option existed pick up its default instead of being thrown away.
 */
export function parseReport(v: unknown): Report | null {
  if (!isRecord(v) || typeof v.id !== 'string' || typeof v.name !== 'string') return null;
  if (typeof v.chart !== 'string' || !(v.chart in CHART_BY_TYPE)) return null;
  const e = v.enc;
  if (!isRecord(e) || !isNonNullField(e.x) || !isNonNullField(e.y) || !isNonNullField(e.z)) return null;
  if (!isField(e.color) || !isField(e.size) || !Array.isArray(e.series) || !e.series.every(isSeries)) return null;
  if (typeof e.aggregate !== 'string') return null;
  if (!isConditionList(v.where)) return null;
  const style = isRecord(v.style) ? v.style : {};
  const enc = e as unknown as Report['enc'];
  return {
    id: v.id,
    name: v.name,
    chart: v.chart as Report['chart'],
    enc: {
      ...enc,
      series: enc.series.map((s) => ({ field: s.field, axis: s.axis, mark: s.mark ?? null, color: s.color ?? null })),
    },
    where: v.where,
    style: { ...DEFAULT_STYLE, ...(style as Partial<Report['style']>) },
    description: typeof v.description === 'string' ? v.description : undefined,
    dataset: v.dataset === 'analytics' ? 'analytics' : undefined,
    updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : 0,
  };
}

/** Where one page's reports are kept: Reports and Analytics each have their own list, open report and pins. */
export interface ReportStoreKeys {
  reports: string;
  active: string;
  pins: string;
}

export const MARKET_KEYS: ReportStoreKeys = { ...KEYS, pins: 'veru.reports.pinned' };

export function reportStore(keys: ReportStoreKeys) {
  return {
    load: (): Report[] => {
      const raw = readJson<unknown[]>(keys.reports, [], (x): x is unknown[] => Array.isArray(x));
      return raw.map(parseReport).filter((r): r is Report => r !== null);
    },
    save: (reports: readonly Report[]) => writeJson(keys.reports, reports),
    loadActiveId: () => readJson<string | null>(keys.active, null, (x): x is string | null => typeof x === 'string'),
    saveActiveId: (id: string) => writeJson(keys.active, id),
  };
}

const market = reportStore(MARKET_KEYS);
export const loadReports = market.load;
export const saveReports = market.save;
export const loadActiveId = market.loadActiveId;
export const saveActiveId = market.saveActiveId;
