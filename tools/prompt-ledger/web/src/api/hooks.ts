import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap, type PromptDetail, type UpdatePromptRequest } from './client';
import { useLedgerClient } from './LedgerApiContext';

/** All query keys live under one root so a host app's shared QueryClient never collides with them. */
export const ledgerKeys = {
  all: ['prompt-ledger'] as const,
  document: () => [...ledgerKeys.all, 'document'] as const,
  tags: () => [...ledgerKeys.all, 'tags'] as const,
};

export function useDocument() {
  const client = useLedgerClient();
  return useQuery({
    queryKey: ledgerKeys.document(),
    queryFn: async ({ signal }) => unwrap(await client.GET('/api/prompts/document', { signal })),
  });
}

export function useTags() {
  const client = useLedgerClient();
  return useQuery({
    queryKey: ledgerKeys.tags(),
    queryFn: async ({ signal }) => unwrap(await client.GET('/api/tags', { signal })),
    staleTime: 30_000,
  });
}

function replacePrompt(list: PromptDetail[] | undefined, updated: PromptDetail): PromptDetail[] | undefined {
  return list?.map((p) => (p.id === updated.id ? updated : p));
}

/**
 * Patches a prompt's annotations. The document cache is updated optimistically so toggles feel instant,
 * then replaced with the server's copy (which includes any tags parsed from the comment).
 */
export function useUpdatePrompt() {
  const client = useLedgerClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: UpdatePromptRequest }) =>
      unwrap(await client.PATCH('/api/prompts/{id}', { params: { path: { id } }, body: patch })),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ledgerKeys.document() });
      const previous = queryClient.getQueryData<PromptDetail[]>(ledgerKeys.document());
      queryClient.setQueryData<PromptDetail[]>(ledgerKeys.document(), (list) =>
        list?.map((p) => (p.id === id ? applyPatch(p, patch) : p)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(ledgerKeys.document(), context.previous);
    },
    onSuccess: (updated, { patch }) => {
      queryClient.setQueryData<PromptDetail[]>(ledgerKeys.document(), (list) => replacePrompt(list, updated));
      if (patch.comment != null) void queryClient.invalidateQueries({ queryKey: ledgerKeys.tags() });
    },
  });
}

export function useSetTags() {
  const client = useLedgerClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, tags }: { id: number; tags: string[] }) =>
      unwrap(await client.PUT('/api/prompts/{id}/tags', { params: { path: { id } }, body: { tags } })),
    onMutate: async ({ id, tags }) => {
      await queryClient.cancelQueries({ queryKey: ledgerKeys.document() });
      const previous = queryClient.getQueryData<PromptDetail[]>(ledgerKeys.document());
      queryClient.setQueryData<PromptDetail[]>(ledgerKeys.document(), (list) =>
        list?.map((p) => (p.id === id ? { ...p, tags } : p)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(ledgerKeys.document(), context.previous);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<PromptDetail[]>(ledgerKeys.document(), (list) => replacePrompt(list, updated));
      void queryClient.invalidateQueries({ queryKey: ledgerKeys.tags() });
    },
  });
}

export function useSync() {
  const client = useLedgerClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await client.POST('/api/sync')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ledgerKeys.all }),
  });
}

/** Writes PROMPT_LOG.md and the committed snapshot. Reads the ledger only, so nothing to refetch. */
export function useExport() {
  const client = useLedgerClient();
  return useMutation({
    mutationFn: async () => unwrap(await client.POST('/api/export')),
  });
}

export function applyPatch(p: PromptDetail, patch: UpdatePromptRequest): PromptDetail {
  const text = (v: string | null | undefined, current: string | null) =>
    v == null ? current : v.trim() === '' ? null : v;
  return {
    ...p,
    humanReviewed: patch.humanReviewed ?? p.humanReviewed,
    starred: patch.starred ?? p.starred,
    includeInLog: patch.includeInLog ?? p.includeInLog,
    outcome: patch.outcome ?? p.outcome,
    comment: text(patch.comment, p.comment),
    rationale: text(patch.rationale, p.rationale),
    outcomeNotes: text(patch.outcomeNotes, p.outcomeNotes),
  };
}
