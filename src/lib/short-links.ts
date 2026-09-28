import { ProblemError } from '@/lib/api/core';
import type { AliasAvailability, ShortUrl } from '@/lib/api/urls';

/** Who manages a short link: its event, its form, or the person who made it. */
export type ShortUrlSource = 'personal' | 'form' | 'event';

/** The list filter: every link, or one source (core's `?source=`). */
export type SourceFilter = 'all' | ShortUrlSource;

type Binding = Pick<ShortUrl, 'formId' | 'eventId'>;

/** A link's source as core derives it: an event wins over a form. */
export function shortUrlSource(row: Binding): ShortUrlSource {
  if (row.eventId) return 'event';
  if (row.formId) return 'form';
  return 'personal';
}

const SOURCE_LABELS: Record<ShortUrlSource, string> = {
  personal: 'Kişisel',
  form: 'Form',
  event: 'Etkinlik',
};

export function sourceLabel(source: ShortUrlSource): string {
  return SOURCE_LABELS[source];
}

export const SOURCE_FILTERS: ReadonlyArray<{ value: SourceFilter; label: string }> = [
  { value: 'all', label: 'Tümü' },
  { value: 'personal', label: SOURCE_LABELS.personal },
  { value: 'form', label: SOURCE_LABELS.form },
  { value: 'event', label: SOURCE_LABELS.event },
];

/** The list query for a filter; Tümü asks for every link as before. */
export function sourceQuery(filter: SourceFilter): string {
  return filter === 'all' ? '' : `?source=${filter}`;
}

const MANAGED_NOTES: Record<Exclude<ShortUrlSource, 'personal'>, string> = {
  form: 'Forms’ta yönetiliyor',
  event: 'Etkinlikte yönetiliyor',
};

/** Where a bound link is renamed and retargeted; null for a personal link. */
export function managedNote(row: Binding): string | null {
  const source = shortUrlSource(row);
  return source === 'personal' ? null : MANAGED_NOTES[source];
}

/** Whether core refused a change because a form or an event owns the link. */
export function isManagedRefusal(error: unknown): boolean {
  return error instanceof ProblemError && error.status === 409 && error.code === 'managed';
}

/**
 * The message for a managed refusal. A stale list may still show the link as
 * personal, so that case names both owners.
 */
export function managedRefusalMessage(row: Binding): string {
  return managedNote(row) ?? 'Forms’ta ya da etkinlikte yönetiliyor';
}

/** What a moderator confirms before disabling a bound link; null for a personal link. */
export function disableConfirmText(row: Binding): string | null {
  switch (shortUrlSource(row)) {
    case 'form':
      return 'Bu link bir forma bağlı. Silersen form linksiz kalır. Silinsin mi?';
    case 'event':
      return 'Bu link bir etkinliğe bağlı. Silersen etkinlik linksiz kalır. Silinsin mi?';
    default:
      return null;
  }
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

const TAKEN = 'Bu ad kullanılıyor (eski adlar da dolu sayılır)';

/**
 * The one-line hint for an availability answer. While editing, `taken` only
 * warns: core reports the link's own old aliases as taken, yet lets the link
 * take one back, so the save decides.
 */
export function aliasHint(result: AliasAvailability, mode: 'create' | 'edit'): AliasHint | null {
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
      return mode === 'edit'
        ? { tone: 'warning', text: TAKEN, blocks: false }
        : { tone: 'error', text: TAKEN, blocks: true };
    default:
      return null;
  }
}
