import type { ReactNode } from 'react';

/*
 * The Prompt Ledger's English strings: the source catalog. Other catalogs must match its shape (tsc checks).
 * The ledger's content (prompts, replies, your notes) is never translated, only its own interface.
 */

const n = (value: number) => value.toLocaleString('en');
const s = (count: number, one: string, other: string) => (count === 1 ? one : other);

export const en = {
  toolbar: {
    toggleOutline: 'Toggle outline',
    toggleAnnotations: 'Toggle annotations',
    reviewedTitle: (reviewed: number, total: number) => `${n(reviewed)} of ${n(total)} prompts human-reviewed`,
    reviewedLabel: 'Reviewed',
    reviewed: (reviewed: ReactNode, total: number) => (
      <>
        {reviewed} / {n(total)} reviewed
      </>
    ),
    saveFailed: 'Save failed',
    sync: 'Sync transcripts',
    syncing: 'Syncing…',
    syncingStatus: 'Syncing transcripts',
    syncFailed: 'Sync failed',
    syncFailedStatus: (error: string) => `Sync failed: ${error}`,
    syncTitle: 'Import new prompts and replies from Claude Code transcripts',
    upToDate: 'Up to date',
    synced: (added: number, updated: number) => `Synced: ${n(added)} new, ${n(updated)} updated`,
    scheme: { system: 'System theme', light: 'Light theme', dark: 'Dark theme' },
    schemeChange: (label: string) => `${label} (click to change)`,
    export: 'Export',
    exporting: 'Exporting…',
    exported: 'Exported',
    exportFailed: 'Export failed',
    exportTitle: 'Write PROMPT_LOG.md and the committed snapshot from the ledger. Read-only: your annotations are not changed.',
    exportingStatus: 'Exporting PROMPT_LOG.md and the snapshot',
    exportedStatus: 'PROMPT_LOG.md and the snapshot are up to date',
  },

  status: {
    loading: 'Loading prompts',
    errorTitle: 'Couldn’t load the ledger',
    errorHelp: (command: ReactNode) => <>Is the API running? Start it with {command}</>,
    tryAgain: 'Try again',
    emptyTitle: 'No prompts yet',
    empty: 'Prompts appear here as you send them to Claude Code in this repository.',
    backfill: (sync: ReactNode) => <>To backfill from existing transcripts, use {sync} in the toolbar.</>,
  },

  document: {
    region: 'Prompt document',
    session: (date: string) => `Session · ${date}`,
    summary: (prompts: number, reviewed: number) => `${n(prompts)} ${s(prompts, 'prompt', 'prompts')} · ${n(reviewed)} reviewed`,
    prompt: (number: number) => `Prompt ${number}`,
    starred: 'Starred',
    empty: '(empty prompt)',
    reviewed: 'Reviewed',
    notReviewed: 'Not reviewed',
    notInLog: 'Not in log',
    you: 'You',
    noReply: "No reply recorded yet. It's added when the turn finishes, or on the next sync.",
    collapse: 'Collapse reply',
    expand: (words: number) => `Show full reply · ${n(words)} ${s(words, 'word', 'words')}`,
  },

  outline: {
    label: 'Prompt outline',
    filter: 'Filter…  #tag  words',
    filterLabel: 'Filter prompts by text or #tag',
    noMatch: (query: string) => `No prompts match “${query}”.`,
    reviewed: 'reviewed',
    notReviewed: 'not reviewed',
    starred: 'starred',
    excluded: 'excluded from log',
  },

  annotations: {
    label: 'Annotations',
    position: (current: ReactNode, total: number) => (
      <>
        Prompt {current} of {n(total)}
      </>
    ),
    previous: 'Previous prompt',
    previousTitle: 'Previous (k)',
    next: 'Next prompt',
    nextTitle: 'Next (j)',
    held: 'Held on this prompt while you edit',
    follow: 'Follow scroll',
    humanReviewed: 'Human reviewed',
    starred: 'Starred',
    includeInLog: 'Include in PROMPT_LOG.md',
    outcome: 'Outcome',
    outcomes: {
      Unset: 'Not decided yet',
      Kept: 'Kept: used as is',
      Changed: 'Changed: used with edits',
      Rejected: 'Rejected: not used',
      Mixed: 'Mixed: kept some, rejected some',
    },
    /** Short outcome names, for the chips in the document. */
    outcomeChips: { Unset: 'Not decided', Kept: 'Kept', Changed: 'Changed', Rejected: 'Rejected', Mixed: 'Mixed' },
    why: 'Why I sent it',
    whyPlaceholder: 'What were you trying to learn or achieve?',
    kept: 'What I kept, changed or rejected',
    keptPlaceholder: '…and why',
    tags: 'Tags',
    comments: 'Comments',
    commentsHint: '#hashtags become tags',
    commentsPlaceholder: 'Your notes on this prompt and the reply…',
    unsaved: 'Unsaved changes',
    saving: 'Saving…',
    saved: 'All changes saved',
    reviewedNext: 'reviewed & next',
  },

  tags: {
    add: 'Add tags…',
    remove: (tag: string) => `Remove tag ${tag}`,
  },
};

export type LedgerMessages = typeof en;
