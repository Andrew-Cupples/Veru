import { radioGroup } from '../../a11y/radioGroup';
import { MultiSelectChips } from '../data-query/SourceControls';
import { FIELD_BY_KEY, fieldsFor, type FieldDef, type FieldKey } from './fields';
import { AGGREGATES, CHART_BY_TYPE, chartsFor, newSeries, type Aggregate, type ChartType, type Mark, type Report, type Series, type SlotRule } from './model';
import { ColorField, SelectField, Segmented } from './controls';
import { ChartIcon } from './ChartIcon';
import { useT } from '../../i18n/I18nProvider';
import { en } from '../../i18n/catalogs/en';
import styles from './Reports.module.css';

interface Props {
  report: Report;
  onChange: (update: (r: Report) => Report) => void;
  onChartChange: (chart: ChartType) => void;
  /** Colours the series get automatically, in order. */
  autoColors: readonly string[];
}

const fieldOptions = (fields: readonly FieldDef[], rule: SlotRule) =>
  fields.filter((f) => rule.kinds.includes(f.kind)).map((f) => ({ value: f.key as string, label: f.label }));

export function DataPanel({ report, onChange, onChartChange, autoColors }: Props) {
  const t = useT();
  const def = CHART_BY_TYPE[report.chart];
  const { enc } = report;
  const setEnc = (patch: Partial<Report['enc']>) => onChange((r) => ({ ...r, enc: { ...r.enc, ...patch } }));
  const charts = chartsFor(report.dataset);
  const fields = fieldsFor(report.dataset ?? 'market');
  const numericFields = fields.filter((f) => f.kind === 'number');
  const types = charts.map((c) => c.type);
  const { onKeyDown, radioProps } = radioGroup(types, report.chart, onChartChange);
  const mixable = report.chart === 'line' || report.chart === 'area' || report.chart === 'bar';

  const setSeriesFields = (picked: FieldKey[]) => {
    const existing = new Map(enc.series.map((s) => [s.field, s]));
    setEnc({ series: picked.map((f) => existing.get(f) ?? newSeries(f)) });
  };
  const patchSeries = (field: FieldKey, patch: Partial<Series>) =>
    setEnc({ series: enc.series.map((s) => (s.field === field ? { ...s, ...patch } : s)) });

  const slotSelect = (slot: 'x' | 'y' | 'z') => {
    const rule = def.slots[slot];
    if (!rule) return null;
    return (
      <SelectField
        key={slot}
        label={rule.label}
        value={enc[slot]}
        options={fieldOptions(fields, rule)}
        onChange={(v) => setEnc({ [slot]: v as FieldKey })}
      />
    );
  };

  const optionalSelect = (slot: 'color' | 'size') => {
    const rule = def.slots[slot];
    if (!rule) return null;
    return (
      <SelectField
        key={slot}
        label={rule.label}
        value={enc[slot] ?? ''}
        options={[{ value: '', label: t.common.none }, ...fieldOptions(fields, rule)]}
        onChange={(v) => setEnc({ [slot]: (v || null) as FieldKey | null })}
      />
    );
  };

  return (
    <div className={styles.panelBody}>
      <section aria-labelledby="chart-type-label">
        <h3 id="chart-type-label" className={styles.sectionTitle}>
          {t.reports.chartType}
        </h3>
        <div role="radiogroup" aria-labelledby="chart-type-label" onKeyDown={onKeyDown} className={styles.typeGroups}>
          {([2, 3] as const).map((dims) => (
            <div key={dims} className={styles.typeGroup}>
              <span className={styles.typeGroupLabel} aria-hidden="true">
                {dims}D
              </span>
              <div className={styles.typeGrid}>
                {charts.filter((c) => c.dims === dims).map((c) => (
                  <button key={c.type} type="button" className={styles.typeButton} title={c.description} data-track={en.charts[c.type].label} {...radioProps(c.type)}>
                    <ChartIcon type={c.type} />
                    <span>{c.label}</span>
                    <span className="sr-only">, {dims}D. {c.description}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="encoding-label">
        <h3 id="encoding-label" className={styles.sectionTitle}>
          {t.reports.fields}
        </h3>
        <div className={styles.controlGrid}>
          {slotSelect('x')}
          {slotSelect('y')}
          {slotSelect('z')}
          {optionalSelect('color')}
          {optionalSelect('size')}
          {def.aggregate && (
            <SelectField<Aggregate>
              label={t.reports.combine(report.dataset === 'analytics' ? 'events' : 'bars', def.slots.series ? 'x' : 'cell')}
              value={enc.aggregate}
              options={AGGREGATES.map((a) => ({ value: a.key, label: a.label, disabled: def.aggregate?.required && a.key === 'none' }))}
              onChange={(aggregate) => setEnc({ aggregate })}
            />
          )}
        </div>

        {def.slots.series && (
          <div className={styles.control}>
            <span className={styles.subTitle} id="series-label">
              {def.slots.series.label}
            </span>
            <MultiSelectChips
              label={def.slots.series.label}
              options={numericFields}
              selected={enc.series.map((s) => s.field)}
              onChange={setSeriesFields}
            />
            {!enc.series.length && (
              <p className={styles.inlineError} role="alert">
                {t.reports.pickOne}
              </p>
            )}
          </div>
        )}
      </section>

      {def.slots.series && enc.series.length > 0 && report.chart !== 'box' && (
        <section aria-labelledby="series-detail-label">
          <h3 id="series-detail-label" className={styles.sectionTitle}>
            {t.reports.series}
          </h3>
          <ul className={styles.seriesList}>
            {enc.series.map((s, i) => (
              <li key={s.field} className={styles.seriesItem} role="group" aria-label={FIELD_BY_KEY[s.field].label}>
                <span className={styles.seriesName}>{FIELD_BY_KEY[s.field].label}</span>
                {mixable && (
                  <SelectField<Mark | ''>
                    label={t.reports.drawAs}
                    value={s.mark ?? ''}
                    options={[
                      { value: '', label: t.reports.chartDefault(def.mark ? t.reports.marks[def.mark] : '') },
                      { value: 'line', label: t.reports.marks.line },
                      { value: 'area', label: t.reports.marks.area },
                      { value: 'bar', label: t.reports.marks.bar },
                      { value: 'scatter', label: t.reports.marks.scatter },
                    ]}
                    onChange={(m) => patchSeries(s.field, { mark: m || null })}
                  />
                )}
                <Segmented
                  label={t.reports.axis}
                  value={s.axis}
                  options={[
                    { value: 'left', label: t.reports.left },
                    { value: 'right', label: t.reports.right },
                  ]}
                  onChange={(axis) => patchSeries(s.field, { axis })}
                />
                {!(enc.color && FIELD_BY_KEY[enc.color].kind === 'category') && (
                  <ColorField
                    label={t.reports.colour}
                    value={s.color}
                    auto={autoColors[i % Math.max(1, autoColors.length)] ?? '#888888'}
                    onChange={(color) => patchSeries(s.field, { color })}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
