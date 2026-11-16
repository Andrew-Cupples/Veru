import type { ReactNode } from 'react';
import type { LedgerMessages } from './en';

const n = (value: number) => value.toLocaleString('fr');
// French uses the singular for 0 and 1.
const s = (count: number, one: string, other: string) => (Math.abs(count) < 2 ? one : other);
const nb = ' ';

export const fr: LedgerMessages = {
  toolbar: {
    toggleOutline: 'Afficher ou masquer le sommaire',
    toggleAnnotations: 'Afficher ou masquer les annotations',
    reviewedTitle: (reviewed: number, total: number) => `${n(reviewed)} prompts sur ${n(total)} relus par une personne`,
    reviewedLabel: 'Relus',
    reviewed: (reviewed: ReactNode, total: number) => (
      <>
        {reviewed} / {n(total)} relus
      </>
    ),
    saveFailed: 'Échec de l’enregistrement',
    sync: 'Synchroniser les transcriptions',
    syncing: 'Synchronisation…',
    syncingStatus: 'Synchronisation des transcriptions',
    syncFailed: 'Échec de la synchronisation',
    syncFailedStatus: (error: string) => `Échec de la synchronisation${nb}: ${error}`,
    syncTitle: 'Importer les nouveaux prompts et réponses des transcriptions Claude Code',
    upToDate: 'À jour',
    synced: (added: number, updated: number) =>
      `Synchronisé${nb}: ${n(added)} ${s(added, 'nouveau', 'nouveaux')}, ${n(updated)} ${s(updated, 'mis à jour', 'mis à jour')}`,
    scheme: { system: 'Thème du système', light: 'Thème clair', dark: 'Thème sombre' },
    schemeChange: (label: string) => `${label} (cliquer pour changer)`,
    export: 'Exporter',
    exporting: 'Exportation…',
    exported: 'Exporté',
    exportFailed: 'Échec de l’exportation',
    exportTitle: 'Écrit PROMPT_LOG.md et l’instantané versionné à partir du registre. Lecture seule : vos annotations ne changent pas.',
    exportingStatus: 'Exportation de PROMPT_LOG.md et de l’instantané',
    exportedStatus: 'PROMPT_LOG.md et l’instantané sont à jour',
  },

  status: {
    loading: 'Chargement des prompts',
    errorTitle: 'Impossible de charger le journal',
    errorHelp: (command: ReactNode) => <>L’API est-elle lancée{nb}? Lancez-la avec {command}</>,
    tryAgain: 'Réessayer',
    emptyTitle: 'Pas encore de prompts',
    empty: 'Les prompts apparaissent ici à mesure que vous les envoyez à Claude Code dans ce dépôt.',
    backfill: (sync: ReactNode) => <>Pour récupérer ceux des transcriptions existantes, utilisez {sync} dans la barre d’outils.</>,
  },

  document: {
    region: 'Document des prompts',
    session: (date: string) => `Session · ${date}`,
    summary: (prompts: number, reviewed: number) => `${n(prompts)} ${s(prompts, 'prompt', 'prompts')} · ${n(reviewed)} ${s(reviewed, 'relu', 'relus')}`,
    prompt: (number: number) => `Prompt ${number}`,
    starred: 'Favori',
    empty: '(prompt vide)',
    reviewed: 'Relu',
    notReviewed: 'Non relu',
    notInLog: 'Hors journal',
    you: 'Vous',
    noReply: 'Aucune réponse enregistrée pour l’instant. Elle est ajoutée à la fin du tour ou à la prochaine synchronisation.',
    collapse: 'Réduire la réponse',
    expand: (words: number) => `Afficher toute la réponse · ${n(words)} ${s(words, 'mot', 'mots')}`,
  },

  outline: {
    label: 'Sommaire des prompts',
    filter: 'Filtrer…  #étiquette  mots',
    filterLabel: 'Filtrer les prompts par texte ou #étiquette',
    noMatch: (query: string) => `Aucun prompt ne correspond à «${nb}${query}${nb}».`,
    reviewed: 'relu',
    notReviewed: 'non relu',
    starred: 'favori',
    excluded: 'exclu du journal',
  },

  annotations: {
    label: 'Annotations',
    position: (current: ReactNode, total: number) => (
      <>
        Prompt {current} sur {n(total)}
      </>
    ),
    previous: 'Prompt précédent',
    previousTitle: 'Précédent (k)',
    next: 'Prompt suivant',
    nextTitle: 'Suivant (j)',
    held: 'Maintenu sur ce prompt pendant la modification',
    follow: 'Suivre le défilement',
    humanReviewed: 'Relu par une personne',
    starred: 'Favori',
    includeInLog: 'Inclure dans PROMPT_LOG.md',
    outcome: 'Résultat',
    outcomes: {
      Unset: 'Pas encore décidé',
      Kept: `Gardé${nb}: utilisé tel quel`,
      Changed: `Modifié${nb}: utilisé avec des retouches`,
      Rejected: `Rejeté${nb}: non utilisé`,
      Mixed: `Mixte${nb}: en partie gardé, en partie rejeté`,
    },
    outcomeChips: { Unset: 'Non décidé', Kept: 'Gardé', Changed: 'Modifié', Rejected: 'Rejeté', Mixed: 'Mixte' },
    why: 'Pourquoi je l’ai envoyé',
    whyPlaceholder: `Que cherchiez-vous à apprendre ou à obtenir${nb}?`,
    kept: 'Ce que j’ai gardé, modifié ou rejeté',
    keptPlaceholder: '…et pourquoi',
    tags: 'Étiquettes',
    comments: 'Commentaires',
    commentsHint: 'les #hashtags deviennent des étiquettes',
    commentsPlaceholder: 'Vos notes sur ce prompt et la réponse…',
    unsaved: 'Modifications non enregistrées',
    saving: 'Enregistrement…',
    saved: 'Toutes les modifications sont enregistrées',
    reviewedNext: 'relu et suivant',
  },

  tags: {
    add: 'Ajouter des étiquettes…',
    remove: (tag: string) => `Retirer l’étiquette ${tag}`,
  },
};
