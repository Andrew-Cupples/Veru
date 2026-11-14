import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useDocument, useSetTags, useUpdatePrompt } from '../api/hooks';
import type { UpdatePromptRequest } from '../api/client';
import { useScrollSpy } from '../hooks/useScrollSpy';
import { groupBySession } from '../model';
import type { ColorScheme } from '../theme/theme';
import { AnnotationPanel } from './annotations/AnnotationPanel';
import { DocumentView } from './document/DocumentView';
import { Outline } from './outline/Outline';
import { EmptyState, ErrorState, LoadingState } from './StatusStates';
import { Toolbar } from './Toolbar';
import styles from './Workspace.module.css';

interface WorkspaceProps {
  scheme: ColorScheme;
  onSchemeChange: (scheme: ColorScheme) => void;
}

/** Matches the container query in Workspace.module.css. */
const NARROW_WIDTH = 1100;

const isTypingTarget =(el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

export function Workspace({ scheme, onSchemeChange }: WorkspaceProps) {
  const document = useDocument();
  const prompts = useMemo(() => document.data ?? [], [document.data]);
  const groups = useMemo(() => groupBySession(prompts), [prompts]);

  // Only a change in the set of prompts (not an annotation edit) should re-arm the scroll spy.
  const idsKey = prompts.map((p) => p.id).join(',');
  const ids = useMemo(() => (idsKey ? idsKey.split(',').map(Number) : []), [idsKey]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const { activeId, scrollToId } = useScrollSpy(scrollRef, ids);

  // While a field in the annotation panel has focus, the panel stays on that prompt even if the
  // document scrolls, so typing never lands on the wrong prompt.
  const [pinnedId, setPinnedId] = useState<number | null>(null);
  const [focusCommentFor, setFocusCommentFor] = useState<number | null>(null);
  const [showOutline, setShowOutline] = useState(true);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // In a narrow host, start with the outline tucked away so the document stays readable.
  useLayoutEffect(() => {
    if ((workspaceRef.current?.clientWidth ?? Infinity) < NARROW_WIDTH) setShowOutline(false);
  }, []);
  const [showAnnotations, setShowAnnotations] = useState(true);

  const currentId = pinnedId ?? activeId ?? ids[0] ?? null;
  const currentIndex = currentId == null ? -1 : ids.indexOf(currentId);
  const current = currentIndex >= 0 ? prompts[currentIndex] : undefined;

  const update = useUpdatePrompt();
  const setTags = useSetTags();
  const { mutate: updateMutate } = update;
  const { mutate: setTagsMutate } = setTags;

  const save = useCallback((id: number, patch: UpdatePromptRequest) => updateMutate({ id, patch }), [updateMutate]);
  const saveTags = useCallback((id: number, tags: string[]) => setTagsMutate({ id, tags }), [setTagsMutate]);

  const goTo = useCallback(
    (id: number, opts: { focusComment?: boolean } = {}) => {
      if (opts.focusComment) {
        setPinnedId(id);
        setFocusCommentFor(id);
      } else {
        setPinnedId(null);
      }
      scrollToId(id);
    },
    [scrollToId],
  );

  const step = useCallback(
    (delta: number, opts?: { focusComment?: boolean }) => {
      const next = ids[currentIndex + delta];
      if (next != null) goTo(next, opts);
    },
    [ids, currentIndex, goTo],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!current) return;

    if (isTypingTarget(e.target)) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        // Finish this prompt: mark it reviewed and continue on the next one.
        e.preventDefault();
        (e.target as HTMLElement).blur();
        if (!current.humanReviewed) save(current.id, { humanReviewed: true });
        step(1, { focusComment: true });
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setPinnedId(null);
        scrollRef.current?.focus({ preventScroll: true });
      }
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key) {
      case 'j':
        step(1);
        break;
      case 'k':
        step(-1);
        break;
      case 'r':
        save(current.id, { humanReviewed: !current.humanReviewed });
        break;
      case 's':
        save(current.id, { starred: !current.starred });
        break;
      case 'c':
        setPinnedId(current.id);
        setFocusCommentFor(current.id);
        break;
      case '/':
        setShowOutline(true);
        requestAnimationFrame(() => filterRef.current?.focus());
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  let body;
  if (document.isPending) body = <LoadingState />;
  else if (document.isError) body = <ErrorState error={document.error} onRetry={() => void document.refetch()} />;
  else if (prompts.length === 0) body = <EmptyState />;

  return (
    <div ref={workspaceRef} className={styles.workspace} onKeyDown={onKeyDown}>
      <Toolbar
        prompts={prompts}
        scheme={scheme}
        onSchemeChange={onSchemeChange}
        showOutline={showOutline}
        showAnnotations={showAnnotations}
        onToggleOutline={() => setShowOutline((v) => !v)}
        onToggleAnnotations={() => setShowAnnotations((v) => !v)}
        saveError={update.error ?? setTags.error}
      />

      <div
        className={styles.panes}
        data-outline={showOutline || undefined}
        data-annotations={showAnnotations || undefined}
      >
        {showOutline && (
          <Outline groups={groups} activeId={currentId} onSelect={(id) => goTo(id)} filterRef={filterRef} />
        )}

        <main ref={scrollRef} className={styles.documentScroll} tabIndex={0} aria-label="Prompt document">
          {body ?? <DocumentView groups={groups} selectedId={currentId} onSelect={(id) => goTo(id)} />}
        </main>

        {showAnnotations && current && (
          <AnnotationPanel
            key={current.id}
            prompt={current}
            position={currentIndex + 1}
            total={prompts.length}
            pinned={pinnedId != null && pinnedId !== activeId}
            autoFocusComment={focusCommentFor === current.id}
            onAutoFocused={() => setFocusCommentFor(null)}
            onPrev={currentIndex > 0 ? () => step(-1) : undefined}
            onNext={currentIndex < ids.length - 1 ? () => step(1) : undefined}
            onFollowScroll={() => setPinnedId(null)}
            onEditingChange={(editing) => setPinnedId(editing ? current.id : null)}
            onSave={save}
            onSaveTags={saveTags}
            saving={update.isPending || setTags.isPending}
          />
        )}
      </div>
    </div>
  );
}
