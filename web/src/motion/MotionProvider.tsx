import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { readJson, writeJson } from '../lib/storage';

export type MotionPreference = 'system' | 'on' | 'off';
/** Which way the user is moving, so content drifts in from the side they are heading towards. */
export type SlideDirection = 'forward' | 'back';

/** How long new content takes to settle, in ms. The Personalize slider sets it; everything else derives from it. */
export const DURATION = { min: 150, max: 600, step: 10, default: 260 } as const;

const STORAGE = { preference: 'veru.motion', duration: 'veru.motionDuration' } as const;
const isPreference = (v: unknown): v is MotionPreference => v === 'system' || v === 'on' || v === 'off';
const isDuration = (v: unknown): v is number => typeof v === 'number' && v >= DURATION.min && v <= DURATION.max;

/** The outgoing content leaves in under half the time the new content takes to arrive: eyes follow what's arriving. */
export const exitDuration = (enter: number) => Math.round(enter * 0.45);

const reduceQuery = () => window.matchMedia('(prefers-reduced-motion: reduce)');

function useSystemReducesMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = reduceQuery();
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => reduceQuery().matches,
  );
}

export interface MotionState {
  preference: MotionPreference;
  setPreference: (value: MotionPreference) => void;
  /** Whether the device asks for reduced motion (what "System" follows). */
  systemReduces: boolean;
  /** Whether motion is actually on right now. */
  enabled: boolean;
  /** Time for new content to settle, in ms. */
  duration: number;
  setDuration: (ms: number) => void;
  /**
   * Run a page-level change as a drifting view transition. Falls back to a plain update when motion
   * is off or the browser has no View Transitions support. If one is still running (rapid flipping),
   * it finishes at once and this change applies instantly, so moves never pile up.
   */
  slide: (update: () => void, direction: SlideDirection) => void;
  /** Run a whole-screen change (a new theme, light/dark) as a crossfade. Same fallbacks as slide(). */
  fade: (update: () => void) => void;
}

const MotionContext = createContext<MotionState | null>(null);

/**
 * Owns the motion setting. Writes data-motion="on|off" and the timing variables on <html>; global CSS
 * turns every animation and transition off under "off", so components can animate freely and still honour it.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<MotionPreference>(() => readJson(STORAGE.preference, 'system', isPreference));
  const [duration, setDur] = useState(() => readJson(STORAGE.duration, DURATION.default, isDuration));
  const systemReduces = useSystemReducesMotion();
  const enabled = preference === 'on' || (preference === 'system' && !systemReduces);
  const running = useRef<ViewTransition | null>(null);
  const lastChange = useRef(0);

  useLayoutEffect(() => {
    document.documentElement.dataset.motion = enabled ? 'on' : 'off';
  }, [enabled]);

  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--motion-enter', `${duration}ms`);
    root.setProperty('--motion-exit', `${exitDuration(duration)}ms`);
  }, [duration]);

  const setPreference = useCallback((value: MotionPreference) => {
    setPref(value);
    writeJson(STORAGE.preference, value);
  }, []);

  const setDuration = useCallback((ms: number) => {
    const value = Math.min(DURATION.max, Math.max(DURATION.min, Math.round(ms)));
    setDur(value);
    writeJson(STORAGE.duration, value);
  }, []);

  /**
   * Shared by slide() and fade(). `kind` goes on <html> as data-slide / data-fade for the transition's
   * lifetime; styles/motion.css keys off it to pick the animation.
   */
  const run = useCallback(
    (update: () => void, kind: { slide: SlideDirection } | { fade: true }) => {
      // Rapid flipping (clicking or arrowing through tabs/themes): finish any move at once and apply this
      // change instantly. Every quick change restarts the window, so a burst stays instant from start to end.
      const now = performance.now();
      const rapid = now - lastChange.current < duration;
      lastChange.current = now;
      if (running.current || rapid) {
        running.current?.skipTransition();
        running.current = null;
        update();
        return;
      }
      if (!enabled || typeof document.startViewTransition !== 'function') {
        update();
        return;
      }
      const root = document.documentElement;
      if ('slide' in kind) root.dataset.slide = kind.slide;
      else root.dataset.fade = '';
      const transition = document.startViewTransition(() => flushSync(update));
      running.current = transition;
      transition.finished.finally(() => {
        if (running.current === transition) running.current = null;
        // A newer transition may have set its own attributes by now; only clear when nothing is running.
        if (!running.current) {
          delete root.dataset.slide;
          delete root.dataset.fade;
        }
      });
    },
    [enabled, duration],
  );

  const slide = useCallback((update: () => void, direction: SlideDirection) => run(update, { slide: direction }), [run]);
  const fade = useCallback((update: () => void) => run(update, { fade: true }), [run]);

  const value = useMemo<MotionState>(
    () => ({ preference, setPreference, systemReduces, enabled, duration, setDuration, slide, fade }),
    [preference, setPreference, systemReduces, enabled, duration, setDuration, slide, fade],
  );

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useMotion(): MotionState {
  const state = useContext(MotionContext);
  if (!state) throw new Error('useMotion must be used inside <MotionProvider>');
  return state;
}

/**
 * For in-page tab panels: returns whether a switch made now should animate. False when a switch happened
 * within the last animation (rapid clicking or arrowing through tabs), so quick flipping stays instant.
 */
export function useCalmSwitch() {
  const { enabled, duration } = useMotion();
  const last = useRef(0);
  return useCallback(() => {
    const now = performance.now();
    const calm = now - last.current > duration;
    last.current = now;
    return enabled && calm;
  }, [enabled, duration]);
}
