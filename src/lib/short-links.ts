import { ProblemError } from '@/lib/api/core';
import type { AliasAvailability, LinkKind, LinkKindFilter, ShortUrl } from '@/lib/api/urls';

type KindFields = Pick<ShortUrl, 'formId' | 'eventId'>;

/**
 * Who manages a Short link, as core's `source` names it: a Form link an Event
 * names is an event link (the Event decides its alias), any other Form link
 * is a form link, and the rest are personal.
 */
export function linkKind(row: KindFields): LinkKind {
  if (row.eventId) return 'event';
  if (row.formId) return 'form';
  return 'personal';
}

type LinkKindCopy = {
  label: string;
  /** Where a managed link is renamed and retargeted; null for a personal link. */
  note: string | null;
  /** What a URL moderator reads before deleting a managed link; null for a personal link. */
  deleteWarning: string | null;
};

const LINK_KINDS: Record<LinkKind, LinkKindCopy> = {
  personal: { label: 'Kişisel', note: null, deleteWarning: null },
  form: {
    label: 'Form',
    note: 'Forms’ta yönetiliyor',
    deleteWarning: 'Bu link bir formun linki; silersen form linksiz kalır.',
  },
  event: {
    label: 'Etkinlik',
    note: 'Etkinlikte yönetiliyor',
    deleteWarning: 'Bu link bir etkinliğin form linki; silersen etkinlik linksiz kalır.',
  },
};

export function linkKindLabel(kind: LinkKind): string {
  return LINK_KINDS[kind].label;
}

/** The "Link türü" filter: every link, or one kind. */
export const LINK_KIND_FILTERS: ReadonlyArray<{ value: LinkKindFilter; label: string }> = [
  { value: 'all', label: 'Tümü' },
  { value: 'personal', label: LINK_KINDS.personal.label },
  { value: 'form', label: LINK_KINDS.form.label },
  { value: 'event', label: LINK_KINDS.event.label },
];

/** Whether a Form or an Event manages the link, so this page may not rename or retarget it. */
export function isManaged(row: KindFields): boolean {
  return linkKind(row) !== 'personal';
}

export function managedNote(row: KindFields): string | null {
  return LINK_KINDS[linkKind(row)].note;
}

export function managedDeleteWarning(row: KindFields): string | null {
  return LINK_KINDS[linkKind(row)].deleteWarning;
}

/** Whether core refused a change because a Form or an Event manages the link. */
export function isManagedRefusal(error: unknown): boolean {
  return error instanceof ProblemError && error.status === 409 && error.code === 'managed';
}

/**
 * The sentence for a managed refusal. A stale list may still show the link as
 * personal, so that case names both places.
 */
export function managedRefusalMessage(row: KindFields): string {
  const where = managedNote(row) ?? 'Forms’ta ya da etkinlikte yönetiliyor';
  return `${where}; buradan değiştirilemez.`;
}

/**
 * Whether a typed alias is worth asking core about: not empty (core picks one
 * then), and not the link's own current alias while editing.
 */
export function shouldCheckAlias(value: string, currentAlias?: string): boolean {
  const alias = value.trim();
  if (!alias) return false;
  return currentAlias === undefined || alias.toLowerCase() !== currentAlias.toLowerCase();
}

export type AliasHint = { tone: 'ok' | 'warning' | 'error'; text: string; blocks: boolean };

const TAKEN = 'Bu ad kullanılıyor (eski adlar da dolu sayılır).';

/**
 * The one-line hint for an availability answer. While editing, `taken` only
 * warns: core counts the link's own retired aliases as taken, yet lets the
 * link take one back, so the save decides.
 */
export function aliasHint(result: AliasAvailability, mode: 'create' | 'edit'): AliasHint | null {
  if (result.available) return { tone: 'ok', text: 'Uygun', blocks: false };
  switch (result.reason) {
    case 'invalid':
      return {
        tone: 'error',
        text: 'Geçersiz ad: harf ya da rakamla başlar; harf, rakam, - ve _; en fazla 64 karakter.',
        blocks: true,
      };
    case 'reserved':
      return { tone: 'error', text: 'Bu ad ayrılmış; başka bir ad seç.', blocks: true };
    case 'taken':
      return mode === 'edit'
        ? {
            tone: 'warning',
            text: `${TAKEN} Linkin kendi eski adıysa kaydedebilirsin.`,
            blocks: false,
          }
        : { tone: 'error', text: TAKEN, blocks: true };
    default:
      return null;
  }
}
