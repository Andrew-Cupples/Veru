import { useId, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, marketApi, unwrap } from '../../api/client';
import type { components } from '../../api/schema';
import { getPage, track } from '../../analytics/tracker';
import styles from './Analytics.module.css';
import dq from '../data-query/DataQuery.module.css';

type SuggestionResponse = components['schemas']['SuggestionResponse'];

/** Same keys the API accepts (SuggestionCatalog on the server). */
export const FEATURES = [
  { value: 'raw-data', label: 'Raw data' },
  { value: 'reports', label: 'Reports' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'personalize', label: 'Personalize' },
  { value: 'prompt-ledger', label: 'Prompt ledger' },
  { value: 'other', label: 'Other…' },
] as const;

export const KINDS = [
  { value: 'want', label: 'I want…' },
  { value: 'like', label: 'I like…' },
  { value: 'problem', label: "Something's wrong" },
] as const;

const MAX_MESSAGE = 2000;
const LIST_KEY = ['suggestions'] as const;

type Field = 'feature' | 'otherFeature' | 'kind' | 'message';
type Errors = Partial<Record<Field, string>>;

const featureLabel = (s: SuggestionResponse) =>
  s.feature === 'other' ? (s.otherFeature ?? 'Other') : (FEATURES.find((f) => f.value === s.feature)?.label ?? s.feature);
const kindLabel = (kind: string) => KINDS.find((k) => k.value === kind)?.label ?? kind;

function validate(feature: string, other: string, message: string): Errors {
  const errors: Errors = {};
  if (!feature) errors.feature = 'Pick the feature this is about.';
  else if (feature === 'other' && !other.trim()) errors.otherFeature = 'Say which feature this is about.';
  if (!message.trim()) errors.message = 'Write your suggestion.';
  else if (message.trim().length > MAX_MESSAGE) errors.message = `Keep it under ${MAX_MESSAGE.toLocaleString()} characters.`;
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
      track('feedback', { target: kind, detail: featureLabel(saved), value: saved.message.length });
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
        Suggestion box
      </h2>
      <form className={styles.suggestionForm} onSubmit={submit} noValidate>
        <div className={styles.suggestionRow}>
          <label className={styles.suggestionField}>
            <span className={dq.fieldLabel}>Feature</span>
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
              <option value="">Choose…</option>
              {FEATURES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            {errorText('feature')}
          </label>

          {feature === 'other' && (
            <label className={styles.suggestionField}>
              <span className={dq.fieldLabel}>Which feature?</span>
              <input
                ref={refs.otherFeature}
                className={dq.input}
                value={other}
                maxLength={80}
                placeholder="e.g. Price alerts"
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
            <span className={dq.fieldLabel}>Type</span>
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
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            {errorText('kind')}
          </label>
        </div>

        <label className={styles.suggestionField}>
          <span className={dq.fieldLabel}>Suggestion</span>
          <textarea
            ref={refs.message}
            className={`${dq.input} ${styles.suggestionMessage}`}
            value={message}
            rows={3}
            maxLength={MAX_MESSAGE}
            placeholder="What would make this better?"
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
            {send.isPending ? 'Sending…' : 'Send'}
          </button>
          <span className={styles.suggestionHint}>Ctrl+Enter to send</span>
          <span role="status" className={styles.suggestionStatus}>
            {sent ? 'Thanks, your suggestion was saved.' : ''}
          </span>
        </div>
        {unexpectedError && (
          <p className={dq.fieldError} role="alert">
            Couldn't send: {send.error.message}
          </p>
        )}
      </form>

      {recent.data && recent.data.length > 0 && (
        <details className={styles.recent}>
          <summary>Recent suggestions ({recent.data.length})</summary>
          <ul>
            {recent.data.map((s) => (
              <li key={s.id}>
                <span className={styles.recentMeta}>
                  {featureLabel(s)} · {kindLabel(s.kind)} · {new Date(s.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
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
