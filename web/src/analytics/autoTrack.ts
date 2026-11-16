import { useEffect } from 'react';
import { currentLocale } from '../i18n/I18nProvider';
import { pageLabel } from './rows';
import { beginVisit, getInput, getPage, save, setInput, setPage, track } from './tracker';

/*
 * Automatic tracking, installed once at start-up: every button, link, tab and toggle used (by its visible
 * name), settings changed, shortcuts, copies, page views with time spent and scroll depth, load timings,
 * slow frames, and the device and browser the app runs in.
 *
 * All listeners are passive and do a few property reads; nothing waits on them.
 * Text fields are recorded as "edited", never with what was typed.
 */

const INTERACTIVE =
  'button, a[href], summary, [role="button"], [role="tab"], [role="radio"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="option"], [role="link"]';

const squash = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** The name a person would use for a control: an explicit data-track name, its accessible name, or its text. */
export function controlName(el: Element): string {
  const explicit = el.getAttribute('data-track');
  if (explicit) return explicit;
  const aria = el.getAttribute('aria-label');
  if (aria) return squash(aria);
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => squash(document.getElementById(id)?.textContent))
      .filter(Boolean)
      .join(' ');
    if (text) return text;
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    const label = el.labels?.[0];
    if (label) return squash(label.textContent);
    if (el.name) return el.name;
  }
  return visibleText(el) || squash(el.getAttribute('title')) || el.tagName.toLowerCase();
}

const roleOf = (el: Element) =>
  el.getAttribute('role') ?? (el.tagName === 'A' ? 'link' : el.tagName === 'SUMMARY' ? 'disclosure' : el.tagName.toLowerCase());

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

const TEXT_INPUTS = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number', '']);

function browserName(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}

function platformName(): string {
  const p = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || '';
  if (/win/i.test(p)) return 'Windows';
  if (/mac/i.test(p)) return 'macOS';
  if (/linux/i.test(p)) return /android/i.test(navigator.userAgent) ? 'Android' : 'Linux';
  if (/iphone|ipad/i.test(p)) return 'iOS';
  return p || 'Other';
}

const media = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;

function recordEnvironment() {
  const env: [string, string][] = [
    ['browser', browserName()],
    ['platform', platformName()],
    ['language', navigator.language],
    ['app language', currentLocale()],
    ['time zone', Intl.DateTimeFormat().resolvedOptions().timeZone],
    ['screen', `${screen.width}×${screen.height}`],
    ['pixel ratio', String(Math.round(devicePixelRatio * 100) / 100)],
    ['colour scheme', media('(prefers-color-scheme: dark)') ? 'dark' : 'light'],
    ['reduced motion', media('(prefers-reduced-motion: reduce)') ? 'reduce' : 'no preference'],
    ['contrast', media('(prefers-contrast: more)') ? 'more' : 'no preference'],
    ['pointer', media('(pointer: coarse)') ? 'coarse (touch)' : 'fine (mouse)'],
    ['cores', String(navigator.hardwareConcurrency || 'unknown')],
  ];
  for (const [target, detail] of env) track('env', { target, detail });
}

function recordLoadTiming() {
  const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (!nav) return;
  const s = (ms: number) => Math.round(ms) / 1000;
  if (nav.domContentLoadedEventEnd) track('performance', { target: 'DOM ready', duration: s(nav.domContentLoadedEventEnd) });
  if (nav.loadEventEnd) track('performance', { target: 'page load', duration: s(nav.loadEventEnd) });
  if (nav.responseStart) track('performance', { target: 'first byte', duration: s(nav.responseStart) });
}

function observePaints() {
  if (typeof PerformanceObserver === 'undefined') return;
  const supported = PerformanceObserver.supportedEntryTypes ?? [];
  if (supported.includes('paint')) {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (e.name === 'first-contentful-paint') track('performance', { target: 'first paint', duration: Math.round(e.startTime) / 1000 });
    }).observe({ type: 'paint', buffered: true });
  }
  // Frames that block input for 50ms or more. Not counted on Analytics itself: its charts redraw as events
  // arrive, and counting those would feed back into more events.
  if (supported.includes('longtask')) {
    new PerformanceObserver((list) => {
      if (getPage() === 'Analytics') return;
      for (const e of list.getEntries()) track('long_task', { duration: Math.round(e.duration) / 1000 });
    }).observe({ type: 'longtask', buffered: false });
  }
}

let installed = false;

/** Starts automatic tracking. Safe to call more than once. */
export function installAnalytics() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const visit = beginVisit();
  setPage(pageLabel(location.pathname));

  track('visit', { target: 'start', detail: `${innerWidth}×${innerHeight}`, subject: document.referrer ? 'referred' : 'direct', value: visit });
  recordEnvironment();
  if (document.readyState === 'complete') setTimeout(recordLoadTiming, 0);
  else addEventListener('load', () => setTimeout(recordLoadTiming, 0), { once: true });
  observePaints();

  const opts = { capture: true, passive: true } as const;

  // Input modality: what the next click came from.
  addEventListener('pointerdown', (e) => setInput(e.pointerType || 'mouse'), opts);
  addEventListener(
    'keydown',
    (e) => {
      setInput('keyboard');
      if (isTyping(e.target)) return;
      const combo = [e.ctrlKey && 'Ctrl', e.metaKey && 'Meta', e.altKey && 'Alt', e.key.length === 1 && e.shiftKey && 'Shift'].filter(Boolean);
      // Shortcuts only: modifier combos and the app's single-key ones. Plain Tab / arrows are navigation, not shortcuts.
      if (combo.length || e.key === '/' || e.key === 'Escape') {
        track('shortcut', { target: [...combo, e.key.length === 1 ? e.key.toUpperCase() : e.key].join('+'), input: 'keyboard' });
      }
    },
    opts,
  );

  addEventListener(
    'click',
    (e) => {
      const el = (e.target as Element | null)?.closest?.(INTERACTIVE);
      if (!el) return;
      // detail 0 means the click came from Enter / Space, not a pointer.
      const input = e.detail === 0 ? 'keyboard' : getInput() === 'keyboard' ? 'mouse' : getInput() || 'mouse';
      const pressed = el.getAttribute('aria-pressed') ?? el.getAttribute('aria-checked') ?? el.getAttribute('aria-selected');
      track('click', {
        target: controlName(el),
        detail: roleOf(el),
        // State before the click: lets toggles be read as "turned on" vs "turned off".
        subject: pressed === 'true' ? 'was on' : pressed === 'false' ? 'was off' : '',
        input,
      });
    },
    opts,
  );

  // Native change fires once per committed edit (on release for sliders, on blur for text), not per keystroke.
  addEventListener(
    'change',
    (e) => {
      const el = e.target;
      if (el instanceof HTMLSelectElement) {
        track('change', { target: controlName(el), detail: 'select', subject: squash(el.selectedOptions[0]?.textContent), input: getInput() });
      } else if (el instanceof HTMLInputElement) {
        const type = el.type;
        if (type === 'checkbox' || type === 'radio') {
          track('change', { target: controlName(el), detail: type, subject: el.checked ? 'on' : 'off', input: getInput() });
        } else if (type === 'range' || type === 'color') {
          track('change', { target: controlName(el), detail: type, subject: el.value, input: getInput() });
        } else if (TEXT_INPUTS.has(type)) {
          track('change', { target: controlName(el), detail: 'text', subject: 'edited', input: getInput() });
        }
      } else if (el instanceof HTMLTextAreaElement) {
        track('change', { target: controlName(el), detail: 'text', subject: 'edited', input: getInput() });
      }
    },
    opts,
  );

  // How much was copied, never what.
  addEventListener('copy', () => track('copy', { target: 'selection', value: String(getSelection() ?? '').length }), opts);

  let visibleSince = performance.now();
  document.addEventListener('visibilitychange', () => {
    const now = performance.now();
    const seconds = Math.round(now - visibleSince) / 1000;
    visibleSince = now;
    if (document.visibilityState === 'hidden') {
      track('visibility', { target: 'hidden', duration: seconds, input: '' });
      closePageView();
      save();
    } else {
      track('visibility', { target: 'visible', duration: seconds, input: '' });
      openPageView(getPage());
    }
  });
  addEventListener('pagehide', () => {
    closePageView();
    track('visit', { target: 'end', input: '' });
    save();
  });

  addEventListener('scroll', onScroll, { passive: true });
}

/* ---------- Page views ---------- */

let view: { page: string; since: number; depth: number } | null = null;
let scrollFrame = 0;

function scrollDepth(): number {
  const max = document.documentElement.scrollHeight - innerHeight;
  return max <= 0 ? 100 : Math.min(100, Math.round(((scrollY + 0) / max) * 100));
}

function onScroll() {
  if (scrollFrame || !view) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    if (view) view.depth = Math.max(view.depth, scrollDepth());
  });
}

function openPageView(page: string) {
  view = { page, since: performance.now(), depth: 0 };
  // Pages that fit the window count as fully seen once they have rendered.
  requestAnimationFrame(() => view && (view.depth = Math.max(view.depth, scrollDepth())));
}

/** Records time spent and how far down the page was scrolled. */
function closePageView() {
  if (!view) return;
  const seconds = Math.round(performance.now() - view.since) / 1000;
  // A view shorter than this is a re-render (React StrictMode runs effects twice in development), not a visit.
  if (seconds < 0.25) {
    view = null;
    return;
  }
  track('page_view', { page: view.page, duration: seconds, value: view.depth, input: '' });
  view = null;
}

/** Keeps the current page up to date and records each page view as the user moves on. */
export function usePageTracking(pathname: string) {
  useEffect(() => {
    const page = pageLabel(pathname);
    closePageView();
    setPage(page);
    openPageView(page);
  }, [pathname]);
}

/** Text a sighted user sees: text nodes joined with spaces (so "Name" + "Description" stay apart), skipping screen-reader-only text. */
function visibleText(el: Element): string {
  const parts: string[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.parentElement?.closest('.sr-only, [aria-hidden="true"]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let node = walker.nextNode(); node && parts.length < 20; node = walker.nextNode()) {
    const text = squash(node.textContent);
    if (text) parts.push(text);
  }
  return parts.join(' ');
}
