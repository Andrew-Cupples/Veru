import { readJson, writeJson } from '../lib/storage';

/*
 * In-app usage analytics, kept in this browser. track() is cheap: it appends to an in-memory list and
 * returns. Subscribers (the Analytics page) hear about new events at most once a second, and the list is
 * written to localStorage when the browser is idle (and straight away when the tab is hidden or closed),
 * so tracking never sits on the path of a click.
 *
 * Nothing typed into a text field is ever recorded: only which control was used.
 */

export const EVENT_KINDS = [
  'visit',
  'env',
  'page_view',
  'click',
  'change',
  'shortcut',
  'copy',
  'report',
  'export',
  'query',
  'api',
  'setting',
  'visibility',
  'performance',
  'long_task',
  'error',
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export interface AnalyticsEvent {
  /** Sequence number, from 1, across all visits. */
  n: number;
  /** Epoch milliseconds. */
  t: number;
  kind: EventKind;
  /** Page the event happened on (its nav label). */
  page: string;
  /** The control or action, e.g. "PNG", "open", "Run". */
  target: string;
  /** More about it: chart type, status code, control role... */
  detail: string;
  /** What it was about: report name, symbol, theme. */
  subject: string;
  /** How the user was interacting: mouse, keyboard, touch, pen, or "" when not from input. */
  input: string;
  visit: number;
  /** Seconds, when the event has a length (page dwell, API latency, long task). */
  duration: number | null;
  /** A number that goes with the event (scroll depth %, bars returned, pinned reports). */
  value: number | null;
}

export type EventFields = Partial<Pick<AnalyticsEvent, 'page' | 'target' | 'detail' | 'subject' | 'input' | 'duration' | 'value'>>;

const KEYS = { events: 'veru.analytics.events', paused: 'veru.analytics.paused', visits: 'veru.analytics.visits' } as const;
/** Oldest events are dropped past this, keeping storage to roughly a megabyte. */
export const MAX_EVENTS = 10_000;
const NOTIFY_MS = 1_000;
const SAVE_MS = 4_000;

/** Stored as tuples: about half the size of objects with keys. */
type Packed = [n: number, t: number, kind: string, page: string, target: string, detail: string, subject: string, input: string, visit: number, duration: number | null, value: number | null];

const KIND_SET = new Set<string>(EVENT_KINDS);
const isPacked = (v: unknown): v is Packed =>
  Array.isArray(v) && v.length === 11 && typeof v[0] === 'number' && typeof v[1] === 'number' && KIND_SET.has(v[2] as string);

const pack = (e: AnalyticsEvent): Packed => [e.n, e.t, e.kind, e.page, e.target, e.detail, e.subject, e.input, e.visit, e.duration, e.value];
const unpack = (p: Packed): AnalyticsEvent => ({
  n: p[0],
  t: p[1],
  kind: p[2] as EventKind,
  page: String(p[3] ?? ''),
  target: String(p[4] ?? ''),
  detail: String(p[5] ?? ''),
  subject: String(p[6] ?? ''),
  input: String(p[7] ?? ''),
  visit: Number(p[8]) || 0,
  duration: typeof p[9] === 'number' ? p[9] : null,
  value: typeof p[10] === 'number' ? p[10] : null,
});

/* ---------- State ---------- */

let events: AnalyticsEvent[] | null = null;
let snapshot: readonly AnalyticsEvent[] = [];
/** Events were added since the snapshot was taken. */
let dirty = false;
let paused = readJson(KEYS.paused, false, (v): v is boolean => typeof v === 'boolean');
let visit = 0;
let currentPage = '';
let currentInput = '';
let nextN = 1;
let notifyTimer: ReturnType<typeof setTimeout> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function list(): AnalyticsEvent[] {
  if (!events) {
    const raw = readJson<unknown[]>(KEYS.events, [], (v): v is unknown[] => Array.isArray(v));
    events = raw.filter(isPacked).map(unpack);
    nextN = (events[events.length - 1]?.n ?? 0) + 1;
    snapshot = events.slice();
  }
  return events;
}

function refresh() {
  if (!dirty) return;
  snapshot = list().slice();
  dirty = false;
}

function emit() {
  dirty = true;
  refresh();
  for (const l of listeners) l();
}

function scheduleNotify() {
  if (notifyTimer !== null || !listeners.size) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    emit();
  }, NOTIFY_MS);
}

const idle = (fn: () => void) =>
  typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 2_000 }) : setTimeout(fn, 0);

function scheduleSave() {
  if (saveTimer !== null) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    idle(save);
  }, SAVE_MS);
}

/** Writes pending events now. Called on idle, and when the tab is hidden or closed. */
export function save() {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (events) writeJson(KEYS.events, events.map(pack));
}

/* ---------- Recording ---------- */

/** Records one event. A no-op while tracking is paused. */
export function track(kind: EventKind, fields: EventFields = {}) {
  if (paused) return;
  const all = list();
  all.push({
    n: nextN++,
    t: Date.now(),
    kind,
    page: fields.page ?? currentPage,
    target: clip(fields.target ?? ''),
    detail: clip(fields.detail ?? ''),
    subject: clip(fields.subject ?? ''),
    input: fields.input ?? '',
    visit,
    duration: fields.duration ?? null,
    value: fields.value ?? null,
  });
  // Trim in batches, not on every event once full.
  if (all.length > MAX_EVENTS * 1.1) events = all.slice(-MAX_EVENTS);
  dirty = true;
  scheduleNotify();
  scheduleSave();
}

const clip = (s: string, max = 80) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export const setPage = (page: string) => void (currentPage = page);
export const getPage = () => currentPage;
export const setInput = (input: string) => void (currentInput = input);
export const getInput = () => currentInput;

/** Starts a new visit (one per page load) and returns its number. */
export function beginVisit(): number {
  visit = readJson(KEYS.visits, 0, (v): v is number => typeof v === 'number') + 1;
  writeJson(KEYS.visits, visit);
  return visit;
}

/* ---------- Reading and managing ---------- */

export function subscribe(listener: () => void) {
  list();
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The events so far. The same array until something changes, as useSyncExternalStore needs. */
export function getEvents(): readonly AnalyticsEvent[] {
  list();
  refresh();
  return snapshot;
}

export const isPaused = () => paused;

export function setPaused(value: boolean) {
  if (value) track('setting', { target: 'analytics', detail: 'paused' });
  paused = value;
  writeJson(KEYS.paused, value);
  if (!value) track('setting', { target: 'analytics', detail: 'resumed' });
  emit();
}

/** Deletes every stored event. Cannot be undone. */
export function clearEvents() {
  events = [];
  save();
  emit();
}

/** For tests. */
export function resetForTests() {
  events = null;
  snapshot = [];
  dirty = false;
  paused = false;
  visit = 0;
  currentPage = '';
  currentInput = '';
  nextN = 1;
  listeners.clear();
  if (notifyTimer !== null) clearTimeout(notifyTimer);
  if (saveTimer !== null) clearTimeout(saveTimer);
  notifyTimer = saveTimer = null;
}
