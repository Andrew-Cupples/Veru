/** The slice of Plotly's API the Reports page uses. Figures are built as plain objects in reports/figure.ts. */
declare module 'plotly.js-dist-min' {
  type Obj = Record<string, unknown>;
  interface PlotlyStatic {
    react(root: HTMLElement, data: Obj[], layout?: Obj, config?: Obj): Promise<HTMLElement>;
    relayout(root: HTMLElement, update: Obj): Promise<HTMLElement>;
    purge(root: HTMLElement): void;
    downloadImage(root: HTMLElement, options: { format: 'png' | 'svg' | 'jpeg'; filename: string; width?: number; height?: number; scale?: number }): Promise<string>;
    Plots: { resize(root: HTMLElement): Promise<void> | void };
    Fx: {
      /** Shows hover labels for the given points. `noHoverEvent` stops it emitting plotly_hover. */
      hover(root: HTMLElement, points: { curveNumber: number; pointNumber: number }[], subplot?: string, noHoverEvent?: boolean): void;
      unhover(root: HTMLElement): void;
    };
  }
  const Plotly: PlotlyStatic;
  export default Plotly;
}

/** What Plotly adds to a plotted element. */
interface PlotlyElement extends HTMLElement {
  data?: { x?: unknown[] }[];
  on(event: string, handler: (e: Record<string, unknown> & { points?: { x?: string | number }[] }) => void): void;
  removeListener(event: string, handler: (...args: never[]) => void): void;
}
