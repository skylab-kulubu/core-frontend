import { ProblemError } from '@/lib/api/core';
import type {
  ManagementRole,
  ManagementTerm,
  ManagementTermStatus,
} from '@/lib/api/management-memberships';
import type { CapabilitiesState } from '@/lib/capabilities-context';
import { coreProblemMessage } from '@/lib/core-problems';
import type { StatusChipKind } from '@/lib/status-chip';
import { daysLeft, formatDay, todayInTurkey } from '@/lib/subject-requests';

export const ROLE_LABELS: Record<ManagementRole, string> = {
  board: 'YK',
  audit: 'DK',
  privileged: 'Yönetim',
  'team-leaders': 'Ekip lideri',
};

export const STATUS_LABELS: Record<ManagementTermStatus, string> = {
  active: 'Sürüyor',
  expiring: 'Bitiyor',
  expired: 'Süresi dolmuş',
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as ManagementRole] ?? role;
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as ManagementTermStatus] ?? status;
}

export function statusKind(status: ManagementTermStatus): StatusChipKind {
  if (status === 'expired') return 'cancelled';
  if (status === 'expiring') return 'pending';
  return 'active';
}

/** The holder's name; core sends none for someone erased or being erased. */
export function holderName(term: Pick<ManagementTerm, 'firstName' | 'lastName'>): string {
  return `${term.firstName} ${term.lastName}`.trim() || 'Silinmiş hesap';
}

/** An instant as its day in Istanbul, YYYY-MM-DD (core's ends are the end of an Istanbul day). */
export function istanbulDay(at: string): string {
  return todayInTurkey(new Date(at));
}

/** The end as the panel shows it: 30.06.2027, or "Tarihsiz". */
export function endLabel(endsAt: string | null): string {
  return endsAt ? formatDay(istanbulDay(endsAt)) : 'Tarihsiz';
}

/** Days from today to the end's day: 0 is the last day, below 0 is past; null when undated. */
export function termDaysLeft(endsAt: string | null, today: string): number | null {
  return endsAt ? daysLeft(istanbulDay(endsAt), today) : null;
}

export function daysLeftLabel(left: number | null): string {
  if (left === null) return '';
  if (left < 0) return `${-left} gün geçti`;
  if (left === 0) return 'Bugün';
  return `${left} gün`;
}

const STATUS_ORDER: Record<ManagementTermStatus, number> = { expired: 0, expiring: 1, active: 2 };

/** Expired first, then expiring, then the rest; each by end (undated last), then path. */
export function sortTerms(terms: readonly ManagementTerm[]): ManagementTerm[] {
  return [...terms].sort((a, b) => {
    const byStatus = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
    if (byStatus) return byStatus;
    if (a.endsAt !== b.endsAt) {
      if (!a.endsAt) return 1;
      if (!b.endsAt) return -1;
      return Date.parse(a.endsAt) - Date.parse(b.endsAt);
    }
    return a.groupPath.localeCompare(b.groupPath, 'tr');
  });
}

/** The first day core takes as a new end: tomorrow in Istanbul (the end must be after now). */
export function earliestNewEnd(today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Turkish sentences for the term routes' codes (core docs/management-membership-terms.md). */
const TERM_CODE_MESSAGES: Record<string, string> = {
  self_extension: 'Kendi görevini uzatamaz, kendine devredemezsin.',
  term_not_expired: 'Süresi dolmamış görev buradan çıkarılmaz; grubun üye listesinden çıkar.',
  term_too_long:
    'Bitiş çok ileri: en geç bir sonraki sezonun sonu, sezon tanımlı değilse bugünden bir yıl sonrası.',
  audit_unavailable: 'Denetim kaydı yazılamadı; değişiklik yapılmadı. Biraz sonra tekrar dene.',
};

/**
 * A failed term route in Turkish: its own codes first, then the panel's
 * problem text. `400` is an end that is not after today; `404` a term that
 * ended meanwhile (or the terms turned off).
 */
export function termProblemMessage(error: unknown, fallback: string): string {
  if (error instanceof ProblemError && error.code && TERM_CODE_MESSAGES[error.code]) {
    return TERM_CODE_MESSAGES[error.code];
  }
  return coreProblemMessage(error, fallback, {
    400: 'Bitiş bugünden sonraki bir gün olmalı.',
    404: 'Görev bulunamadı: bitmiş ya da kaldırılmış olabilir. Listeyi yenile.',
  });
}

/** Whether the list answered 404: core serves the terms only in apply mode. */
export function termsOff(error: unknown): boolean {
  return error instanceof ProblemError && error.status === 404;
}

/**
 * Whether the Dönem devri menu shows: core lists every term to a reader of
 * Groups (`group.read`: Privileged, DK) and to anyone else the terms of the
 * Groups they may change, which only a Leader of a Team (core's
 * `managedTeams`) can. Hidden until core answers, and when it cannot be read.
 */
export function showsManagementTerms(state: CapabilitiesState): boolean {
  if (state.status !== 'ready') return false;
  return state.data.can?.['group.read'] === true || (state.data.managedTeams?.length ?? 0) > 0;
}

/**
 * Whether the page offers Uzat, Devret and Çıkar. A reader of Groups lists
 * every term, so only `group.write` lets them change one (DK reads only);
 * anyone else is listed only the terms they may change. core decides each
 * request, so an unreadable answer shows the buttons.
 */
export function termWritesAllowed(state: CapabilitiesState): boolean {
  if (state.status === 'failed') return true;
  if (state.status !== 'ready') return false;
  const can = state.data.can ?? {};
  return can['group.read'] !== true || can['group.write'] === true;
}

/**
 * The empty list's line. A reader of Groups is listed every term, so none
 * means none at all; anyone else is listed only the terms they may change,
 * and a top Team's Leaders cannot change their own Leader group (only the
 * Team above can).
 */
export function emptyTermsText(state: CapabilitiesState): string {
  return state.status === 'ready' && state.data.can?.['group.read'] === true
    ? 'Süreli yönetim üyeliği yok.'
    : 'Değiştirebileceğin süreli üyelik yok.';
}
