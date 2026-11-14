import type { PromptDetail } from './api/client';

export interface SessionGroup {
  sessionId: string;
  title: string;
  startedAt: string;
  prompts: PromptDetail[];
}

/** Groups prompts (already in reading order) into consecutive sessions. */
export function groupBySession(prompts: readonly PromptDetail[]): SessionGroup[] {
  const groups: SessionGroup[] = [];
  for (const prompt of prompts) {
    let group = groups.at(-1);
    if (!group || group.sessionId !== prompt.sessionId) {
      group = {
        sessionId: prompt.sessionId,
        title: prompt.sessionTitle?.trim() || `Session ${prompt.sessionId.slice(0, 8)}`,
        startedAt: prompt.submittedAt,
        prompts: [],
      };
      groups.push(group);
    }
    group.prompts.push(prompt);
  }
  return groups;
}

/** The first non-empty line of a prompt, trimmed to fit a heading. */
export function headline(text: string, max = 90): string {
  const first = text.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? '';
  return first.length <= max ? first : `${first.slice(0, max - 1).trimEnd()}…`;
}

/** Lowercases and strips '#', matching the server's tag normalization closely enough for display. */
export function normalizeTag(raw: string): string | null {
  const name = raw.trim().replace(/^#+/, '').trim().toLowerCase().replace(/[-_]+$/, '');
  return /^\p{L}[\p{L}\p{N}_-]{0,49}$/u.test(name) ? name : null;
}

export interface OutlineFilter {
  words: string[];
  tags: string[];
}

/** Parses the outline filter box: `#tag` tokens filter by tag, everything else is matched against text. */
export function parseFilter(input: string): OutlineFilter {
  const words: string[] = [];
  const tags: string[] = [];
  for (const token of input.trim().split(/\s+/).filter(Boolean)) {
    if (token.startsWith('#')) {
      const tag = normalizeTag(token);
      if (tag) tags.push(tag);
    } else {
      words.push(token.toLowerCase());
    }
  }
  return { words, tags };
}

export function matchesFilter(prompt: PromptDetail, filter: OutlineFilter): boolean {
  if (filter.tags.some((tag) => !prompt.tags.includes(tag))) return false;
  if (filter.words.length === 0) return true;
  const haystack = [prompt.text, prompt.comment, prompt.rationale, prompt.outcomeNotes]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
  return filter.words.every((word) => haystack.includes(word));
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

export const formatTime = (iso: string) => timeFormat.format(new Date(iso));
export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
