import { ProblemError } from '@/lib/api/core';
import type { EventDay } from '@/lib/api/eventDays';
import type { RaffleCriteria } from '@/lib/api/raffles';
import type { EventSession } from '@/lib/api/sessions';
import { coreProblemMessage } from '@/lib/core-problems';

export const RAFFLE_FORBIDDEN = 'Bu etkinlikte çekiliş yetkin yok';

/** The Event's raffles: under the workspace, opened from Katılımcılar. */
export function rafflesHref(eventId: string): string {
  return `/events/${encodeURIComponent(eventId)}/raffles`;
}

export function raffleHref(eventId: string, raffleId: string): string {
  return `${rafflesHref(eventId)}/${encodeURIComponent(raffleId)}`;
}

export function rafflePresentHref(eventId: string, raffleId: string): string {
  return `${raffleHref(eventId, raffleId)}/present`;
}

/** core refused the reader (403): not one who edits the Event or assigns its Tickets. */
export function isRaffleForbidden(error: unknown): boolean {
  return error instanceof ProblemError && error.status === 403;
}

/** A raffle refusal in the panel's words; core's English never reaches the reader. */
export function raffleProblemMessage(error: unknown, fallback = 'İşlem tamamlanamadı'): string {
  if (isRaffleForbidden(error)) return RAFFLE_FORBIDDEN;
  if (error instanceof ProblemError) {
    switch (error.code) {
      case 'raffle_invalid':
        return 'Çekiliş bilgileri geçersiz. Şartları, kazanan ve yedek sayısını denetle.';
      case 'raffle_too_few_candidates': {
        const eligible = Number(error.fields.eligible);
        return Number.isFinite(eligible)
          ? `Bu şartlara uyan ${eligible} kişi var; kazanan sayısı bundan büyük olamaz.`
          : 'Bu şartlara uyan kişi kazanan sayısından az.';
      }
      case 'audit_unavailable':
        return 'Denetim kaydı açılamadı, çekiliş yapılmadı. Biraz sonra tekrar dene.';
      case 'raffle_no_alternates':
        return 'Yedek kalmadı; yerine kimse çağrılamaz.';
      case 'raffle_entry_not_winner':
        return 'Bu kişi artık kazananlar arasında değil. Sayfayı yenile.';
    }
  }
  return coreProblemMessage(error, fallback);
}

const DRAWN_AT = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "27 Kas 2026 14:05". */
export function formatRaffleTime(at: string | null | undefined): string {
  if (!at) return '';
  const time = new Date(at);
  return Number.isNaN(time.getTime()) ? '' : DRAWN_AT.format(time);
}

const ISTANBUL_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const DAY_LABEL = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: 'numeric',
  month: 'long',
  weekday: 'long',
});

function dayKey(at: string | undefined): string | null {
  if (!at) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(at)) return at;
  const time = new Date(at);
  return Number.isNaN(time.getTime()) ? null : ISTANBUL_DAY.format(time);
}

function nextDate(date: string): string {
  const time = new Date(`${date}T00:00:00Z`);
  time.setUTCDate(time.getUTCDate() + 1);
  return time.toISOString().slice(0, 10);
}

/** "27 Kasım Cuma" for a 'YYYY-MM-DD'. */
export function raffleDayLabel(date: string): string {
  const time = new Date(`${date}T12:00:00+03:00`);
  return Number.isNaN(time.getTime()) ? date : DAY_LABEL.format(time);
}

/**
 * The Event's days as 'YYYY-MM-DD', in order: each day's dates, or its Sessions' start times
 * when the day has none.
 */
export function raffleEventDates(
  days: readonly Pick<EventDay, 'id' | 'startDate' | 'endDate'>[],
  sessions: readonly Pick<EventSession, 'eventDayId' | 'startTime'>[],
): string[] {
  const dates = new Set<string>();
  for (const day of days) {
    const start = dayKey(day.startDate);
    if (start) {
      // A day that runs past midnight names each calendar day it covers
      const end = dayKey(day.endDate);
      const last = end && end > start ? end : start;
      for (let at = start, guard = 0; at <= last && guard < 31; at = nextDate(at), guard += 1) {
        dates.add(at);
      }
      continue;
    }
    for (const session of sessions) {
      if (session.eventDayId !== day.id) continue;
      const key = dayKey(session.startTime);
      if (key) dates.add(key);
    }
  }
  return [...dates].sort();
}

/** The Sessions that count towards the certificate (an older core marks none: all count). */
export function countedSessions<T extends Pick<EventSession, 'cancelled' | 'certificateCounted'>>(
  sessions: readonly T[],
): T[] {
  return sessions.filter((session) => !session.cancelled && session.certificateCounted !== false);
}

const TICKET_TYPE: Record<string, string> = { REGISTERED: 'Üye', GUEST: 'Misafir' };

/** The criteria in one Turkish line, for the history and the result. */
export function raffleCriteriaLine(
  criteria: RaffleCriteria,
  sessions: readonly Pick<EventSession, 'id' | 'title'>[] = [],
): string {
  const parts: string[] = [];
  if (criteria.minCounted) parts.push(`En az ${criteria.minCounted} sayılan oturum`);
  if (criteria.sessionIds.length) {
    const titles = criteria.sessionIds.map(
      (id) => sessions.find((session) => session.id === id)?.title || 'silinmiş oturum',
    );
    const match =
      criteria.sessionIds.length > 1
        ? criteria.sessionMatch === 'any'
          ? ' (biri)'
          : ' (hepsi)'
        : '';
    parts.push(`Oturum: ${titles.join(', ')}${match}`);
  }
  if (criteria.enteredOn === 'any') parts.push('Alana girmiş');
  else if (criteria.enteredOn) parts.push(`${raffleDayLabel(criteria.enteredOn)} alana girmiş`);
  if (criteria.ticketType)
    parts.push(`Yalnız ${TICKET_TYPE[criteria.ticketType].toLocaleLowerCase('tr-TR')}`);
  if (criteria.certificateEligible) parts.push('Sertifika eşiğini geçmiş');
  const out = [
    criteria.excludePastWinners ? 'önceki kazananlar' : '',
    criteria.excludeOrganizers ? 'düzenleyenler' : '',
    criteria.excludeDoorStaff ? 'kapı görevlileri' : '',
    criteria.excludeCoOrganizers ? 'ortak düzenleyenler' : '',
  ].filter(Boolean);
  if (out.length) parts.push(`Hariç: ${out.join(', ')}`);
  return parts.length ? parts.join(' · ') : 'Bütün etkin biletler';
}

/** "312 uygun · 3 kazanan · 2 yedek". */
export function raffleCountsLine(row: {
  eligibleCount: number;
  winnerCount: number;
  alternateCount: number;
}): string {
  return `${row.eligibleCount} uygun · ${row.winnerCount} kazanan · ${row.alternateCount} yedek`;
}

/** "Ayşe Nur Y." from "Ayşe Nur Yılmaz"; a one-word name stays as it is. */
export function shortRaffleName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return words[0] ?? '';
  const last = words[words.length - 1];
  return `${words.slice(0, -1).join(' ')} ${last.charAt(0).toLocaleUpperCase('tr-TR')}.`;
}

export function ticketTypeLabel(type: string): string {
  return TICKET_TYPE[type] ?? type;
}
