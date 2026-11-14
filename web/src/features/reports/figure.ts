import { FIELD_BY_KEY, compareValues, type FieldKey } from './fields';
import { CHART_BY_TYPE, type CameraPreset, type NumberFormat, type PaletteId, type Report } from './model';
import type { Axis3D, Shaped } from './shape';

/*
 * Shaped data + a report's style + the active theme's colours → a Plotly figure.
 * Kept free of DOM and Plotly imports so it stays cheap to load and easy to test.
 */

export interface ThemeColors {
  ink: string;
  inkMuted: string;
  inkFaint: string;
  rule: string;
  ruleStrong: string;
  surface: string;
  surfaceRaised: string;
  accent: string;
  keyword: string;
  up: string;
  down: string;
  pre: string;
  post: string;
  warning: string;
  fontFamily: string;
}

export interface Figure {
  data: Record<string, unknown>[];
  layout: Record<string, unknown>;
}

type Rgb = [number, number, number];

function parseColor(color: string): Rgb | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3) h = [...h].map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(color);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

export function withAlpha(color: string, alpha: number): string {
  const rgb = parseColor(color);
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : color;
}

/** Hex form of a colour (for <input type="color">), or the fallback when it can't be read. */
export function toHex(color: string, fallback = '#888888'): string {
  const rgb = parseColor(color);
  return rgb ? `#${rgb.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}` : fallback;
}

export const PALETTE_LABELS: Record<PaletteId, string> = {
  theme: 'Theme',
  colorblind: 'Colour-blind safe',
  vivid: 'Vivid',
  warm: 'Warm',
  cool: 'Cool',
  mono: 'Single hue',
};

export function paletteColors(id: PaletteId, c: ThemeColors): string[] {
  switch (id) {
    case 'theme':
      return [c.accent, c.keyword, c.up, c.pre, c.post, c.warning, c.down];
    // Okabe–Ito, distinguishable with the common colour-vision deficiencies.
    case 'colorblind':
      return ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442', '#999999'];
    case 'vivid':
      return ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#17becf', '#bcbd22'];
    case 'warm':
      return ['#d62728', '#ff7f0e', '#e6ab02', '#a6761d', '#e7298a', '#b2182b'];
    case 'cool':
      return ['#386cb0', '#1b9e77', '#7570b3', '#17becf', '#2c7fb8', '#4daf4a'];
    case 'mono':
      return [1, 0.72, 0.5, 0.34, 0.22].map((a) => withAlpha(c.accent, a));
  }
}

const escapeHtml = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function numberFormat(format: NumberFormat, unit: string | undefined): { tickformat?: string; ticksuffix?: string } {
  const f = format === 'auto' ? (unit === 'percent' ? 'percent' : unit === 'shares' ? 'compact' : unit === 'price' ? 'price' : 'auto') : format;
  switch (f) {
    case 'price':
      return { tickformat: ',.2f' };
    case 'compact':
      return { tickformat: '.3~s' };
    case 'integer':
      return { tickformat: ',d' };
    case 'percent':
      return { tickformat: ',.2~f', ticksuffix: '%' };
    default:
      return {};
  }
}

const CAMERAS: Record<CameraPreset, Record<string, unknown>> = {
  iso: { eye: { x: 1.55, y: -1.55, z: 0.95 } },
  front: { eye: { x: 0, y: -2.3, z: 0.25 } },
  side: { eye: { x: 2.3, y: 0, z: 0.25 } },
  top: { eye: { x: 0, y: 0, z: 2.6 }, up: { x: 0, y: 1, z: 0 } },
};

/** At most `max` evenly spaced ticks for a labelled 3D or category axis. */
function sparseTicks(labels: readonly string[], max = 8) {
  const step = Math.max(1, Math.ceil(labels.length / max));
  const tickvals: number[] = [];
  const ticktext: string[] = [];
  labels.forEach((l, i) => {
    if (i % step === 0) {
      tickvals.push(i);
      ticktext.push(l);
    }
  });
  return { tickvals, ticktext };
}

export function axisTitle(custom: string, field: FieldKey | null, fallback = ''): string {
  if (custom.trim()) return custom.trim();
  return field ? FIELD_BY_KEY[field].label : fallback;
}

export function buildFigure(shaped: Shaped, report: Report, c: ThemeColors): Figure {
  const { style: st, enc, chart } = report;
  const def = CHART_BY_TYPE[chart];
  const palette = paletteColors(st.palette, c);
  const colorAt = (i: number) => palette[i % palette.length]!;
  const font = { family: c.fontFamily, size: st.fontSize, color: c.ink };
  const background =
    st.background === 'transparent' ? 'rgba(0,0,0,0)' : st.background === 'custom' ? st.backgroundColor : c.surfaceRaised;

  const axisBase = {
    gridcolor: c.rule,
    linecolor: c.ruleStrong,
    zerolinecolor: c.ruleStrong,
    tickcolor: c.ruleStrong,
    showgrid: st.showGrid,
    showline: true,
    automargin: true,
    tickfont: { color: c.inkMuted },
    showspikes: st.spikes,
    spikecolor: c.inkFaint,
    spikethickness: 1,
    spikedash: 'dot',
    spikemode: 'across',
    spikesnap: 'cursor',
  };
  const title = (text: string) => ({ text: escapeHtml(text), font: { color: c.inkMuted, size: st.fontSize } });
  const colorbar = (text: string) => ({
    title: { text: escapeHtml(text), font: { color: c.inkMuted, size: st.fontSize } },
    outlinewidth: 0,
    tickfont: { color: c.inkMuted },
    thickness: 14,
  });
  const scale = { colorscale: st.colorscale, reversescale: st.reverseScale };

  const data: Record<string, unknown>[] = [];
  const layout: Record<string, unknown> = {};
  let showLegendByDefault = false;
  let hasY2 = false;

  /** x axis for 2D charts, by field kind. Time skips overnight and weekend gaps by plotting bars side by side. */
  const xAxisFor = (field: FieldKey, categories?: readonly string[]) => {
    const kind = FIELD_BY_KEY[field].kind;
    const base = { ...axisBase, title: title(axisTitle(st.xTitle, field)) };
    if (kind === 'time') {
      if (!st.skipGaps) return { ...base, type: 'date' };
      // Bars side by side: label a handful of them, short (MM-DD HH:MM, or just the date for daily bars).
      const values = categories ?? [];
      const daily = values.every((v) => v.endsWith('00:00'));
      const ticks = sparseTicks(values, 7);
      return {
        ...base,
        type: 'category',
        tickangle: 0,
        tickmode: 'array',
        tickvals: ticks.tickvals.map((i) => values[i]),
        ticktext: ticks.ticktext.map((t) => (daily ? t.slice(0, 10) : `${t.slice(5, 10)} ${t.slice(11, 16)}`)),
        categoryorder: 'array',
        categoryarray: values,
      };
    }
    if (kind === 'category') return { ...base, type: 'category', categoryorder: 'array', categoryarray: categories ?? [] };
    return { ...base, type: 'linear' };
  };

  const firstSeriesField = enc.series[0]?.field ?? null;
  const yFmt = (field: FieldKey | null) => numberFormat(st.yFormat, field ? FIELD_BY_KEY[field].unit : undefined);

  switch (shaped.kind) {
    case 'cartesian': {
      const leftField = enc.series.find((s) => s.axis === 'left')?.field ?? firstSeriesField;
      const rightField = enc.series.find((s) => s.axis === 'right')?.field ?? null;
      hasY2 = shaped.traces.some((t) => t.axis === 'right');
      showLegendByDefault = shaped.traces.length > 1;
      const sizeMax = Math.max(1, ...shaped.traces.flatMap((t) => (t.size ?? []).map(Math.abs)));
      const colorBy = enc.color && FIELD_BY_KEY[enc.color].kind === 'number' ? enc.color : null;

      shaped.traces.forEach((t, i) => {
        const color = t.color ?? colorAt(i);
        const common = { name: t.name, x: t.x, y: t.y, yaxis: t.axis === 'right' ? 'y2' : 'y' };
        const line = { width: st.lineWidth, shape: st.lineShape, color };
        const marker = { size: st.markerSize, symbol: st.markerSymbol, color };
        switch (t.mark) {
          case 'line':
            data.push({ ...common, type: 'scatter', mode: st.markers ? 'lines+markers' : 'lines', line, marker, opacity: st.opacity });
            break;
          case 'area':
            data.push({
              ...common,
              type: 'scatter',
              mode: st.markers ? 'lines+markers' : 'lines',
              line,
              marker,
              fill: 'tozeroy',
              fillcolor: withAlpha(color, st.opacity * 0.6),
              ...(st.barMode === 'stack' ? { stackgroup: t.axis, fill: 'tonexty' } : {}),
            });
            break;
          case 'bar':
            data.push({ ...common, type: 'bar', marker: { color, opacity: st.opacity, line: { width: 0 } } });
            break;
          case 'scatter':
            data.push({
              ...common,
              type: 'scatter',
              mode: 'markers',
              marker: {
                symbol: st.markerSymbol,
                opacity: st.opacity,
                line: { width: 0 },
                ...(t.size
                  ? { size: t.size.map(Math.abs), sizemode: 'area', sizeref: (2 * sizeMax) / (st.markerSize * 3) ** 2, sizemin: 2 }
                  : { size: st.markerSize }),
                ...(t.colorValues && colorBy
                  ? { color: t.colorValues, ...scale, showscale: st.showScale && i === 0, colorbar: colorbar(FIELD_BY_KEY[colorBy].label) }
                  : { color }),
              },
            });
            break;
        }
      });

      const categories = [...new Set(shaped.traces.flatMap((t) => t.x.map(String)))].sort((a, b) => compareValues(enc.x, a, b));
      layout.xaxis = {
        ...xAxisFor(enc.x, categories),
        rangeslider: { visible: st.rangeSlider, bgcolor: c.surface, bordercolor: c.rule },
      };
      layout.yaxis = {
        ...axisBase,
        // One measure on the left: name it. Several: leave it to the legend unless the user titles it.
        title: title(axisTitle(st.yTitle, enc.series.filter((s) => s.axis === 'left').length === 1 ? leftField : null)),
        type: st.yLog ? 'log' : 'linear',
        ...yFmt(leftField),
      };
      if (hasY2) {
        layout.yaxis2 = {
          ...axisBase,
          overlaying: 'y',
          side: 'right',
          showgrid: false,
          title: title(axisTitle(st.y2Title, rightField)),
          type: st.yLog ? 'log' : 'linear',
          ...numberFormat('auto', rightField ? FIELD_BY_KEY[rightField].unit : undefined),
        };
      }
      layout.barmode = st.barMode === 'overlay' ? 'overlay' : st.barMode === 'stack' ? 'stack' : 'group';
      layout.bargap = 0.15;
      break;
    }

    case 'ohlc': {
      const up = st.upColor ?? c.up;
      const down = st.downColor ?? c.down;
      data.push({
        type: chart === 'ohlc' ? 'ohlc' : 'candlestick',
        name: report.name,
        x: shaped.x,
        open: shaped.open,
        high: shaped.high,
        low: shaped.low,
        close: shaped.close,
        increasing: { line: { color: up, width: chart === 'ohlc' ? st.lineWidth : 1 }, fillcolor: up },
        decreasing: { line: { color: down, width: chart === 'ohlc' ? st.lineWidth : 1 }, fillcolor: down },
        showlegend: false,
      });
      if (st.volumeOverlay) {
        hasY2 = true;
        const max = Math.max(1, ...shaped.volume);
        data.push({
          type: 'bar',
          name: 'Volume',
          x: shaped.x,
          y: shaped.volume,
          yaxis: 'y2',
          marker: { color: shaped.close.map((cl, i) => withAlpha(cl >= shaped.open[i]! ? up : down, 0.35)), line: { width: 0 } },
          showlegend: false,
          hoverinfo: 'y',
        });
        // Volume lives in the bottom quarter, under the candles.
        layout.yaxis2 = { overlaying: 'y', side: 'right', range: [0, max * 4], showgrid: false, showticklabels: false, zeroline: false, fixedrange: true };
      }
      layout.xaxis = {
        ...xAxisFor(enc.x, shaped.x.map(String)),
        rangeslider: { visible: st.rangeSlider, bgcolor: c.surface, bordercolor: c.rule },
      };
      layout.yaxis = { ...axisBase, title: title(axisTitle(st.yTitle, null, 'Price')), type: st.yLog ? 'log' : 'linear', ...numberFormat(st.yFormat, 'price') };
      break;
    }

    case 'histogram': {
      showLegendByDefault = shaped.traces.length > 1;
      shaped.traces.forEach((t, i) =>
        data.push({
          type: 'histogram',
          name: t.name,
          x: t.values,
          ...(st.bins > 0 ? { nbinsx: st.bins } : {}),
          marker: { color: colorAt(i), opacity: st.opacity, line: { width: 0 } },
        }),
      );
      layout.xaxis = { ...axisBase, title: title(axisTitle(st.xTitle, enc.x)), ...numberFormat('auto', FIELD_BY_KEY[enc.x].unit) };
      layout.yaxis = { ...axisBase, title: title(axisTitle(st.yTitle, null, 'Bars')), type: st.yLog ? 'log' : 'linear' };
      layout.barmode = st.barMode;
      layout.bargap = 0.04;
      break;
    }

    case 'box': {
      showLegendByDefault = shaped.traces.length > 1;
      shaped.traces.forEach((t, i) =>
        data.push({
          type: 'box',
          name: t.name,
          y: t.values,
          ...(t.groups ? { x: t.groups } : {}),
          boxmean: true,
          marker: { color: colorAt(i), size: Math.max(2, st.markerSize / 2), opacity: st.opacity },
          line: { width: Math.max(1, st.lineWidth / 1.5) },
        }),
      );
      const groups = enc.color
        ? [...new Set(shaped.traces.flatMap((t) => t.groups ?? []))].sort((a, b) => compareValues(enc.color!, a, b))
        : undefined;
      layout.xaxis = { ...axisBase, type: 'category', title: title(axisTitle(st.xTitle, enc.color)), ...(groups ? { categoryorder: 'array', categoryarray: groups } : {}) };
      layout.yaxis = { ...axisBase, title: title(axisTitle(st.yTitle, enc.series.length === 1 ? firstSeriesField : null)), type: st.yLog ? 'log' : 'linear', ...yFmt(firstSeriesField) };
      layout.boxmode = 'group';
      break;
    }

    case 'grid': {
      const values = shaped.z.flat().filter((v): v is number => v !== null);
      const diverging = values.some((v) => v < 0) && values.some((v) => v > 0);
      const zTitle = axisTitle(st.zTitle, enc.z);
      if (chart === 'heatmap') {
        data.push({
          type: 'heatmap',
          x: shaped.xLabels,
          y: shaped.yLabels,
          z: shaped.z,
          ...scale,
          ...(diverging ? { zmid: 0 } : {}),
          showscale: st.showScale,
          colorbar: colorbar(zTitle),
          hoverongaps: false,
          xgap: 1,
          ygap: 1,
          name: zTitle,
        });
        layout.xaxis = { ...axisBase, type: 'category', showgrid: false, title: title(axisTitle(st.xTitle, enc.x)), showspikes: false };
        layout.yaxis = { ...axisBase, type: 'category', showgrid: false, title: title(axisTitle(st.yTitle, enc.y)), autorange: 'reversed', showspikes: false };
      } else {
        data.push({
          type: 'surface',
          x: shaped.xLabels.map((_, i) => i),
          y: shaped.yLabels.map((_, i) => i),
          z: shaped.z,
          ...scale,
          showscale: st.showScale,
          colorbar: colorbar(zTitle),
          opacity: st.opacity,
          name: zTitle,
          customdata: shaped.yLabels.map((y) => shaped.xLabels.map((x) => [x, y])),
          hovertemplate: `%{customdata[0]} · %{customdata[1]}<br>${escapeHtml(zTitle)}: %{z:,.4~f}<extra></extra>`,
          contours: st.contours
            ? { z: { show: true, usecolormap: true, highlightcolor: c.ink, project: { z: true } } }
            : { z: { show: false } },
        });
        layout.scene = scene3d(st, c, axisBase, {
          x: { labels: shaped.xLabels, title: axisTitle(st.xTitle, enc.x) },
          y: { labels: shaped.yLabels, title: axisTitle(st.yTitle, enc.y) },
          z: { labels: null, title: zTitle },
        });
      }
      break;
    }

    case 'points3d': {
      const colorBy = enc.color && FIELD_BY_KEY[enc.color].kind === 'number' ? enc.color : null;
      showLegendByDefault = shaped.traces.length > 1;
      const sizeMax = Math.max(1, ...shaped.traces.flatMap((t) => (t.size ?? []).map(Math.abs)));
      shaped.traces.forEach((t, i) => {
        const color = colorAt(i);
        const colorScale = t.colorValues && colorBy
          ? { color: t.colorValues, ...scale, showscale: st.showScale && i === 0, colorbar: colorbar(FIELD_BY_KEY[colorBy].label) }
          : { color };
        const sizes = t.size?.map((s) => 2 + (Math.abs(s) / sizeMax) * st.markerSize * 2.5);
        data.push({
          type: 'scatter3d',
          name: t.name,
          mode: chart === 'line3d' ? (st.markers ? 'lines+markers' : 'lines') : 'markers',
          x: t.x,
          y: t.y,
          z: t.z,
          text: t.text,
          hovertemplate: `%{text}<br>${escapeHtml(axisTitle(st.xTitle, enc.x))}: %{x}<br>${escapeHtml(axisTitle(st.yTitle, enc.y))}: %{y}<br>${escapeHtml(axisTitle(st.zTitle, enc.z))}: %{z:,.4~f}<extra>${escapeHtml(t.name)}</extra>`,
          marker: { size: sizes ?? st.markerSize, symbol: st.markerSymbol === 'triangle-up' ? 'diamond' : st.markerSymbol, opacity: st.opacity, line: { width: 0 }, ...colorScale },
          ...(chart === 'line3d' ? { line: { width: st.lineWidth, ...colorScale, showscale: false } } : {}),
        });
      });
      layout.scene = scene3d(st, c, axisBase, {
        x: { ...shaped.axes.x, title: axisTitle(st.xTitle, enc.x) },
        y: { ...shaped.axes.y, title: axisTitle(st.yTitle, enc.y) },
        z: { labels: null, title: axisTitle(st.zTitle, enc.z) },
      });
      break;
    }
  }

  const legendShown = st.legend === 'hidden' ? false : st.legend === 'auto' ? showLegendByDefault : true;
  const legendAt = st.legend === 'auto' ? 'top' : st.legend;
  const titleText = (st.title.trim() || report.name).trim();
  const hasTitle = st.showTitle && !!titleText;
  const legendTop = legendShown && legendAt === 'top';

  layout.title = hasTitle
    ? {
        text: `<b>${escapeHtml(titleText)}</b>${st.subtitle.trim() ? `<br><span style="font-size:${st.fontSize}px;color:${c.inkMuted}">${escapeHtml(st.subtitle.trim())}</span>` : ''}`,
        x: 0.01,
        xanchor: 'left',
        y: 0.98,
        yanchor: 'top',
        font: { size: st.fontSize + 5, color: c.ink },
      }
    : undefined;
  layout.showlegend = legendShown;
  layout.legend =
    legendAt === 'bottom'
      ? { orientation: 'h', x: 0, y: -0.18, yanchor: 'top' }
      : legendAt === 'right'
        ? { orientation: 'v', x: 1.02, y: 1, xanchor: 'left' }
        : { orientation: 'h', x: 0, y: 1.01, yanchor: 'bottom' };
  layout.legend = { ...(layout.legend as object), font: { color: c.inkMuted, size: st.fontSize }, bgcolor: 'rgba(0,0,0,0)' };
  layout.paper_bgcolor = background;
  layout.plot_bgcolor = background;
  layout.font = font;
  layout.height = st.height;
  layout.autosize = true;
  layout.colorway = palette;
  layout.hovermode = st.hover === 'none' ? false : st.hover === 'x' && def.dims === 2 && chart !== 'heatmap' ? 'x unified' : 'closest';
  layout.hoverlabel = { bgcolor: c.surfaceRaised, bordercolor: c.ruleStrong, font: { color: c.ink, family: c.fontFamily } };
  layout.margin = {
    l: def.dims === 3 ? 0 : 56,
    r: def.dims === 3 ? 0 : hasY2 ? 56 : 20,
    t: (hasTitle ? (st.subtitle.trim() ? 72 : 48) : 16) + (legendTop && def.dims === 2 ? 26 : 0),
    b: def.dims === 3 ? 0 : 44,
  };
  // Keeps zoom, pan and 3D rotation across edits; changes when the report or camera preset does.
  layout.uirevision = `${report.id}:${st.camera}:${chart}`;
  return { data, layout };
}

function scene3d(
  st: Report['style'],
  c: ThemeColors,
  axisBase: Record<string, unknown>,
  axes: Record<'x' | 'y' | 'z', Axis3D & { title: string }>,
) {
  const axis = (a: Axis3D & { title: string }) => ({
    ...axisBase,
    showspikes: st.spikes,
    showbackground: true,
    backgroundcolor: withAlpha(c.surface, 0.6),
    title: { text: escapeHtml(a.title), font: { color: c.inkMuted, size: st.fontSize } },
    ...(a.labels ? sparseTicks(a.labels) : {}),
  });
  return {
    xaxis: axis(axes.x),
    yaxis: axis(axes.y),
    zaxis: axis(axes.z),
    camera: { ...CAMERAS[st.camera], projection: { type: st.projection } },
    aspectmode: st.aspect,
    bgcolor: 'rgba(0,0,0,0)',
  };
}
