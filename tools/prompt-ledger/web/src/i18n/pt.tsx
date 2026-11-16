import type { ReactNode } from 'react';
import type { LedgerMessages } from './en';

const n = (value: number) => value.toLocaleString('pt-BR');
const s = (count: number, one: string, other: string) => (count === 1 ? one : other);

export const pt: LedgerMessages = {
  toolbar: {
    toggleOutline: 'Mostrar ou ocultar o sumário',
    toggleAnnotations: 'Mostrar ou ocultar as anotações',
    reviewedTitle: (reviewed: number, total: number) => `${n(reviewed)} de ${n(total)} prompts revisados por uma pessoa`,
    reviewedLabel: 'Revisados',
    reviewed: (reviewed: ReactNode, total: number) => (
      <>
        {reviewed} / {n(total)} revisados
      </>
    ),
    saveFailed: 'Falha ao salvar',
    sync: 'Sincronizar transcrições',
    syncing: 'Sincronizando…',
    syncingStatus: 'Sincronizando transcrições',
    syncFailed: 'Falha na sincronização',
    syncFailedStatus: (error: string) => `Falha na sincronização: ${error}`,
    syncTitle: 'Importar novos prompts e respostas das transcrições do Claude Code',
    upToDate: 'Atualizado',
    synced: (added: number, updated: number) =>
      `Sincronizado: ${n(added)} ${s(added, 'novo', 'novos')}, ${n(updated)} ${s(updated, 'atualizado', 'atualizados')}`,
    scheme: { system: 'Tema do sistema', light: 'Tema claro', dark: 'Tema escuro' },
    schemeChange: (label: string) => `${label} (clique para mudar)`,
  },

  status: {
    loading: 'Carregando prompts',
    errorTitle: 'Não foi possível carregar o registro',
    errorHelp: (command: ReactNode) => <>A API está rodando? Inicie-a com {command}</>,
    tryAgain: 'Tentar de novo',
    emptyTitle: 'Ainda não há prompts',
    empty: 'Os prompts aparecem aqui conforme você os envia ao Claude Code neste repositório.',
    backfill: (sync: ReactNode) => <>Para recuperar os das transcrições existentes, use {sync} na barra de ferramentas.</>,
  },

  document: {
    region: 'Documento de prompts',
    session: (date: string) => `Sessão · ${date}`,
    summary: (prompts: number, reviewed: number) => `${n(prompts)} ${s(prompts, 'prompt', 'prompts')} · ${n(reviewed)} ${s(reviewed, 'revisado', 'revisados')}`,
    prompt: (number: number) => `Prompt ${number}`,
    starred: 'Com estrela',
    empty: '(prompt vazio)',
    reviewed: 'Revisado',
    notReviewed: 'Não revisado',
    notInLog: 'Fora do registro',
    you: 'Você',
    noReply: 'Ainda não há resposta registrada. Ela é adicionada quando o turno termina, ou na próxima sincronização.',
    yourComment: 'Seu comentário',
    note: 'Nota',
    collapse: 'Recolher resposta',
    expand: (words: number) => `Ver a resposta completa · ${n(words)} ${s(words, 'palavra', 'palavras')}`,
  },

  outline: {
    label: 'Sumário de prompts',
    filter: 'Filtrar…  #etiqueta  palavras',
    filterLabel: 'Filtrar prompts por texto ou #etiqueta',
    noMatch: (query: string) => `Nenhum prompt corresponde a “${query}”.`,
    reviewed: 'revisado',
    notReviewed: 'não revisado',
    starred: 'com estrela',
    excluded: 'fora do registro',
  },

  annotations: {
    label: 'Anotações',
    position: (current: ReactNode, total: number) => (
      <>
        Prompt {current} de {n(total)}
      </>
    ),
    previous: 'Prompt anterior',
    previousTitle: 'Anterior (k)',
    next: 'Próximo prompt',
    nextTitle: 'Próximo (j)',
    held: 'Preso neste prompt enquanto você edita',
    follow: 'Acompanhar a rolagem',
    humanReviewed: 'Revisado por uma pessoa',
    starred: 'Com estrela',
    includeInLog: 'Incluir no PROMPT_LOG.md',
    outcome: 'Resultado',
    outcomes: {
      Unset: 'Ainda não decidido',
      Kept: 'Mantido: usado como está',
      Changed: 'Alterado: usado com edições',
      Rejected: 'Rejeitado: não usado',
      Mixed: 'Misto: parte mantida, parte rejeitada',
    },
    outcomeChips: { Unset: 'Não decidido', Kept: 'Mantido', Changed: 'Alterado', Rejected: 'Rejeitado', Mixed: 'Misto' },
    why: 'Por que enviei',
    whyPlaceholder: 'O que você queria aprender ou conseguir?',
    kept: 'O que mantive, alterei ou rejeitei',
    keptPlaceholder: '…e por quê',
    tags: 'Etiquetas',
    comments: 'Comentários',
    commentsHint: '#hashtags viram etiquetas',
    commentsPlaceholder: 'Suas notas sobre este prompt e a resposta…',
    unsaved: 'Alterações não salvas',
    saving: 'Salvando…',
    saved: 'Todas as alterações foram salvas',
    reviewedNext: 'revisado e próximo',
  },

  tags: {
    add: 'Adicionar etiquetas…',
    remove: (tag: string) => `Remover a etiqueta ${tag}`,
  },
};
