import { useId, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, marketApi, unwrap } from '../../api/client';
import type { components } from '../../api/schema';
import { getPage, track } from '../../analytics/tracker';
import styles from './Analytics.module.css';
import dq from '../data-query/DataQuery.module.css';
import { formatDateTime, messages, useT } from '../../i18n/I18nProvider';
import type { Messages } from '../../i18n/catalogs';
import { en } from '../../i18n/catalogs/en';

type SuggestionResponse = components['schemas']['SuggestionResponse'];

/** Same keys the API accepts (SuggestionCatalog on the server). */
export const FEATURES = ['raw-data', 'reports', 'analytics', 'personalize', 'prompt-ledger', 'other'] as const;

export const KINDS = ['want', 'like', 'problem'] as const;

const MAX_MESSAGE = 2000;
const LIST_KEY = ['suggestions'] as const;

type Field = 'feature' | 'otherFeature' | 'kind' | 'message';
type Errors = Partial<Record<Field, string>>;

type Suggest = Messages['suggest'];
const known = <K extends string>(list: readonly K[], value: string): value is K => (list as readonly string[]).includes(value);
const featureLabel = (s: SuggestionResponse, t: Suggest) =>
  s.feature === 'other' ? (s.otherFeature ?? t.other) : known(FEATURES, s.feature) ? t.features[s.feature] : s.feature;
const kindLabel = (kind: string, t: Suggest) => (known(KINDS, kind) ? t.kinds[kind] : kind);

function validate(feature: string, other: string, message: string): Errors {
  const t = messages().suggest;
  const errors: Errors = {};
  if (!feature) errors.feature = t.pickFeature;
  else if (feature === 'other' && !other.trim()) errors.otherFeature = t.sayWhich;
  if (!message.trim()) errors.message = t.writeIt;
  else if (message.trim().length > MAX_MESSAGE) errors.message = t.tooLong(MAX_MESSAGE);
  return errors;
}

/** Server validation errors come back as { errors: { field: [message] } }. */
function serverErrors(error: unknown): Errors | null {
  if (!(error instanceof ApiError) || error.status !== 400) return null;
  const problem = error.problem;
  if (!problem || typeof problem !== 'object' || !('errors' in problem)) return null;
  const out: Errors = {};
  for (const [k, v] of Object.entries((problem as { errors: Record<string, string[]> }).errors)) {
    if (k === 'feature' || k === 'otherFeature' || k === 'kind' || k === 'message') out[k] = v[0];
  }
  return out;
}

/** Quick feedback: which feature, what kind, a message. Saved by the API in its database. */
export function SuggestionBox() {
  const ids = useId();
  const t = useT();
  const queryClient = useQueryClient();
  const [feature, setFeature] = useState('');
  const [other, setOther] = useState('');
  const [kind, setKind] = useState<string>('want');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);
  const refs = {
    feature: useRef<HTMLSelectElement>(null),
    otherFeature: useRef<HTMLInputElement>(null),
    kind: useRef<HTMLSelectElement>(null),
    message: useRef<HTMLTextAreaElement>(null),
  };

  const recent = useQuery({
    queryKey: LIST_KEY,
    queryFn: async ({ signal }) => unwrap(await marketApi.GET('/api/suggestions', { params: { query: { limit: 20 } }, signal })),
    staleTime: 30_000,
    retry: false,
  });

  const send = useMutation({
    mutationFn: async () =>
      unwrap(
        await marketApi.POST('/api/suggestions', {
          body: { feature, otherFeature: feature === 'other' ? other.trim() : null, kind, message: message.trim(), page: getPage() || null },
        }),
      ),
    onSuccess: (saved) => {
      track('feedback', { target: kind, detail: featureLabel(saved, en.suggest), value: saved.message.length });
      setFeature('');
      setOther('');
      setMessage('');
      setErrors({});
      setSent(true);
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (error) => {
      const fieldErrors = serverErrors(error);
      if (fieldErrors) showErrors(fieldErrors);
    },
  });

  const showErrors = (next: Errors) => {
    setErrors(next);
    const first = (['feature', 'otherFeature', 'kind', 'message'] as const).find((f) => next[f]);
    if (first) refs[first].current?.focus();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSent(false);
    if (send.isPending) return;
    const found = validate(feature, other, message);
    if (Object.keys(found).length) return showErrors(found);
    send.mutate();
  };

  const clearError = (field: Field) => {
    setSent(false);
    if (errors[field]) setErrors(({ [field]: _gone, ...rest }) => (void _gone, rest));
  };

  const errorProps = (field: Field) =>
    errors[field] ? { 'aria-invalid': true as const, 'aria-describedby': `${ids}-${field}-error` } : {};
  const errorText = (field: Field) =>
    errors[field] && (
      <p id={`${ids}-${field}-error`} className={dq.fieldError}>
        {errors[field]}
      </p>
    );

  const unexpectedError = send.isError && !serverErrors(send.error);

  return (
    <section className={`${dq.card} ${styles.suggestions}`} aria-labelledby={`${ids}-title`}>
      <h2 id={`${ids}-title`} className={styles.suggestionsTitle}>
        {t.suggest.title}
      </h2>
      <form className={styles.suggestionForm} onSubmit={submit} noValidate>
        <div className={styles.suggestionRow}>
          <label className={styles.suggestionField}>
            <span className={dq.fieldLabel}>{t.suggest.feature}</span>
            <select
              ref={refs.feature}
              className={dq.input}
              value={feature}
              onChange={(e) => {
                setFeature(e.target.value);
                clearError('feature');
                // Choosing Other goes straight to naming it.
                if (e.target.value === 'other') requestAnimationFrame(() => refs.otherFeature.current?.focus());
              }}
              {...errorProps('feature')}
            >
              <option value="">{t.suggest.choose}</option>
              {FEATURES.map((f) => (
                <option key={f} value={f}>
                  {t.suggest.features[f]}
                </option>
              ))}
            </select>
            {errorText('feature')}
          </label>

          {feature === 'other' && (
            <label className={styles.suggestionField}>
              <span className={dq.fieldLabel}>{t.suggest.whichFeature}</span>
              <input
                ref={refs.otherFeature}
                className={dq.input}
                value={other}
                maxLength={80}
                placeholder={t.suggest.otherPlaceholder}
                onChange={(e) => {
                  setOther(e.target.value);
                  clearError('otherFeature');
                }}
                {...errorProps('otherFeature')}
              />
              {errorText('otherFeature')}
            </label>
          )}

          <label className={styles.suggestionField}>
            <span className={dq.fieldLabel}>{t.suggest.type}</span>
            <select
              ref={refs.kind}
              className={dq.input}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                clearError('kind');
              }}
              {...errorProps('kind')}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t.suggest.kinds[k]}
                </option>
              ))}
            </select>
            {errorText('kind')}
          </label>
        </div>

        <label className={styles.suggestionField}>
          <span className={dq.fieldLabel}>{t.suggest.suggestion}</span>
          <textarea
            ref={refs.message}
            className={`${dq.input} ${styles.suggestionMessage}`}
            value={message}
            rows={3}
            maxLength={MAX_MESSAGE}
            placeholder={t.suggest.placeholder}
            onChange={(e) => {
              setMessage(e.target.value);
              clearError('message');
            }}
            onKeyDown={(e) => {
              // Ctrl/Cmd+Enter sends without reaching for the button.
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
            }}
            {...errorProps('message')}
          />
          {errorText('message')}
        </label>

        <div className={styles.suggestionActions}>
          <button type="submit" className={dq.runButton} aria-disabled={send.isPending}>
            {send.isPending ? t.suggest.sending : t.suggest.send}
          </button>
          <span className={styles.suggestionHint}>{t.suggest.hint}</span>
          <span role="status" className={styles.suggestionStatus}>
            {sent ? t.suggest.thanks : ''}
          </span>
        </div>
        {unexpectedError && (
          <p className={dq.fieldError} role="alert">
            {t.suggest.failed(send.error.message)}
          </p>
        )}
      </form>

      {recent.data && recent.data.length > 0 && (
        <details className={styles.recent}>
          <summary>{t.suggest.recent(recent.data.length)}</summary>
          <ul>
            {recent.data.map((s) => (
              <li key={s.id}>
                <span className={styles.recentMeta}>
                  {featureLabel(s, t.suggest)} · {kindLabel(s.kind, t.suggest)} · {formatDateTime(s.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
                <span>{s.message}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
