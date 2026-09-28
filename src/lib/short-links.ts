import { ProblemError } from '@/lib/api/core';
import type { AliasAvailability, LinkKind, LinkKindFilter, ShortUrl } from '@/lib/api/urls';

type KindFields = Pick<ShortUrl, 'formId' | 'eventId'>;

/**
 * Who manages a Short link: a Form link an Event names is event-managed (the
 * Event decides its alias), any other Form link is form-managed, and the rest
 * are personal.
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
  /** What a URL moderator confirms before deleting a managed link; null for a personal link. */
  deleteConfirm: string | null;
};

const LINK_KINDS: Record<LinkKind, LinkKindCopy> = {
  personal: { label: 'Kişisel', note: null, deleteConfirm: null },
  form: {
    label: 'Form',
    note: 'Forms’ta yönetiliyor',
    deleteConfirm:
      'Bu link bir formun linki; silersen form linksiz kalır. Silmek istediğine emin misin?',
  },
  event: {
    label: 'Etkinlik',
    note: 'Etkinlikte yönetiliyor',
    deleteConfirm:
      'Bu link bir etkinliğin form linki; silersen etkinlik linksiz kalır. Silmek istediğine emin misin?',
  },
};

export function linkKindLabel(kind: LinkKind): string {
  return LINK_KINDS[kind].label;
}

/** The list filter: every link, or one kind. */
export const LINK_KIND_FILTERS: ReadonlyArray<{ value: LinkKindFilter; label: string }> = [
  { value: 'all', label: 'Tümü' },
  { value: 'personal', label: LINK_KINDS.personal.label },
  { value: 'form', label: LINK_KINDS.form.label },
  { value: 'event', label: LINK_KINDS.event.label },
];

/** Whether a Form or an Event manages the link, so the generic list may not rename it. */
export function isManaged(row: KindFields): boolean {
  return linkKind(row) !== 'personal';
}

export function managedNote(row: KindFields): string | null {
  return LINK_KINDS[linkKind(row)].note;
}

export function deleteConfirmText(row: KindFields): string | null {
  return LINK_KINDS[linkKind(row)].deleteConfirm;
}

/** Whether core refused a change because a Form or an Event manages the link. */
export function isManagedRefusal(error: unknown): boolean {
  return error instanceof ProblemError && error.status === 409 && error.code === 'managed';
}

/**
 * The message for a managed refusal. A stale list may still show the link as
 * personal, so that case names both managers.
 */
export function managedRefusalMessage(row: KindFields): string {
  return managedNote(row) ?? 'Forms’ta ya da etkinlikte yönetiliyor';
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

/**
 * What the alias is for: a new link, a rename of a link, or the alias an
 * Event gives a Skyforms Form (core binds it when the Event is saved).
 */
export type AliasHintMode = 'create' | 'edit' | 'eventForm';

const TAKEN = 'Bu ad kullanılıyor (eski adlar da dolu sayılır)';
const EVENT_FORM_TAKEN =
  'Bu ad kullanılıyor. Formun kendi linki değilse etkinlik bu ada bağlanmaz; form kendi linkini korur.';

/**
 * The one-line hint for an availability answer. While editing, `taken` only
 * warns: core reports the link's own Retired aliases as taken, yet lets the
 * link take one back, so the save decides. For an Event's Form it only warns
 * too: the taken link may be the Form's own, which the Event takes over, and
 * otherwise core leaves the Form its own link without failing the save.
 */
export function aliasHint(result: AliasAvailability, mode: AliasHintMode): AliasHint | null {
  if (result.available) return { tone: 'ok', text: 'Uygun', blocks: false };
  switch (result.reason) {
    case 'invalid':
      return {
        tone: 'error',
        text: 'Geçersiz ad: harf ya da rakamla başlar; harf, rakam, - ve _; en fazla 64 karakter',
        blocks: true,
      };
    case 'reserved':
      return { tone: 'error', text: 'Bu ad ayrılmış', blocks: true };
    case 'taken':
      if (mode === 'eventForm') return { tone: 'warning', text: EVENT_FORM_TAKEN, blocks: false };
      return mode === 'edit'
        ? { tone: 'warning', text: TAKEN, blocks: false }
        : { tone: 'error', text: TAKEN, blocks: true };
    default:
      return null;
  }
}
