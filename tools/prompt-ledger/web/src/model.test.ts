import { describe, expect, it } from 'vitest';
import type { PromptDetail } from './api/client';
import { applyPatch } from './api/hooks';
import { groupBySession, headline, matchesFilter, normalizeTag, parseFilter } from './model';

const prompt = (over: Partial<PromptDetail>): PromptDetail => ({
  id: 1, sessionId: 's1', sessionTitle: null, sequence: 1, text: 'Build the schema', submittedAt: '2026-11-14T12:00:00Z',
  source: 'Hook', transcriptUuid: null, model: null, responseText: null, humanReviewed: false, reviewedAt: null,
  comment: null, rationale: null, outcome: 'Unset', outcomeNotes: null, starred: false, includeInLog: true, tags: [],
  createdAt: '2026-11-14T12:00:00Z', updatedAt: '2026-11-14T12:00:00Z', ...over,
});

describe('model', () => {
  it('groups consecutive prompts by session, with a fallback title', () => {
    const groups = groupBySession([
      prompt({ id: 1, sessionId: 'abcdef123456', sessionTitle: '  ' }),
      prompt({ id: 2, sessionId: 'abcdef123456' }),
      prompt({ id: 3, sessionId: 'other', sessionTitle: 'Second' }),
    ]);
    expect(groups.map((g) => [g.title, g.prompts.length])).toEqual([['Session abcdef12', 2], ['Second', 1]]);
  });

  it('builds headlines from the first non-empty line', () => {
    expect(headline('\n\n  First line  \nsecond')).toBe('First line');
    expect(headline('x'.repeat(100), 10)).toBe('xxxxxxxxx…');
  });

  it('normalizes tags like the server', () => {
    expect(normalizeTag('#Bug-Fix-')).toBe('bug-fix');
    expect(normalizeTag('9lives')).toBeNull();
    expect(normalizeTag('two words')).toBeNull();
  });

  it('filters by words across annotations and by #tags', () => {
    const p = prompt({ text: 'Design the DB', comment: 'flaky tests', tags: ['db', 'backend'] });
    expect(matchesFilter(p, parseFilter('flaky'))).toBe(true);
    expect(matchesFilter(p, parseFilter('#DB design'))).toBe(true);
    expect(matchesFilter(p, parseFilter('#ui'))).toBe(false);
  });

  it('applies optimistic patches: null leaves a field, empty string clears it', () => {
    const p = prompt({ comment: 'old', rationale: 'why' });
    const next = applyPatch(p, { comment: '', humanReviewed: true });
    expect(next).toMatchObject({ comment: null, rationale: 'why', humanReviewed: true });
  });
});
