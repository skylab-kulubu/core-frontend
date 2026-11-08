import type { CapabilitiesState } from '@/lib/capabilities-context';
import { parseDatetimeLocal, toDatetimeLocalValue } from '@/lib/date-picker';
import { toDatetimeLocal } from '@/lib/datetime-local';
import { editorReturnTo } from '@/lib/event-draft';
import {
  aliasYear,
  APPLY_SLOT_KEY,
  APPLY_SLOT_LABEL,
  FEEDBACK_SLOT_KEY,
  FEEDBACK_SLOT_LABEL,
  eventFormTitle,
  skyformsCreateHref,
  skyformsFormId,
  type EventFormLink,
} from '@/lib/event-forms';
import type { EventSession } from '@/lib/api/sessions';
import { sessionFeedbackSlotKey } from '@/lib/session-feedback';
import { teamDecision } from '@/lib/use-app-can';

/** The parts core may leave out of a copy (POST /v1/events/{id}/copy `skipped`). */
export type CopySkippedPart = 'cover' | 'certificateTemplate' | 'doorStaff' | 'competitions';

const SKIPPED_TEXT: Record<CopySkippedPart, string> = {
  cover: 'Kapak görseli kopyalanmadı.',
  certificateTemplate:
    'Sertifika şablonu bağlaması kopyalanmadı: bu ekipte şablon bağlama yetkin yok.',
  doorStaff: 'Kapı görevlileri kopyalanmadı: bu ekipte görevli atama yetkin yok.',
  competitions: 'Yarışmalar kopyalanmadı: bu ekipte yarışma yönetme yetkin yok.',
};

/** One line per part core left out, for the copy's page; an unknown part is named as it came. */
export function copySkippedLines(skipped: readonly string[]): string[] {
  return skipped.map((part) =>
    part in SKIPPED_TEXT ? SKIPPED_TEXT[part as CopySkippedPart] : `Kopyalanmadı: ${part}.`,
  );
}

/** The dialog's name for the copy: "Gecekodu 2026 (kopya)". */
export function copyName(name: string): string {
  return `${name.trim()} (kopya)`;
}

/**
 * The copy's start the dialog offers (SPEC §3.2): the source's start a year
 * later; when that has passed, the first day after today on the source's
 * weekday, at its time. None when the source has no start.
 */
export function defaultCopyStart(startDate: string | undefined, now = new Date()): string {
  const start = parseDatetimeLocal(toDatetimeLocal(startDate));
  if (!start) return '';
  const nextYear = new Date(start);
  nextYear.setFullYear(start.getFullYear() + 1);
  if (nextYear.getTime() > now.getTime()) return toDatetimeLocalValue(nextYear);
  const day = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    start.getHours(),
    start.getMinutes(),
  );
  while (day.getDay() !== start.getDay()) day.setDate(day.getDate() + 1);
  return toDatetimeLocalValue(day);
}

/**
 * The copy's end as core moves it: the source's end by the distance its
 * start moves, as a datetime-local value. None when the source has no start
 * or no end, or no new start is chosen.
 */
export function copyEnd(
  source: { startDate?: string; endDate?: string },
  startLocal: string,
): string {
  const from = source.startDate ? new Date(source.startDate) : null;
  const end = source.endDate ? new Date(source.endDate) : null;
  const next = parseDatetimeLocal(startLocal);
  if (!from || !end || !next || Number.isNaN(from.getTime()) || Number.isNaN(end.getTime())) {
    return '';
  }
  return toDatetimeLocalValue(new Date(next.getTime() + (end.getTime() - from.getTime())));
}

/**
 * Whether core's capabilities let the reader copy an Event of `sourceTeam`
 * at all: create Events in its team, or edit it and create Events in another
 * team (ticket 16). Nothing until the answer is in; core decides the copy.
 */
export function canCopyEvent(state: CapabilitiesState, sourceTeam: string): boolean {
  if (state.status !== 'ready') return false;
  if (teamDecision(state, sourceTeam, 'event.create', false)) return true;
  if (!teamDecision(state, sourceTeam, 'event.update', false)) return false;
  const { teams, otherTeams } = state.data;
  return (
    Boolean(otherTeams?.can?.['event.create']) ||
    (teams ?? []).some((row) => row.team !== sourceTeam && Boolean(row.can?.['event.create']))
  );
}

/**
 * The Owner teams a copy of an Event of `sourceTeam` may go to, from core's
 * capabilities alone: the source's own when the reader creates Events there,
 * and, when they may edit the source, every other team they create Events in
 * (`teams[].can["event.create"]`; with `otherTeams.can["event.create"]` every
 * team of `allTeams` they are not in). The source's team comes first.
 */
export function copyTargetTeams(
  state: CapabilitiesState,
  sourceTeam: string,
  allTeams: readonly string[] = [],
): string[] {
  if (state.status !== 'ready') return [];
  const out: string[] = [];
  if (teamDecision(state, sourceTeam, 'event.create', false)) out.push(sourceTeam);
  if (teamDecision(state, sourceTeam, 'event.update', false)) {
    const own = state.data.teams ?? [];
    for (const row of own) {
      if (row.can?.['event.create']) out.push(row.team);
    }
    if (state.data.otherTeams?.can?.['event.create']) {
      const known = new Set(own.map((row) => row.team));
      out.push(...allTeams.filter((team) => !known.has(team)));
    }
  }
  return [...new Set(out)];
}

/** Whether the reader may name `team` as the copy's door staff team (`event.assignDoorStaff`). */
export function canCopyDoorStaff(state: CapabilitiesState, team: string): boolean {
  return state.status === 'ready' && teamDecision(state, team, 'event.assignDoorStaff', false);
}

/** Where the copy dialog leaves `skipped` for the copy's page to show once. */
export function copySkippedStorageKey(eventId: string): string {
  return `skylab.admin.event-copy-skipped:${eventId}`;
}

type SkippedStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function rememberCopySkipped(
  storage: SkippedStorage | null | undefined,
  eventId: string,
  skipped: readonly string[],
): void {
  if (!storage || !skipped.length) return;
  try {
    storage.setItem(copySkippedStorageKey(eventId), JSON.stringify(skipped));
  } catch {
    /* quota or private mode: the page shows no notice */
  }
}

/** The parts the copy left out, read once: a reload of the copy's page shows no notice. */
export function takeCopySkipped(
  storage: SkippedStorage | null | undefined,
  eventId: string,
): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(copySkippedStorageKey(eventId));
    if (!raw) return [];
    storage.removeItem(copySkippedStorageKey(eventId));
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((row) => typeof row === 'string') : [];
  } catch {
    return [];
  }
}

/** A form of the source the copy can start a new form from ("Geçen seferin formundan yeni form"). */
export type PreviousForm = {
  /** The copy's form slot the new form goes to: the application form, or the extra form's label. */
  slotKey: string;
  label: string;
  /** The source's Skyforms form, for Skyforms' `fromForm`. */
  formId: string;
  /** What the new form's title adds to the copy's name when not the label: a Session's title. */
  extra?: string;
};

type FormsOf = { formUrl?: string; extraFormUrls?: EventFormLink[]; feedbackFormUrl?: string };

/**
 * The source's Skyforms forms whose place on the copy is still empty: its
 * application form, each extra form by label, then its feedback form (the
 * copy takes the mode, not the form). A form outside Skyforms has nothing to
 * start from.
 */
export function previousForms(source: FormsOf, copy: FormsOf, origin?: string): PreviousForm[] {
  const out: PreviousForm[] = [];
  const applyId = source.formUrl ? skyformsFormId(source.formUrl, origin) : null;
  if (applyId && !copy.formUrl?.trim()) {
    out.push({ slotKey: APPLY_SLOT_KEY, label: APPLY_SLOT_LABEL, formId: applyId });
  }
  const taken = new Set(
    (copy.extraFormUrls ?? []).filter((row) => row.url?.trim()).map((row) => row.label.trim()),
  );
  for (const row of source.extraFormUrls ?? []) {
    const label = row.label.trim();
    const formId = row.url ? skyformsFormId(row.url, origin) : null;
    if (!formId || !label || taken.has(label)) continue;
    taken.add(label);
    out.push({ slotKey: label, label, formId });
  }
  const feedbackId = source.feedbackFormUrl ? skyformsFormId(source.feedbackFormUrl, origin) : null;
  if (feedbackId && !copy.feedbackFormUrl?.trim()) {
    out.push({ slotKey: FEEDBACK_SLOT_KEY, label: FEEDBACK_SLOT_LABEL, formId: feedbackId });
  }
  return out;
}

/**
 * The source's Sessions' Skyforms feedback forms whose Session on the copy has
 * none (`per_session`). A copied Session has a new id: it is the copy's
 * Session with the same title and order, the n-th such for the n-th one.
 */
export function previousSessionForms(
  sourceSessions: readonly EventSession[],
  copySessions: readonly EventSession[],
  origin?: string,
): PreviousForm[] {
  const sameKey = (session: EventSession) => `${session.orderIndex}|${session.title.trim()}`;
  const copies = new Map<string, EventSession[]>();
  for (const session of copySessions) {
    const rows = copies.get(sameKey(session)) ?? [];
    rows.push(session);
    copies.set(sameKey(session), rows);
  }
  const out: PreviousForm[] = [];
  for (const session of sourceSessions) {
    const match = copies.get(sameKey(session))?.shift();
    const formId = session.feedbackFormUrl ? skyformsFormId(session.feedbackFormUrl, origin) : null;
    if (!match || !formId || match.cancelled || match.feedbackFormUrl?.trim()) continue;
    const title = match.title.trim();
    out.push({
      slotKey: sessionFeedbackSlotKey(match.id),
      label: `${FEEDBACK_SLOT_LABEL} · ${title}`,
      formId,
      extra: title,
    });
  }
  return out;
}

/**
 * Skyforms' new form filled from the source's form (`fromForm`), for the
 * copy: back on the copy's page the form slot flow links it and makes its
 * short link.
 */
export function previousFormHref(
  origin: string,
  currentHref: string,
  copy: { id: string; name: string; ownerTeam: string; startDate?: string },
  form: PreviousForm,
): string | null {
  const extra = form.extra ?? (form.slotKey === APPLY_SLOT_KEY ? '' : form.label);
  const year = aliasYear(toDatetimeLocal(copy.startDate));
  return skyformsCreateHref(origin, currentHref ? editorReturnTo(currentHref, form.slotKey) : '', {
    title: eventFormTitle(copy.ownerTeam, copy.name, year, extra),
    ownerTeam: copy.ownerTeam,
    eventId: copy.id,
    fromForm: form.formId,
  });
}
