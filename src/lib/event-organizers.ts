import { ProblemError } from '@/lib/api/core';
import type { CoreEvent } from '@/lib/api/events';
import type { OrganizerManagement, OrganizerVisibility } from '@/lib/api/event-organizers';
import { coreProblemMessage } from '@/lib/core-problems';

/** core's bound: at most 10 Co-organizer teams and 10 people on an Event. */
export const ORGANIZER_LIMIT = 10;

/** Privileged roots manage or read every Event already: never a Co-organizer. */
export const PRIVILEGED_TEAMS: ReadonlySet<string> = new Set(['YK', 'DK', 'ADMIN']);

export const MANAGEMENT_LABELS: Record<OrganizerManagement, string> = {
  leaders: 'Yalnız liderler',
  members: 'Bütün üyeler',
};

export const VISIBILITY_LABELS: Record<OrganizerVisibility, string> = {
  co_organizer: 'Ortak düzenleyen',
  helper: 'Yardımcı ekip',
};

export const VISIBILITY_HINTS: Record<OrganizerVisibility, string> = {
  co_organizer: 'Sitede, bilette ve doğrulamada görünür.',
  helper: 'Yalnız panelde görünür.',
};

/** A person's rights end this long after the Event (core `CoOrganizerPersonGrace`). */
const PERSON_GRACE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When a Co-organizer person's rights end: 30 days after the Event's end, or
 * its start plus a day without an end; null for an Event with no date.
 * core sends `expiresAt` for saved rows; this stands in for one just picked.
 */
export function personExpiry(event: Pick<CoreEvent, 'startDate' | 'endDate'>): Date | null {
  const end = event.endDate
    ? new Date(event.endDate)
    : event.startDate
      ? new Date(new Date(event.startDate).getTime() + DAY_MS)
      : null;
  if (!end || Number.isNaN(end.getTime())) return null;
  return new Date(end.getTime() + PERSON_GRACE_DAYS * DAY_MS);
}

const DAY = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeZone: 'Europe/Istanbul' });

/** "Etkinlik bitiminden 30 gün sonra düşer · 14 Oca 2027". */
export function personExpiryLine(expiresAt: string | Date | null | undefined): string {
  const base = 'Etkinlik bitiminden 30 gün sonra düşer';
  if (!expiresAt) return base;
  const at = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return Number.isNaN(at.getTime()) ? base : `${base} · ${DAY.format(at)}`;
}

const INVALID_REASONS: Record<string, string> = {
  too_many: 'En çok 10 ekip ve 10 kişi eklenir.',
  duplicate: 'Aynı ekip ya da kişi iki kez eklenemez.',
  invalid_code: 'Ekip kodu geçerli değil.',
  privileged_team: 'YK, DK ve ADMIN ortak düzenleyen olamaz.',
  unknown_team: 'Böyle bir ekip yok.',
  owner_team: 'Sahip ekip ortak düzenleyen olamaz.',
  invalid_management: '"Kim yönetir" seçimi geçerli değil.',
  invalid_visibility: '"Görünüm" seçimi geçerli değil.',
  invalid_person: 'Kişi geçerli değil.',
  inactive_person: 'Hesabı etkin olmayan kişi eklenemez.',
};

/**
 * A refused PUT /v1/events/{id}/organizers in Turkish. `400
 * event_organizers_invalid` names the row (`field`, `index`): `rowName` turns
 * it into the team's code or the person's name.
 */
export function organizersProblemMessage(
  error: unknown,
  rowName: (field: 'teams' | 'people', index: number) => string | undefined = () => undefined,
): string {
  if (error instanceof ProblemError) {
    if (error.code === 'event_organizers_invalid') {
      const reason = String(error.fields.reason ?? '');
      const text = INVALID_REASONS[reason] ?? 'Liste kabul edilmedi.';
      const field = error.fields.field;
      const index = Number(error.fields.index);
      const name =
        (field === 'teams' || field === 'people') && Number.isInteger(index)
          ? rowName(field, index)
          : undefined;
      return name ? `${name}: ${text}` : text;
    }
    if (error.code === 'co_organizers_disabled') {
      return 'Ortak düzenleyen değişikliği şu an kapalı.';
    }
    if (error.code === 'audit_unavailable') {
      return 'Değişiklik kayda yazılamadı, bu yüzden yapılmadı. Biraz sonra tekrar dene.';
    }
  }
  return coreProblemMessage(error, 'Düzenleyenler kaydedilemedi', {
    403: 'Düzenleyenleri yalnız sahip ekibin liderleri değiştirir.',
    409: 'Sahip ekip bu arada değişti; sayfayı yenileyip tekrar dene.',
  });
}

/**
 * The overview's team line: "YK · Ortak: WEBLAB · Yardımcı: ARTLAB · +1 kişi".
 * The helper teams and people only reach who may edit the Event.
 */
export function organizersLine(
  event: Pick<CoreEvent, 'ownerTeam' | 'coOrganizers' | 'coOrganizerTeams' | 'coOrganizerIds'>,
): string {
  const owner = event.ownerTeam?.trim() || '—';
  const rows = event.coOrganizers;
  const shown = rows
    ? rows.filter((row) => row.visibility === 'co_organizer').map((row) => row.code)
    : (event.coOrganizerTeams ?? []);
  const helpers = rows
    ? rows.filter((row) => row.visibility === 'helper').map((row) => row.code)
    : [];
  const people = event.coOrganizerIds?.length ?? 0;
  return [
    owner,
    shown.length ? `Ortak: ${shown.join(', ')}` : null,
    helpers.length ? `Yardımcı: ${helpers.join(', ')}` : null,
    people ? `+${people} kişi` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The list row's team: "YK + 2 ekip"; the Owner team alone without Co-organizer teams. */
export function organizerTeamsChip(
  event: Pick<CoreEvent, 'ownerTeam' | 'coOrganizers' | 'coOrganizerTeams'>,
): string {
  const owner = event.ownerTeam?.trim() || 'Genel';
  const count = (event.coOrganizers ?? event.coOrganizerTeams ?? []).length;
  return count ? `${owner} + ${count} ekip` : owner;
}

/** The reader manages the Event as a Co-organizer (a team or a person), not its Owner team. */
export function isCoOrganizerView(event: Pick<CoreEvent, 'viewer'>): boolean {
  return event.viewer?.via === 'coTeam' || event.viewer?.via === 'coPerson';
}
