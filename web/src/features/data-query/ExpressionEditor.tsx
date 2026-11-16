import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { parseExpression, type ExprError } from './expression';
import { COLUMNS, type ColumnDef } from './query';
import { useT } from '../../i18n/I18nProvider';
import type { Messages } from '../../i18n/catalogs';
import styles from './DataQuery.module.css';

/*
 * WHERE as a typed logical expression. Typing is the fast path; the datapoint dropdown and token buttons
 * insert at the caret for anyone who'd rather click (or doesn't remember the names). After
 * `session =` and the like, the datapoint's known values are offered too.
 */

const SESSIONS = ['pre', 'regular', 'post'] as const;
const COMPARISONS = [
  { insert: '=', label: '=' },
  { insert: '!=', label: '≠' },
  { insert: '>', label: '>' },
  { insert: '>=', label: '≥' },
  { insert: '<', label: '<' },
  { insert: '<=', label: '≤' },
  { insert: 'CONTAINS', label: 'CONTAINS' },
] as const;
const LOGIC = ['AND', 'OR', 'XOR', 'NOT', '(', ')'] as const;

const quoteIfNeeded = (v: string) => (/^[\p{L}\p{N}_.:-]+$/u.test(v) ? v : `'${v.replaceAll("'", "''")}'`);

export function errorMessage(t: Messages, error: ExprError, columns: readonly ColumnDef<string>[]): string {
  const e = t.source.expression.errors;
  switch (error.code) {
    case 'unexpected': return e.unexpected(error.token);
    case 'expectedOperand': return error.token ? e.expectedOperand(error.token) : e.expectedOperandAtEnd;
    case 'expectedOperator': return e.expectedOperator(error.token);
    case 'expectedClose': return e.expectedClose;
    case 'unclosedQuote': return e.unclosedQuote;
    case 'unknownDatapoint': return e.unknownDatapoint(error.token);
    case 'noDatapoint': return e.noDatapoint;
    case 'needsNumber': {
      const column = columns.find((c) => c.key === error.token);
      return t.source.needsNumber(column?.label ?? error.token, error.token === 'volume' ? '1000000' : '0.00');
    }
  }
}

export function ExpressionEditor({
  where,
  onChange,
  columns = COLUMNS,
  example = 'close > open AND (volume >= 1000000 OR NOT session = regular)',
}: {
  where: string;
  onChange: (where: string) => void;
  /** The datapoints the expression may name; the raw bar columns unless given. */
  columns?: readonly ColumnDef<string>[];
  example?: string;
}) {
  const t = useT();
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(where.length);
  const pendingCaret = useRef<number | null>(null);

  const parsed = useMemo(() => parseExpression(where, columns), [where, columns]);
  const error = parsed.ok ? null : parsed.error;

  // Restore the caret after an inserted token re-renders the controlled textarea.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && pendingCaret.current !== null) {
      el.focus();
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
      setCaret(pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [where]);

  /** Inserts a token at the caret (replacing any selection), spaced from its neighbours. */
  const insert = (token: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? where.length;
    const end = el?.selectionEnd ?? where.length;
    // A closing parenthesis hugs what it closes: "(a = 1)", not "(a = 1 )".
    const before = token === ')' ? where.slice(0, start).trimEnd() : where.slice(0, start);
    const after = where.slice(end);
    const lead = before && !/[\s(]$/.test(before) && token !== ')' ? ' ' : '';
    const trail = token === '(' || /^[\s)]/.test(after) ? '' : ' ';
    const next = before + lead + token + trail + after;
    pendingCaret.current = (before + lead + token + trail).length;
    onChange(next);
  };

  // After "<datapoint> =" (or ≠, CONTAINS), offer that datapoint's known values.
  const values = useMemo(() => {
    const m = /([\p{L}\p{N}_]+)\s*(?:=|==|!=|<>|contains)\s*$/iu.exec(where.slice(0, caret));
    if (!m) return null;
    const column = columns.find((c) => c.key.toLowerCase() === m[1]!.toLowerCase());
    if (!column) return null;
    const choices = column.choices ?? (column.kind === 'session' ? SESSIONS : null);
    return choices ? { column, choices } : null;
  }, [where, caret, columns]);

  const trackCaret = (el: HTMLTextAreaElement) => setCaret(el.selectionStart);
  const errorId = `${id}-error`;

  return (
    <div className={styles.expression}>
      <div className={styles.expressionRow}>
        <textarea
          ref={ref}
          id={`${id}-input`}
          className={`${styles.input} ${styles.expressionInput}`}
          rows={1}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={t.source.expression.label}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          placeholder={example}
          value={where}
          onChange={(e) => {
            onChange(e.target.value);
            trackCaret(e.target);
          }}
          onSelect={(e) => trackCaret(e.currentTarget)}
          onKeyDown={(e) => {
            // Enter runs the query like any other field; Shift+Enter makes a new line in long expressions.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        {where && (
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              pendingCaret.current = 0;
              onChange('');
            }}
          >
            {t.source.clearAll}
          </button>
        )}
      </div>

      {error && (
        <p id={errorId} className={styles.fieldError}>
          {errorMessage(t, error, columns)}{' '}
          <button
            type="button"
            className={styles.inlineLink}
            onClick={() => {
              const el = ref.current;
              if (!el) return;
              el.focus();
              el.setSelectionRange(error.start, Math.max(error.end, error.start));
            }}
          >
            {t.source.expression.showError}
          </button>
        </p>
      )}
      <div className={styles.tokenBar}>
        <select
          className={`${styles.input} ${styles.datapointSelect}`}
          aria-label={t.source.expression.datapoints}
          value=""
          onChange={(e) => e.target.value && insert(e.target.value)}
        >
          <option value="">{t.source.expression.datapoints}</option>
          {columns.map((c) => (
            <option key={c.key} value={c.key} title={c.description}>
              {c.key} · {c.label}
            </option>
          ))}
        </select>
        {values && (
          <TokenGroup label={t.source.expression.values(values.column.label)}>
            {values.choices.map((v) => (
              <button key={v} type="button" className={styles.chip} onClick={() => insert(quoteIfNeeded(v))}>
                {v}
              </button>
            ))}
          </TokenGroup>
        )}
        <TokenGroup label={t.source.expression.comparisons}>
          {COMPARISONS.map((op) => (
            <button
              key={op.insert}
              type="button"
              className={styles.chip}
              aria-label={t.source.expression.insert(op.insert, op.label)}
              onClick={() => insert(op.insert)}
            >
              {op.label}
            </button>
          ))}
        </TokenGroup>
        <TokenGroup label={t.source.expression.logic}>
          {LOGIC.map((kw) => (
            <button key={kw} type="button" className={`${styles.chip} ${styles.keywordChip}`} onClick={() => insert(kw)}>
              {kw}
            </button>
          ))}
        </TokenGroup>
      </div>
    </div>
  );
}

function TokenGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.tokenGroup} role="group" aria-label={label}>
      {children}
    </div>
  );
}
