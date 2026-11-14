import { useCallback, useEffect, useRef, useState } from 'react';
import { radioGroup } from '../../a11y/radioGroup';
import { DURATION, exitDuration, useMotion, type MotionPreference } from '../../motion/MotionProvider';
import styles from './Personalize.module.css';

const MOTIONS: { value: MotionPreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];

const SAMPLE_PAGES = ['First page', 'Second page'] as const;
type SamplePage = (typeof SAMPLE_PAGES)[number];

/** Motion on/off, how long moves take, and a small sample that moves exactly like the app's pages do. */
export function MotionSettings() {
  const motion = useMotion();
  const group = radioGroup(
    MOTIONS.map((m) => m.value),
    motion.preference,
    motion.setPreference,
  );
  const sample = useSample();

  // Replay the sample shortly after the slider settles, so the new timing can be felt without another click.
  const replay = sample.replay;
  // Compare with the last value rather than skipping the first run, so a remount (or StrictMode) never replays.
  const lastDuration = useRef(motion.duration);
  useEffect(() => {
    if (lastDuration.current === motion.duration) return;
    lastDuration.current = motion.duration;
    const id = setTimeout(replay, 300);
    return () => clearTimeout(id);
  }, [motion.duration, replay]);

  return (
    <section className={styles.section} aria-labelledby="motion-heading">
      <h2 id="motion-heading">Motion</h2>
      <p id="motion-note" className={styles.note}>
        Pages and panels drift a short way into place instead of switching instantly. System follows your device, which{' '}
        {motion.systemReduces ? 'asks for reduced motion, so motion is off' : 'allows motion, so motion is on'}.
      </p>

      <div className={styles.motionRow}>
        <div
          className={styles.segmented}
          role="radiogroup"
          aria-labelledby="motion-heading"
          aria-describedby="motion-note"
          onKeyDown={group.onKeyDown}
        >
          {MOTIONS.map((m) => (
            <button key={m.value} type="button" {...group.radioProps(m.value)}>
              {m.label}
            </button>
          ))}
        </div>

        <div className={styles.timing}>
          <div className={styles.timingHead}>
            <label htmlFor="motion-duration">Speed</label>
            <output htmlFor="motion-duration" className={styles.timingValue}>
              {motion.duration} ms
            </output>
            {motion.duration !== DURATION.default && (
              <button type="button" className={styles.resetButton} onClick={() => motion.setDuration(DURATION.default)}>
                Reset
              </button>
            )}
          </div>
          <input
            id="motion-duration"
            type="range"
            className={styles.slider}
            min={DURATION.min}
            max={DURATION.max}
            step={DURATION.step}
            value={motion.duration}
            disabled={!motion.enabled}
            onChange={(e) => motion.setDuration(Number(e.target.value))}
            aria-describedby="motion-duration-note"
            aria-valuetext={`${motion.duration} milliseconds`}
          />
          <div className={styles.timingScale} aria-hidden="true">
            <span>Quicker</span>
            <span>Gentler</span>
          </div>
          <p id="motion-duration-note" className={styles.note}>
            {motion.enabled
              ? `New content settles over ${motion.duration} ms; what it replaces leaves in ${exitDuration(motion.duration)} ms.`
              : 'Motion is off, so changes are instant. Turn it on to adjust the speed.'}
          </p>
        </div>
      </div>

      <div className={styles.sample}>
        <div className={styles.sampleBar}>
          <span className={styles.sampleLabel} id="motion-sample-label">
            Try it
          </span>
          <div className={styles.segmented} role="radiogroup" aria-labelledby="motion-sample-label" onKeyDown={sample.group.onKeyDown}>
            {SAMPLE_PAGES.map((p) => (
              <button key={p} type="button" {...sample.group.radioProps(p)}>
                {p}
              </button>
            ))}
          </div>
        </div>
        {/* Decorative: the pages are placeholder shapes, so keep them out of the accessibility tree. */}
        <div className={styles.sampleStage} aria-hidden="true">
          {sample.leaving && (
            <SamplePageView
              key={`out-${sample.seq}`}
              page={sample.leaving}
              className={styles.sampleOut}
              dir={sample.dir}
              onAnimationEnd={sample.clearLeaving}
            />
          )}
          <SamplePageView
            key={`in-${sample.seq}`}
            page={sample.page}
            className={sample.leaving ? styles.sampleIn : undefined}
            dir={sample.dir}
          />
        </div>
      </div>
    </section>
  );
}

/** Two placeholder pages that swap with the same drift, easing and timing as real page changes. */
function useSample() {
  const { enabled } = useMotion();
  const [state, setState] = useState<SampleState>({ page: SAMPLE_PAGES[0], leaving: null, dir: 'forward', seq: 0 });

  const go = useCallback((pick: (current: SamplePage) => SamplePage) => {
    setState((s) => {
      const next = pick(s.page);
      if (next === s.page) return s;
      return {
        page: next,
        // Flipping again mid-move drops the old page at once, like the app does.
        leaving: enabled && !s.leaving ? s.page : null,
        dir: SAMPLE_PAGES.indexOf(next) > SAMPLE_PAGES.indexOf(s.page) ? 'forward' : 'back',
        seq: s.seq + 1,
      };
    });
  }, [enabled]);

  const replay = useCallback(() => go((current) => SAMPLE_PAGES.find((p) => p !== current)!), [go]);
  const clearLeaving = useCallback(() => setState((s) => ({ ...s, leaving: null })), []);

  return {
    ...state,
    group: radioGroup(SAMPLE_PAGES, state.page, (p) => go(() => p)),
    replay,
    clearLeaving,
  };
}

interface SampleState {
  page: SamplePage;
  /** The page on its way out, while it animates. */
  leaving: SamplePage | null;
  dir: 'forward' | 'back';
  seq: number;
}

function SamplePageView({
  page,
  className,
  dir,
  onAnimationEnd,
}: {
  page: SamplePage;
  className?: string;
  /** Direction of travel; CSS turns it into which side this page leaves towards or arrives from. */
  dir: 'forward' | 'back';
  onAnimationEnd?: () => void;
}) {
  const first = page === SAMPLE_PAGES[0];
  return (
    <div
      className={[styles.samplePage, className].filter(Boolean).join(' ')}
      data-dir={dir}
      onAnimationEnd={onAnimationEnd}
    >
      <div className={styles.sampleTitle}>{page}</div>
      {first ? (
        <div className={styles.sampleRows}>
          {[90, 70, 82, 60, 76].map((w, i) => (
            <span key={i} style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : (
        <div className={styles.sampleBars}>
          {[40, 65, 50, 85, 60, 95, 70].map((h, i) => (
            <span key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}
