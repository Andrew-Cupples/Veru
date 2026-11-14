/** The slice of Plotly's API the Reports page uses. Figures are built as plain objects in reports/figure.ts. */
declare module 'plotly.js-dist-min' {
  type Obj = Record<string, unknown>;
  interface PlotlyStatic {
    react(root: HTMLElement, data: Obj[], layout?: Obj, config?: Obj): Promise<HTMLElement>;
    purge(root: HTMLElement): void;
    downloadImage(root: HTMLElement, options: { format: 'png' | 'svg' | 'jpeg'; filename: string; width?: number; height?: number; scale?: number }): Promise<string>;
    Plots: { resize(root: HTMLElement): Promise<void> | void };
  }
  const Plotly: PlotlyStatic;
  export default Plotly;
}
