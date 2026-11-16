import type { ReactNode } from 'react';
import { FIELD_BY_KEY } from './fields';
import { paletteColors, type ThemeColors } from './figure';
import {
  CHART_BY_TYPE,
  COLORSCALES,
  DEFAULT_STYLE,
  PALETTES,
  type Colorscale,
  type LegendPosition,
  type NumberFormat,
  type PaletteId,
  type Report,
  type ReportStyle,
} from './model';
import { ColorField, RangeField, Segmented, SelectField, TextField, Toggle } from './controls';
import { radioGroup } from '../../a11y/radioGroup';
import { formatNumber, useT } from '../../i18n/I18nProvider';
import styles from './Reports.module.css';
import dq from '../data-query/DataQuery.module.css';

interface Props {
  report: Report;
  onChange: (update: (r: Report) => Report) => void;
  colors: ThemeColors | null;
}

/** Which style options mean anything for this chart, so the panel only shows what will change the picture. */
function relevance(report: Report) {
  const { chart, enc } = report;
  const def = CHART_BY_TYPE[chart];
  const cartesian = chart === 'line' || chart === 'area' || chart === 'bar' || chart === 'scatter';
  const marks = new Set(enc.series.map((s) => s.mark ?? def.mark));
  const timeX = (cartesian || chart === 'candlestick' || chart === 'ohlc') && FIELD_BY_KEY[enc.x].kind === 'time';
  const numericColor = !!enc.color && FIELD_BY_KEY[enc.color].kind === 'number';
  return {
    is3d: def.dims === 3,
    lines: (cartesian && (marks.has('line') || marks.has('area'))) || chart === 'line3d' || chart === 'ohlc' || chart === 'box',
    markers: (cartesian && (marks.has('line') || marks.has('area'))) || chart === 'line3d',
    markerSize: (cartesian && (marks.has('scatter') || marks.has('line'))) || chart === 'scatter3d' || chart === 'line3d' || chart === 'box',
    symbol: (cartesian && marks.has('scatter')) || chart === 'scatter3d',
    barMode: (cartesian && (marks.has('bar') || marks.has('area'))) || chart === 'histogram',
    bins: chart === 'histogram',
    candles: chart === 'candlestick' || chart === 'ohlc',
    scale: chart === 'heatmap' || chart === 'surface' || numericColor,
    palette: chart !== 'heatmap' && chart !== 'surface' && chart !== 'candlestick' && chart !== 'ohlc',
    timeX,
    categoryX: cartesian && FIELD_BY_KEY[enc.x].kind === 'category',
    y2: enc.series.some((s) => s.axis === 'right') && cartesian,
    yAxis: chart !== 'heatmap',
    zTitle: def.dims === 3 || chart === 'heatmap',
    contours: chart === 'surface',
    legend: chart !== 'heatmap' && chart !== 'surface',
    hover: true,
  };
}

function Section({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  // Native disclosure: keyboard and screen readers get expand/collapse for free.
  return (
    <details className={styles.styleSection} open={open}>
      <summary>{title}</summary>
      <div className={styles.controlGrid}>{children}</div>
    </details>
  );
}

const percent = (v: number) => formatNumber(v, { style: 'percent' });

export function StylePanel({ report, onChange, colors }: Props) {
  const t = useT();
  const st = report.style;
  const rel = relevance(report);
  const set = <K extends keyof ReportStyle>(key: K, value: ReportStyle[K]) =>
    onChange((r) => ({ ...r, style: { ...r.style, [key]: value } }));

  return (
    <div className={styles.panelBody}>
      <Section title={t.style.titles} open>
        <Toggle label={t.style.showTitle} checked={st.showTitle} onChange={(v) => set('showTitle', v)} />
        {st.showTitle && (
          <>
            <TextField label={t.style.title} value={st.title} placeholder={report.name} onChange={(v) => set('title', v)} />
            <TextField label={t.style.subtitle} value={st.subtitle} placeholder={t.style.optional} onChange={(v) => set('subtitle', v)} />
          </>
        )}
      </Section>

      <Section title={t.style.colours} open>
        {rel.palette && colors && <PalettePicker value={st.palette} colors={colors} onChange={(v) => set('palette', v)} />}
        {rel.scale && (
          <>
            <SelectField<Colorscale>
              label={t.style.colourScale}
              value={st.colorscale}
              options={COLORSCALES.map((c) => ({ value: c, label: c }))}
              onChange={(v) => set('colorscale', v)}
            />
            <Toggle label={t.style.reverseScale} checked={st.reverseScale} onChange={(v) => set('reverseScale', v)} />
            <Toggle label={t.style.showColourKey} checked={st.showScale} onChange={(v) => set('showScale', v)} />
          </>
        )}
        {rel.candles && colors && (
          <>
            <ColorField label={t.style.upColour} value={st.upColor} auto={colors.up} onChange={(v) => set('upColor', v)} />
            <ColorField label={t.style.downColour} value={st.downColor} auto={colors.down} onChange={(v) => set('downColor', v)} />
          </>
        )}
        <Segmented
          label={t.style.background}
          value={st.background}
          options={[
            { value: 'card', label: t.style.card },
            { value: 'transparent', label: t.style.none },
            { value: 'custom', label: t.style.custom },
          ]}
          onChange={(v) => set('background', v)}
        />
        {st.background === 'custom' && (
          <ColorField label={t.style.backgroundColour} value={st.backgroundColor} auto="#ffffff" onChange={(v) => set('backgroundColor', v ?? '#ffffff')} />
        )}
      </Section>

      <Section title={t.style.marks}>
        {rel.lines && <RangeField label={t.style.lineWidth} value={st.lineWidth} min={0.5} max={8} step={0.5} onChange={(v) => set('lineWidth', v)} format={(v) => `${v}px`} />}
        {rel.lines && !rel.is3d && !rel.candles && (
          <Segmented
            label={t.style.lineShape}
            value={st.lineShape}
            options={[
              { value: 'linear', label: t.style.straight },
              { value: 'spline', label: t.style.smooth },
              { value: 'hv', label: t.style.step },
            ]}
            onChange={(v) => set('lineShape', v)}
          />
        )}
        {rel.markers && <Toggle label={t.style.showPointsOnLines} checked={st.markers} onChange={(v) => set('markers', v)} />}
        {rel.markerSize && <RangeField label={t.style.pointSize} value={st.markerSize} min={2} max={20} onChange={(v) => set('markerSize', v)} format={(v) => `${v}px`} />}
        {rel.symbol && (
          <SelectField
            label={t.style.pointShape}
            value={st.markerSymbol}
            options={[
              { value: 'circle', label: t.style.circle },
              { value: 'square', label: t.style.square },
              { value: 'diamond', label: t.style.diamond },
              { value: 'triangle-up', label: t.style.triangle },
              { value: 'cross', label: t.style.cross },
            ]}
            onChange={(v) => set('markerSymbol', v)}
          />
        )}
        <RangeField label={t.style.opacity} value={st.opacity} min={0.1} max={1} step={0.05} onChange={(v) => set('opacity', v)} format={percent} />
        {rel.barMode && (
          <Segmented
            label={t.style.severalSeries}
            value={st.barMode}
            options={[
              { value: 'group', label: t.style.sideBySide },
              { value: 'stack', label: t.style.stacked },
              { value: 'overlay', label: t.style.overlaid },
            ]}
            onChange={(v) => set('barMode', v)}
          />
        )}
        {rel.bins && (
          <RangeField label={t.style.bins} value={st.bins} min={0} max={120} step={5} onChange={(v) => set('bins', v)} format={(v) => (v === 0 ? t.reports.auto : formatNumber(v))} />
        )}
        {rel.candles && <Toggle label={t.style.volumeUnderneath} checked={st.volumeOverlay} onChange={(v) => set('volumeOverlay', v)} />}
      </Section>

      <Section title={t.style.axes}>
        <TextField label={rel.is3d ? t.style.xAxisTitle : t.style.xAxisTitle} value={st.xTitle} placeholder={t.style.fieldName} onChange={(v) => set('xTitle', v)} />
        {rel.yAxis && <TextField label={t.style.yAxisTitle} value={st.yTitle} placeholder={t.style.fieldName} onChange={(v) => set('yTitle', v)} />}
        {rel.y2 && <TextField label={t.style.rightAxisTitle} value={st.y2Title} placeholder={t.style.fieldName} onChange={(v) => set('y2Title', v)} />}
        {rel.zTitle && <TextField label={rel.is3d ? t.style.zAxisTitle : t.style.colourKeyTitle} value={st.zTitle} placeholder={t.style.fieldName} onChange={(v) => set('zTitle', v)} />}
        {!rel.is3d && rel.yAxis && (
          <SelectField<NumberFormat>
            label={t.style.yNumberFormat}
            value={st.yFormat}
            options={[
              { value: 'auto', label: t.style.automatic },
              { value: 'price', label: formatNumber(1234.56, { minimumFractionDigits: 2 }) },
              { value: 'compact', label: formatNumber(1230000, { notation: 'compact', maximumFractionDigits: 2 }) },
              { value: 'integer', label: formatNumber(1234) },
              { value: 'percent', label: formatNumber(0.123, { style: 'percent', maximumFractionDigits: 1 }) },
            ]}
            onChange={(v) => set('yFormat', v)}
          />
        )}
        <Toggle label={t.style.gridlines} checked={st.showGrid} onChange={(v) => set('showGrid', v)} />
        {!rel.is3d && rel.yAxis && <Toggle label={t.style.logScaleY} checked={st.yLog} onChange={(v) => set('yLog', v)} />}
        {rel.categoryX && (
          <Segmented
            label={t.style.orderXBy}
            value={st.xOrder}
            options={[
              { value: 'natural', label: t.style.name },
              { value: 'value', label: t.style.largestFirst },
            ]}
            onChange={(v) => set('xOrder', v)}
          />
        )}
        {rel.timeX && (
          <Toggle
            label={report.dataset === 'analytics' ? t.style.skipQuietStretches : t.style.skipNightsAndWeekends}
            checked={st.skipGaps}
            onChange={(v) => set('skipGaps', v)}
          />
        )}
        {rel.timeX && <Toggle label={t.style.rangeSlider} checked={st.rangeSlider} onChange={(v) => set('rangeSlider', v)} />}
      </Section>

      <Section title={t.style.legendHover}>
        {rel.legend && (
          <SelectField<LegendPosition>
            label={t.style.legend}
            value={st.legend}
            options={[
              { value: 'auto', label: t.style.automatic },
              { value: 'top', label: t.style.top },
              { value: 'bottom', label: t.style.bottom },
              { value: 'right', label: t.style.right },
              { value: 'hidden', label: t.style.hidden },
            ]}
            onChange={(v) => set('legend', v)}
          />
        )}
        <Segmented
          label={t.style.hoverShows}
          value={st.hover}
          options={[
            { value: 'x', label: rel.is3d ? t.style.point : t.style.allAtX },
            { value: 'closest', label: t.style.nearest },
            { value: 'none', label: t.style.nothing },
          ]}
          onChange={(v) => set('hover', v)}
        />
        <Toggle label={t.style.crosshairLines} checked={st.spikes} onChange={(v) => set('spikes', v)} />
      </Section>

      {rel.is3d && (
        <Section title={t.style.n3dView} open>
          <Segmented
            label={t.style.camera}
            value={st.camera}
            options={[
              { value: 'iso', label: t.style.angled },
              { value: 'front', label: t.style.front },
              { value: 'side', label: t.style.side },
              { value: 'top', label: t.style.top },
            ]}
            onChange={(v) => set('camera', v)}
          />
          <Segmented
            label={t.style.proportions}
            value={st.aspect}
            options={[
              { value: 'cube', label: t.style.cube },
              { value: 'data', label: t.style.trueToData },
            ]}
            onChange={(v) => set('aspect', v)}
          />
          <Segmented
            label={t.style.projection}
            value={st.projection}
            options={[
              { value: 'perspective', label: t.style.perspective },
              { value: 'orthographic', label: t.style.flat },
            ]}
            onChange={(v) => set('projection', v)}
          />
          {rel.contours && <Toggle label={t.style.contourLines} checked={st.contours} onChange={(v) => set('contours', v)} />}
        </Section>
      )}

      <Section title={t.style.sizeText}>
        <RangeField label={t.style.height} value={st.height} min={280} max={900} step={20} onChange={(v) => set('height', v)} format={(v) => `${v}px`} />
        <RangeField label={t.style.textSize} value={st.fontSize} min={10} max={18} onChange={(v) => set('fontSize', v)} format={(v) => `${v}px`} />
      </Section>

      <button
        type="button"
        className={dq.secondaryButton}
        onClick={() => onChange((r) => ({ ...r, style: { ...DEFAULT_STYLE } }))}
      >
        {t.style.resetAll}
      </button>
    </div>
  );
}

/** Palettes as swatch rows: what you see is what the series get. */
function PalettePicker({ value, colors, onChange }: { value: PaletteId; colors: ThemeColors; onChange: (v: PaletteId) => void }) {
  const t = useT();
  const { onKeyDown, radioProps } = radioGroup(PALETTES, value, onChange);
  return (
    <div className={styles.control}>
      <span id="palette-label" className={dq.fieldLabel}>
        {t.style.palette}
      </span>
      <div role="radiogroup" aria-labelledby="palette-label" className={styles.paletteList} onKeyDown={onKeyDown}>
        {PALETTES.map((p) => (
          <button key={p} type="button" className={styles.paletteOption} {...radioProps(p)}>
            <span className={styles.swatches} aria-hidden="true">
              {paletteColors(p, colors).slice(0, 6).map((c, i) => (
                <span key={i} style={{ background: c }} />
              ))}
            </span>
            {t.style.palettes[p]}
          </button>
        ))}
      </div>
    </div>
  );
}
