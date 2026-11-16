import type { ReactNode } from 'react';
import type { LedgerMessages } from './en';

const n = (value: number) => value.toLocaleString('es');
const s = (count: number, one: string, other: string) => (count === 1 ? one : other);

export const es: LedgerMessages = {
  toolbar: {
    toggleOutline: 'Mostrar u ocultar el índice',
    toggleAnnotations: 'Mostrar u ocultar las anotaciones',
    reviewedTitle: (reviewed: number, total: number) => `${n(reviewed)} de ${n(total)} prompts revisados por una persona`,
    reviewedLabel: 'Revisados',
    reviewed: (reviewed: ReactNode, total: number) => (
      <>
        {reviewed} / {n(total)} revisados
      </>
    ),
    saveFailed: 'Error al guardar',
    sync: 'Sincronizar transcripciones',
    syncing: 'Sincronizando…',
    syncingStatus: 'Sincronizando transcripciones',
    syncFailed: 'Error al sincronizar',
    syncFailedStatus: (error: string) => `Error al sincronizar: ${error}`,
    syncTitle: 'Importar prompts y respuestas nuevos de las transcripciones de Claude Code',
    upToDate: 'Al día',
    synced: (added: number, updated: number) => `Sincronizado: ${n(added)} ${s(added, 'nuevo', 'nuevos')}, ${n(updated)} ${s(updated, 'actualizado', 'actualizados')}`,
    scheme: { system: 'Tema del sistema', light: 'Tema claro', dark: 'Tema oscuro' },
    schemeChange: (label: string) => `${label} (clic para cambiar)`,
    export: 'Exportar',
    exporting: 'Exportando…',
    exported: 'Exportado',
    exportFailed: 'Error al exportar',
    exportTitle: 'Escribe PROMPT_LOG.md y la instantánea versionada a partir del registro. Solo lectura: tus anotaciones no cambian.',
    exportingStatus: 'Exportando PROMPT_LOG.md y la instantánea',
    exportedStatus: 'PROMPT_LOG.md y la instantánea están al día',
  },

  status: {
    loading: 'Cargando prompts',
    errorTitle: 'No se pudo cargar el registro',
    errorHelp: (command: ReactNode) => <>¿Está en marcha la API? Iníciala con {command}</>,
    tryAgain: 'Reintentar',
    emptyTitle: 'Aún no hay prompts',
    empty: 'Los prompts aparecen aquí a medida que los envías a Claude Code en este repositorio.',
    backfill: (sync: ReactNode) => <>Para recuperar los de transcripciones existentes, usa {sync} en la barra de herramientas.</>,
  },

  document: {
    region: 'Documento de prompts',
    session: (date: string) => `Sesión · ${date}`,
    summary: (prompts: number, reviewed: number) => `${n(prompts)} ${s(prompts, 'prompt', 'prompts')} · ${n(reviewed)} ${s(reviewed, 'revisado', 'revisados')}`,
    prompt: (number: number) => `Prompt ${number}`,
    starred: 'Destacado',
    empty: '(prompt vacío)',
    reviewed: 'Revisado',
    notReviewed: 'Sin revisar',
    notInLog: 'Fuera del registro',
    you: 'Tú',
    noReply: 'Aún no hay respuesta registrada. Se añade cuando termina el turno o en la próxima sincronización.',
    collapse: 'Contraer respuesta',
    expand: (words: number) => `Ver la respuesta completa · ${n(words)} ${s(words, 'palabra', 'palabras')}`,
  },

  outline: {
    label: 'Índice de prompts',
    filter: 'Filtrar…  #etiqueta  palabras',
    filterLabel: 'Filtrar prompts por texto o #etiqueta',
    noMatch: (query: string) => `Ningún prompt coincide con «${query}».`,
    reviewed: 'revisado',
    notReviewed: 'sin revisar',
    starred: 'destacado',
    excluded: 'excluido del registro',
  },

  annotations: {
    label: 'Anotaciones',
    position: (current: ReactNode, total: number) => (
      <>
        Prompt {current} de {n(total)}
      </>
    ),
    previous: 'Prompt anterior',
    previousTitle: 'Anterior (k)',
    next: 'Prompt siguiente',
    nextTitle: 'Siguiente (j)',
    held: 'Fijado en este prompt mientras editas',
    follow: 'Seguir el desplazamiento',
    humanReviewed: 'Revisado por una persona',
    starred: 'Destacado',
    includeInLog: 'Incluir en PROMPT_LOG.md',
    outcome: 'Resultado',
    outcomes: {
      Unset: 'Sin decidir',
      Kept: 'Conservado: usado tal cual',
      Changed: 'Cambiado: usado con cambios',
      Rejected: 'Rechazado: no usado',
      Mixed: 'Mixto: parte conservada, parte rechazada',
    },
    outcomeChips: { Unset: 'Sin decidir', Kept: 'Conservado', Changed: 'Cambiado', Rejected: 'Rechazado', Mixed: 'Mixto' },
    why: 'Por qué lo envié',
    whyPlaceholder: '¿Qué querías aprender o conseguir?',
    kept: 'Qué conservé, cambié o rechacé',
    keptPlaceholder: '…y por qué',
    tags: 'Etiquetas',
    comments: 'Comentarios',
    commentsHint: 'los #hashtags se convierten en etiquetas',
    commentsPlaceholder: 'Tus notas sobre este prompt y la respuesta…',
    unsaved: 'Cambios sin guardar',
    saving: 'Guardando…',
    saved: 'Todos los cambios guardados',
    reviewedNext: 'revisado y siguiente',
  },

  tags: {
    add: 'Añadir etiquetas…',
    remove: (tag: string) => `Quitar la etiqueta ${tag}`,
  },
};
