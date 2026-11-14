import type { ReactNode } from 'react';
import { FIELD_BY_KEY } from './fields';
import { PALETTE_LABELS, paletteColors, type ThemeColors } from './figure';
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

const percent = (v: number) => `${Math.round(v * 100)}%`;

export function StylePanel({ report, onChange, colors }: Props) {
  const st = report.style;
  const rel = relevance(report);
  const set = <K extends keyof ReportStyle>(key: K, value: ReportStyle[K]) =>
    onChange((r) => ({ ...r, style: { ...r.style, [key]: value } }));

  return (
    <div className={styles.panelBody}>
      <Section title="Titles" open>
        <Toggle label="Show title" checked={st.showTitle} onChange={(v) => set('showTitle', v)} />
        {st.showTitle && (
          <>
            <TextField label="Title" value={st.title} placeholder={report.name} onChange={(v) => set('title', v)} />
            <TextField label="Subtitle" value={st.subtitle} placeholder="Optional" onChange={(v) => set('subtitle', v)} />
          </>
        )}
      </Section>

      <Section title="Colours" open>
        {rel.palette && colors && <PalettePicker value={st.palette} colors={colors} onChange={(v) => set('palette', v)} />}
        {rel.scale && (
          <>
            <SelectField<Colorscale>
              label="Colour scale"
              value={st.colorscale}
              options={COLORSCALES.map((c) => ({ value: c, label: c }))}
              onChange={(v) => set('colorscale', v)}
            />
            <Toggle label="Reverse scale" checked={st.reverseScale} onChange={(v) => set('reverseScale', v)} />
            <Toggle label="Show colour key" checked={st.showScale} onChange={(v) => set('showScale', v)} />
          </>
        )}
        {rel.candles && colors && (
          <>
            <ColorField label="Up colour" value={st.upColor} auto={colors.up} onChange={(v) => set('upColor', v)} />
            <ColorField label="Down colour" value={st.downColor} auto={colors.down} onChange={(v) => set('downColor', v)} />
          </>
        )}
        <Segmented
          label="Background"
          value={st.background}
          options={[
            { value: 'card', label: 'Card' },
            { value: 'transparent', label: 'None' },
            { value: 'custom', label: 'Custom' },
          ]}
          onChange={(v) => set('background', v)}
        />
        {st.background === 'custom' && (
          <ColorField label="Background colour" value={st.backgroundColor} auto="#ffffff" onChange={(v) => set('backgroundColor', v ?? '#ffffff')} />
        )}
      </Section>

      <Section title="Marks">
        {rel.lines && <RangeField label="Line width" value={st.lineWidth} min={0.5} max={8} step={0.5} onChange={(v) => set('lineWidth', v)} format={(v) => `${v}px`} />}
        {rel.lines && !rel.is3d && !rel.candles && (
          <Segmented
            label="Line shape"
            value={st.lineShape}
            options={[
              { value: 'linear', label: 'Straight' },
              { value: 'spline', label: 'Smooth' },
              { value: 'hv', label: 'Step' },
            ]}
            onChange={(v) => set('lineShape', v)}
          />
        )}
        {rel.markers && <Toggle label="Show points on lines" checked={st.markers} onChange={(v) => set('markers', v)} />}
        {rel.markerSize && <RangeField label="Point size" value={st.markerSize} min={2} max={20} onChange={(v) => set('markerSize', v)} format={(v) => `${v}px`} />}
        {rel.symbol && (
          <SelectField
            label="Point shape"
            value={st.markerSymbol}
            options={[
              { value: 'circle', label: 'Circle' },
              { value: 'square', label: 'Square' },
              { value: 'diamond', label: 'Diamond' },
              { value: 'triangle-up', label: 'Triangle' },
              { value: 'cross', label: 'Cross' },
            ]}
            onChange={(v) => set('markerSymbol', v)}
          />
        )}
        <RangeField label="Opacity" value={st.opacity} min={0.1} max={1} step={0.05} onChange={(v) => set('opacity', v)} format={percent} />
        {rel.barMode && (
          <Segmented
            label="Several series"
            value={st.barMode}
            options={[
              { value: 'group', label: 'Side by side' },
              { value: 'stack', label: 'Stacked' },
              { value: 'overlay', label: 'Overlaid' },
            ]}
            onChange={(v) => set('barMode', v)}
          />
        )}
        {rel.bins && (
          <RangeField label="Bins" value={st.bins} min={0} max={120} step={5} onChange={(v) => set('bins', v)} format={(v) => (v === 0 ? 'auto' : String(v))} />
        )}
        {rel.candles && <Toggle label="Volume underneath" checked={st.volumeOverlay} onChange={(v) => set('volumeOverlay', v)} />}
      </Section>

      <Section title="Axes">
        <TextField label={rel.is3d ? 'X axis title' : 'X axis title'} value={st.xTitle} placeholder="Field name" onChange={(v) => set('xTitle', v)} />
        {rel.yAxis && <TextField label="Y axis title" value={st.yTitle} placeholder="Field name" onChange={(v) => set('yTitle', v)} />}
        {rel.y2 && <TextField label="Right axis title" value={st.y2Title} placeholder="Field name" onChange={(v) => set('y2Title', v)} />}
        {rel.zTitle && <TextField label={rel.is3d ? 'Z axis title' : 'Colour key title'} value={st.zTitle} placeholder="Field name" onChange={(v) => set('zTitle', v)} />}
        {!rel.is3d && rel.yAxis && (
          <SelectField<NumberFormat>
            label="Y number format"
            value={st.yFormat}
            options={[
              { value: 'auto', label: 'Automatic' },
              { value: 'price', label: '1,234.56' },
              { value: 'compact', label: '1.23M' },
              { value: 'integer', label: '1,234' },
              { value: 'percent', label: '12.3%' },
            ]}
            onChange={(v) => set('yFormat', v)}
          />
        )}
        <Toggle label="Gridlines" checked={st.showGrid} onChange={(v) => set('showGrid', v)} />
        {!rel.is3d && rel.yAxis && <Toggle label="Log scale (Y)" checked={st.yLog} onChange={(v) => set('yLog', v)} />}
        {rel.timeX && <Toggle label="Skip nights and weekends" checked={st.skipGaps} onChange={(v) => set('skipGaps', v)} />}
        {rel.timeX && <Toggle label="Range slider" checked={st.rangeSlider} onChange={(v) => set('rangeSlider', v)} />}
      </Section>

      <Section title="Legend & hover">
        {rel.legend && (
          <SelectField<LegendPosition>
            label="Legend"
            value={st.legend}
            options={[
              { value: 'auto', label: 'Automatic' },
              { value: 'top', label: 'Top' },
              { value: 'bottom', label: 'Bottom' },
              { value: 'right', label: 'Right' },
              { value: 'hidden', label: 'Hidden' },
            ]}
            onChange={(v) => set('legend', v)}
          />
        )}
        <Segmented
          label="Hover shows"
          value={st.hover}
          options={[
            { value: 'x', label: rel.is3d ? 'Point' : 'All at X' },
            { value: 'closest', label: 'Nearest' },
            { value: 'none', label: 'Nothing' },
          ]}
          onChange={(v) => set('hover', v)}
        />
        <Toggle label="Crosshair lines" checked={st.spikes} onChange={(v) => set('spikes', v)} />
      </Section>

      {rel.is3d && (
        <Section title="3D view" open>
          <Segmented
            label="Camera"
            value={st.camera}
            options={[
              { value: 'iso', label: 'Angled' },
              { value: 'front', label: 'Front' },
              { value: 'side', label: 'Side' },
              { value: 'top', label: 'Top' },
            ]}
            onChange={(v) => set('camera', v)}
          />
          <Segmented
            label="Proportions"
            value={st.aspect}
            options={[
              { value: 'cube', label: 'Cube' },
              { value: 'data', label: 'True to data' },
            ]}
            onChange={(v) => set('aspect', v)}
          />
          <Segmented
            label="Projection"
            value={st.projection}
            options={[
              { value: 'perspective', label: 'Perspective' },
              { value: 'orthographic', label: 'Flat' },
            ]}
            onChange={(v) => set('projection', v)}
          />
          {rel.contours && <Toggle label="Contour lines" checked={st.contours} onChange={(v) => set('contours', v)} />}
        </Section>
      )}

      <Section title="Size & text">
        <RangeField label="Height" value={st.height} min={280} max={900} step={20} onChange={(v) => set('height', v)} format={(v) => `${v}px`} />
        <RangeField label="Text size" value={st.fontSize} min={10} max={18} onChange={(v) => set('fontSize', v)} format={(v) => `${v}px`} />
      </Section>

      <button
        type="button"
        className={dq.secondaryButton}
        onClick={() => onChange((r) => ({ ...r, style: { ...DEFAULT_STYLE } }))}
      >
        Reset all styling
      </button>
    </div>
  );
}

/** Palettes as swatch rows: what you see is what the series get. */
function PalettePicker({ value, colors, onChange }: { value: PaletteId; colors: ThemeColors; onChange: (v: PaletteId) => void }) {
  const { onKeyDown, radioProps } = radioGroup(PALETTES, value, onChange);
  return (
    <div className={styles.control}>
      <span id="palette-label" className={dq.fieldLabel}>
        Palette
      </span>
      <div role="radiogroup" aria-labelledby="palette-label" className={styles.paletteList} onKeyDown={onKeyDown}>
        {PALETTES.map((p) => (
          <button key={p} type="button" className={styles.paletteOption} {...radioProps(p)}>
            <span className={styles.swatches} aria-hidden="true">
              {paletteColors(p, colors).slice(0, 6).map((c, i) => (
                <span key={i} style={{ background: c }} />
              ))}
            </span>
            {PALETTE_LABELS[p]}
          </button>
        ))}
      </div>
    </div>
  );
}
