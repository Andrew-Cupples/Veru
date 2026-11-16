import { useCallback, useEffect, useRef, useState } from 'react';
import { radioGroup } from '../../a11y/radioGroup';
import { DURATION, exitDuration, useMotion, type MotionPreference } from '../../motion/MotionProvider';
import { formatNumber, useT } from '../../i18n/I18nProvider';
import styles from './Personalize.module.css';

const MOTIONS: readonly MotionPreference[] = ['system', 'on', 'off'];

const SAMPLE_PAGES = ['first', 'second'] as const;
type SamplePage = (typeof SAMPLE_PAGES)[number];

/** Motion on/off, how long moves take, and a small sample that moves exactly like the app's pages do. */
export function MotionSettings() {
  const t = useT();
  const motion = useMotion();
  const group = radioGroup(MOTIONS, motion.preference, motion.setPreference);
  const ms = (value: number) => formatNumber(value, { style: 'unit', unit: 'millisecond', unitDisplay: 'short' });
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
      <h2 id="motion-heading">{t.motion.title}</h2>
      <p id="motion-note" className={styles.note}>
        {t.motion.note(motion.systemReduces)}
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
            <button key={m} type="button" {...group.radioProps(m)}>
              {t.common[m]}
            </button>
          ))}
        </div>

        <div className={styles.timing}>
          <div className={styles.timingHead}>
            <label htmlFor="motion-duration">{t.motion.speed}</label>
            <output htmlFor="motion-duration" className={styles.timingValue}>
              {ms(motion.duration)}
            </output>
            {motion.duration !== DURATION.default && (
              <button type="button" className={styles.resetButton} onClick={() => motion.setDuration(DURATION.default)}>
                {t.motion.reset}
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
            aria-valuetext={formatNumber(motion.duration, { style: 'unit', unit: 'millisecond', unitDisplay: 'long' })}
          />
          <div className={styles.timingScale} aria-hidden="true">
            <span>{t.motion.quicker}</span>
            <span>{t.motion.gentler}</span>
          </div>
          <p id="motion-duration-note" className={styles.note}>
            {motion.enabled
              ? t.motion.timing(ms(motion.duration), ms(exitDuration(motion.duration)))
              : t.motion.offNote}
          </p>
        </div>
      </div>

      <div className={styles.sample}>
        <div className={styles.sampleBar}>
          <span className={styles.sampleLabel} id="motion-sample-label">
            {t.motion.tryIt}
          </span>
          <div className={styles.segmented} role="radiogroup" aria-labelledby="motion-sample-label" onKeyDown={sample.group.onKeyDown}>
            {SAMPLE_PAGES.map((p) => (
              <button key={p} type="button" {...sample.group.radioProps(p)}>
                {t.motion.samplePages[p]}
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
  const t = useT();
  const first = page === SAMPLE_PAGES[0];
  return (
    <div
      className={[styles.samplePage, className].filter(Boolean).join(' ')}
      data-dir={dir}
      onAnimationEnd={onAnimationEnd}
    >
      <div className={styles.sampleTitle}>{t.motion.samplePages[page]}</div>
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
