import type { ColumnDef, ColumnKind } from './query';

/*
 * WHERE as a typed logical expression, e.g.
 *   (close > open AND volume >= 1000000) OR NOT session = regular
 *
 * Grammar (loosest binding first; NOT binds tightest):
 *   or      := xor ( OR xor )*
 *   xor     := and ( XOR and )*
 *   and     := not ( AND not )*
 *   not     := NOT not | '(' or ')' | compare
 *   compare := operand op operand        op: = == != <> > >= < <= CONTAINS
 *   operand := datapoint | number | 'quoted text' | "quoted text" | bare word (2026-11-13, 09:30, regular)
 *
 * A comparison needs at least one datapoint (a column name). Keywords and datapoints are case-insensitive.
 * Pure functions: parse once, evaluate per row.
 */

export type CompareOp = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains';
export type LogicOp = 'and' | 'or' | 'xor';

export type Operand = { type: 'column'; key: string; kind: ColumnKind } | { type: 'literal'; value: string; quoted: boolean };

export type Expr =
  | { type: 'logic'; op: LogicOp; left: Expr; right: Expr }
  | { type: 'not'; operand: Expr }
  | { type: 'compare'; op: CompareOp; left: Operand; right: Operand };

/** Why an expression can't be used, and where (character offsets into the text), for an inline error. */
export interface ExprError {
  code: 'unexpected' | 'expectedOperand' | 'expectedOperator' | 'expectedClose' | 'unclosedQuote' | 'unknownDatapoint' | 'needsNumber' | 'noDatapoint';
  /** The offending token's text, or the datapoint involved. */
  token: string;
  start: number;
  end: number;
}

export type ParseResult = { ok: true; expr: Expr | null } | { ok: false; error: ExprError };

type Token =
  | { t: 'word'; text: string; start: number; end: number }
  | { t: 'string'; text: string; start: number; end: number }
  | { t: 'op'; text: CompareOp; start: number; end: number }
  | { t: '(' | ')'; start: number; end: number }
  | { t: 'end'; start: number; end: number };

export const LOGIC_KEYWORDS = ['AND', 'OR', 'XOR', 'NOT'] as const;
const KEYWORDS = new Set(['and', 'or', 'xor', 'not', 'contains']);

class Fail extends Error {
  constructor(readonly detail: ExprError) {
    super(detail.code);
  }
}

const fail = (code: ExprError['code'], token: string, start: number, end: number): never => {
  throw new Fail({ code, token, start, end });
};

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const start = i;
    if (ch === '(' || ch === ')') {
      tokens.push({ t: ch, start, end: ++i });
      continue;
    }
    if (ch === "'" || ch === '"') {
      // SQL-style: a doubled quote inside is a literal quote.
      let value = '';
      i++;
      for (;;) {
        if (i >= text.length) fail('unclosedQuote', text.slice(start), start, text.length);
        if (text[i] === ch) {
          if (text[i + 1] === ch) {
            value += ch;
            i += 2;
            continue;
          }
          i++;
          break;
        }
        value += text[i++];
      }
      tokens.push({ t: 'string', text: value, start, end: i });
      continue;
    }
    const two = text.slice(i, i + 2);
    if (two === '>=' || two === '<=' || two === '!=' || two === '<>' || two === '==') {
      const op: CompareOp = two === '<>' ? '!=' : two === '==' ? '=' : (two as CompareOp);
      tokens.push({ t: 'op', text: op, start, end: (i += 2) });
      continue;
    }
    if (ch === '=' || ch === '>' || ch === '<') {
      tokens.push({ t: 'op', text: ch, start, end: ++i });
      continue;
    }
    // Keywords and aliases for people who type symbols.
    if (two === '&&' || two === '||') {
      tokens.push({ t: 'word', text: two === '&&' ? 'AND' : 'OR', start, end: (i += 2) });
      continue;
    }
    if (ch === '!') {
      tokens.push({ t: 'word', text: 'NOT', start, end: ++i });
      continue;
    }
    const m = /^[\p{L}\p{N}_.:+-]+/u.exec(text.slice(i));
    if (!m) fail('unexpected', ch, start, start + 1);
    i += m![0].length;
    const word = m![0];
    tokens.push(word.toLowerCase() === 'contains' ? { t: 'op', text: 'contains', start, end: i } : { t: 'word', text: word, start, end: i });
  }
  tokens.push({ t: 'end', start: text.length, end: text.length });
  return tokens;
}

const isNumber = (s: string) => s.trim() !== '' && Number.isFinite(Number(s));

/** Parses a WHERE expression against the datapoints the page offers. Blank text is a valid "no filter". */
export function parseExpression(text: string, columns: readonly ColumnDef<string>[]): ParseResult {
  if (!text.trim()) return { ok: true, expr: null };
  const byKey = new Map(columns.map((c) => [c.key.toLowerCase(), c]));
  try {
    const tokens = tokenize(text);
    let pos = 0;
    const peek = () => tokens[pos]!;
    const isKeyword = (tok: Token, kw: string) => tok.t === 'word' && tok.text.toLowerCase() === kw;
    const describe = (tok: Token) => (tok.t === 'end' ? '' : text.slice(tok.start, tok.end));

    const binary = (op: LogicOp, next: () => Expr) => (): Expr => {
      let left = next();
      while (isKeyword(peek(), op)) {
        pos++;
        left = { type: 'logic', op, left, right: next() };
      }
      return left;
    };

    const operand = (): Operand & { start: number; end: number } => {
      const tok = peek();
      if (tok.t === 'string') {
        pos++;
        return { type: 'literal', value: tok.text, quoted: true, start: tok.start, end: tok.end };
      }
      if (tok.t === 'word' && !KEYWORDS.has(tok.text.toLowerCase())) {
        pos++;
        const column = byKey.get(tok.text.toLowerCase());
        return column
          ? { type: 'column', key: column.key, kind: column.kind, start: tok.start, end: tok.end }
          : { type: 'literal', value: tok.text, quoted: false, start: tok.start, end: tok.end };
      }
      return fail('expectedOperand', describe(tok), tok.start, tok.end);
    };

    const compare = (): Expr => {
      const left = operand();
      const opTok = peek();
      if (opTok.t !== 'op') {
        // "closee > 5" reads better as an unknown datapoint than as a missing operator.
        if (left.type === 'literal' && !left.quoted && !isNumber(left.value)) fail('unknownDatapoint', left.value, left.start, left.end);
        return fail('expectedOperator', text.slice(left.start, left.end), left.start, left.end);
      }
      pos++;
      const right = operand();
      const column = left.type === 'column' ? left : right.type === 'column' ? right : null;
      if (!column) {
        const bare = [left, right].find((o) => o.type === 'literal' && !o.quoted && !isNumber(o.value));
        return bare
          ? fail('unknownDatapoint', (bare as { value: string }).value, bare.start, bare.end)
          : fail('noDatapoint', text.slice(left.start, right.end), left.start, right.end);
      }
      const other = column === left ? right : left;
      if (column.kind === 'number' && opTok.text !== 'contains' && other.type === 'literal' && !isNumber(other.value)) {
        fail('needsNumber', column.key, other.start, other.end);
      }
      const strip = (o: Operand): Operand => (o.type === 'column' ? { type: 'column', key: o.key, kind: o.kind } : { type: 'literal', value: o.value, quoted: o.quoted });
      return { type: 'compare', op: opTok.text, left: strip(left), right: strip(right) };
    };

    const not = (): Expr => {
      const tok = peek();
      if (isKeyword(tok, 'not')) {
        pos++;
        return { type: 'not', operand: not() };
      }
      if (tok.t === '(') {
        pos++;
        const inner = or();
        const close = peek();
        if (close.t !== ')') fail('expectedClose', describe(close), close.t === 'end' ? tok.start : close.start, close.t === 'end' ? tok.end : close.end);
        pos++;
        return inner;
      }
      return compare();
    };
    const and = binary('and', not);
    const xor = binary('xor', and);
    const or: () => Expr = binary('or', xor);

    const expr = or();
    const rest = peek();
    if (rest.t !== 'end') fail('unexpected', describe(rest), rest.start, rest.end);
    return { ok: true, expr };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, error: e.detail };
    throw e;
  }
}

type Cell = string | number | null | undefined;

function value(row: object, o: Operand): Cell {
  return o.type === 'column' ? ((row as Record<string, unknown>)[o.key] as Cell) : o.value;
}

function compareCells(e: Extract<Expr, { type: 'compare' }>, row: object): boolean {
  const a = value(row, e.left);
  const b = value(row, e.right);
  if (e.op === 'contains') return String(a ?? '').toLowerCase().includes(String(b ?? '').toLowerCase());

  const numeric = [e.left, e.right].every((o) => (o.type === 'column' ? o.kind === 'number' : isNumber(o.value)));
  if (numeric) {
    if (a === null || a === undefined || b === null || b === undefined) return e.op === '!=' ? a !== b : false;
    const x = Number(a);
    const y = Number(b);
    switch (e.op) {
      case '=': return x === y;
      case '!=': return x !== y;
      case '>': return x > y;
      case '>=': return x >= y;
      case '<': return x < y;
      case '<=': return x <= y;
    }
  }
  // Text (dates, clock times, sessions, names): case-insensitive, and ISO dates order correctly as text.
  const x = String(a ?? '').toLowerCase();
  const y = String(b ?? '').toLowerCase();
  switch (e.op) {
    case '=': return x === y;
    case '!=': return x !== y;
    case '>': return x > y;
    case '>=': return x >= y;
    case '<': return x < y;
    case '<=': return x <= y;
  }
}

export function evaluate(expr: Expr, row: object): boolean {
  switch (expr.type) {
    case 'not': return !evaluate(expr.operand, row);
    case 'compare': return compareCells(expr, row);
    case 'logic': {
      const l = evaluate(expr.left, row);
      if (expr.op === 'and') return l && evaluate(expr.right, row);
      if (expr.op === 'or') return l || evaluate(expr.right, row);
      return l !== evaluate(expr.right, row);
    }
  }
}

const PRECEDENCE: Record<LogicOp, number> = { or: 1, xor: 2, and: 3 };

function operandSql(o: Operand): string {
  if (o.type === 'column') return o.key;
  return !o.quoted && isNumber(o.value) ? o.value : `'${o.value.replaceAll("'", "''")}'`;
}

/** A tidy, read-only SQL rendering: parenthesised only where precedence needs it. */
export function expressionSql(expr: Expr, parent = 0): string {
  switch (expr.type) {
    case 'compare': {
      if (expr.op === 'contains') return `${operandSql(expr.left)} ILIKE '%' || ${operandSql(expr.right)} || '%'`;
      return `${operandSql(expr.left)} ${expr.op === '!=' ? '<>' : expr.op} ${operandSql(expr.right)}`;
    }
    case 'not': return `NOT ${expr.operand.type === 'compare' ? expressionSql(expr.operand, 4) : `(${expressionSql(expr.operand)})`}`;
    case 'logic': {
      const p = PRECEDENCE[expr.op];
      const s = `${expressionSql(expr.left, p)} ${expr.op.toUpperCase()} ${expressionSql(expr.right, p + 1)}`;
      return p < parent ? `(${s})` : s;
    }
  }
}
