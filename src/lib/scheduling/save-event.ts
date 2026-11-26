import { eventsApi, type CoreEvent, type EventBody, type EventPatch } from '@/lib/api/events';
import { urlsApi } from '@/lib/api/urls';
import { seasonsApi } from '@/lib/api/seasons';
import { toRfc3339 } from '@/lib/datetime-local';
import { isEventId } from '@/lib/event-draft';
import { pointOf } from '@/lib/event-location';
import { attachFormAliases, persistableFormFields } from '@/lib/event-forms';
import type { EventFormState } from '@/components/scheduling/EventEditor';

/** The feedback fields of a new Event; an empty form is left out. */
function feedbackBody(form: EventFormState): Partial<EventBody> {
  return {
    feedbackMode: form.feedbackMode ?? 'event',
    feedbackFormUrl: form.feedbackSlot?.url.trim() || undefined,
    feedbackFormAlias: form.feedbackSlot?.alias.trim() || undefined,
    feedbackAutoSend: form.feedbackAutoSend ?? true,
  };
}

/**
 * "Sertifikaları otomatik gönder": left out until it was read or set (an older core reads none).
 * A new Event always sends it, so an older core's default (on) does not apply.
 */
function autoSendBody(form: EventFormState): Pick<EventPatch, 'attendanceAutoFinalize'> {
  return typeof form.attendanceAutoFinalize === 'boolean'
    ? { attendanceAutoFinalize: form.attendanceAutoFinalize }
    : {};
}

/** A new Event's point and address; left out while empty. */
function locationBody(form: EventFormState): Partial<EventBody> {
  const point = pointOf(form);
  const address = form.locationAddress?.trim();
  return {
    ...(point ? { locationLat: point.lat, locationLng: point.lng } : {}),
    ...(address ? { locationAddress: address } : {}),
  };
}

/** The waiting list switch; left out until it was read or set, so core keeps its default. */
function waitlistBody(form: EventFormState): { waitlistEnabled?: boolean } {
  return typeof form.waitlistEnabled === 'boolean' ? { waitlistEnabled: form.waitlistEnabled } : {};
}

/**
 * The door's mode and mail switches; each left out until it was read or set, so core keeps
 * what it has (an older core reads none).
 */
function doorBody(
  form: EventFormState,
  create = false,
): Pick<EventPatch, 'entryMode' | 'attendanceWelcomeMail' | 'attendanceRecordedMail'> & {
  attendeeNote?: string;
  ticketNote?: string;
} {
  return {
    ...(form.entryMode !== undefined ? { entryMode: form.entryMode } : {}),
    // A new event sends a switch only when turned off (on is core's default)
    ...(typeof form.attendanceWelcomeMail === 'boolean' && (!create || !form.attendanceWelcomeMail)
      ? { attendanceWelcomeMail: form.attendanceWelcomeMail }
      : {}),
    ...(typeof form.attendanceRecordedMail === 'boolean' &&
    (!create || !form.attendanceRecordedMail)
      ? { attendanceRecordedMail: form.attendanceRecordedMail }
      : {}),
    // Read only by who may edit the event: left out until core sent it
    // A new event leaves an empty one out; an edit sends "" to clear it
    ...(typeof form.attendeeNote === 'string' && (!create || form.attendeeNote.trim())
      ? { attendeeNote: form.attendeeNote.trim() }
      : {}),
    // The ticket mails' announcement, the same way (core docs/ticket-note.md)
    ...(typeof form.ticketNote === 'string' && (!create || form.ticketNote.trim())
      ? { ticketNote: form.ticketNote.trim() }
      : {}),
  };
}

/**
 * "Otomatik bilet gönder": left out until it was read or set (an older core reads none); a new
 * Event sends it only when turned off (on is core's default).
 */
function autoTicketBody(
  form: EventFormState,
  create = false,
): Pick<EventPatch, 'formResponsesAutoTicket'> {
  return typeof form.formResponsesAutoTicket === 'boolean' &&
    (!create || !form.formResponsesAutoTicket)
    ? { formResponsesAutoTicket: form.formResponsesAutoTicket }
    : {};
}

/**
 * The theme and accent colour; each left out until it was read or set, so an older core reads
 * none. A new Event sends only what was chosen; an edit sends `null` to go back to the default.
 */
function themeBody(
  form: EventFormState,
  create = false,
): Pick<EventPatch, 'theme' | 'ticketAccentColor'> {
  const out: Pick<EventPatch, 'theme' | 'ticketAccentColor'> = {};
  if (form.theme !== undefined && (!create || form.theme)) out.theme = form.theme || null;
  const accent = form.ticketAccentColor?.trim();
  if (form.ticketAccentColor !== undefined && (!create || accent)) {
    out.ticketAccentColor = accent ? accent.toUpperCase() : null;
  }
  return out;
}

export function eventBodyFromForm(form: EventFormState): EventBody {
  const forms = persistableFormFields(form.formSlots ?? []);
  const reservedId = isEventId(form.reservedId) ? form.reservedId : undefined;
  return {
    ...(reservedId ? { id: reservedId } : {}),
    name: form.name.trim(),
    description: form.description,
    location: form.location.trim(),
    ...locationBody(form),
    ownerTeam: form.ownerTeam.trim(),
    formUrl: forms.formUrl || undefined,
    formAlias: forms.formAlias || undefined,
    extraFormUrls: forms.extraFormUrls,
    externalRegistrationUrl: form.externalRegistrationUrl?.trim() || undefined,
    ...feedbackBody(form),
    capacity: form.capacity,
    ...waitlistBody(form),
    ...doorBody(form, true),
    ...autoTicketBody(form, true),
    ...themeBody(form, true),
    startDate: toRfc3339(form.startDate ?? ''),
    endDate: toRfc3339(form.endDate ?? ''),
    linkedin: form.linkedin || undefined,
    ranked: form.ranked,
    prizeInfo: form.prizeInfo || undefined,
    coverImageId: form.coverImageId || undefined,
    attendanceRule: form.attendanceRule || 'none',
    attendanceRatio: form.attendanceRule === 'ratio' ? form.attendanceRatio : undefined,
    // The count rule's threshold; left out for the default (the Sertifikalar tab sets it)
    attendanceMinCount:
      form.attendanceRule === 'count' ? (form.attendanceMinCount ?? undefined) : undefined,
    ...autoSendBody(form),
    doorStaffIds: form.doorStaffIds ?? [],
    registrationClosesAt: toRfc3339(form.registrationClosesAt ?? '') || undefined,
  };
}

/**
 * Every field the editor writes, as core's partial update reads it (bilet
 * 17): a field core keeps when it is left out, so an emptied optional field
 * is sent as `null` (`[]` for the lists) to clear it. The Owner team cannot
 * be cleared and is left out when empty.
 */
export function eventFieldsFromForm(form: EventFormState): EventPatch {
  const forms = persistableFormFields(form.formSlots ?? []);
  const ownerTeam = form.ownerTeam.trim();
  const point = pointOf(form);
  return {
    name: form.name.trim(),
    description: form.description,
    location: form.location.trim(),
    // Both or neither (core docs/event-location.md); null takes them off
    locationLat: point ? point.lat : null,
    locationLng: point ? point.lng : null,
    locationAddress: form.locationAddress?.trim() || null,
    ...(ownerTeam ? { ownerTeam } : {}),
    formUrl: forms.formUrl || null,
    formAlias: forms.formAlias || null,
    extraFormUrls: forms.extraFormUrls ?? [],
    externalRegistrationUrl: form.externalRegistrationUrl?.trim() || null,
    feedbackMode: form.feedbackMode ?? 'event',
    feedbackFormUrl: form.feedbackSlot?.url.trim() || null,
    feedbackFormAlias: form.feedbackSlot?.alias.trim() || null,
    feedbackAutoSend: form.feedbackAutoSend ?? true,
    capacity: form.capacity,
    ...waitlistBody(form),
    ...doorBody(form),
    ...autoTicketBody(form),
    ...themeBody(form),
    startDate: toRfc3339(form.startDate ?? '') ?? null,
    endDate: toRfc3339(form.endDate ?? '') ?? null,
    linkedin: form.linkedin || null,
    ranked: form.ranked,
    prizeInfo: form.prizeInfo || null,
    coverImageId: form.coverImageId || null,
    attendanceRule: form.attendanceRule || 'none',
    attendanceRatio: form.attendanceRule === 'ratio' ? (form.attendanceRatio ?? null) : null,
    attendanceMinCount: form.attendanceRule === 'count' ? (form.attendanceMinCount ?? null) : null,
    ...autoSendBody(form),
    doorStaffIds: form.doorStaffIds ?? [],
    registrationClosesAt: toRfc3339(form.registrationClosesAt ?? '') ?? null,
  };
}

/**
 * The update for an edited Event: with `base` (what the form opened with)
 * only the fields the reader changed, so a save does not write back what
 * another tab or person changed meanwhile; without it every field.
 */
export function eventPatchFromForm(form: EventFormState, base?: EventFormState): EventPatch {
  const next = eventFieldsFromForm(form);
  if (!base) return next;
  const before: Record<string, unknown> = eventFieldsFromForm(base);
  const changed = Object.fromEntries(
    Object.entries(next).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(before[key]),
    ),
  ) as EventPatch;
  // The point goes as a pair: core refuses one coordinate alone (event_location_invalid)
  if ('locationLat' in changed || 'locationLng' in changed) {
    changed.locationLat = next.locationLat;
    changed.locationLng = next.locationLng;
  }
  return changed;
}

/** The fields whose change a published Event's Ticket holders are told of (core event.updated). */
export type TimeOrPlace = 'time' | 'place';

/**
 * Which of the Event's time (start, end) and place (the location's text) the edit changes since
 * `base`: what core tells the Ticket holders of. The map point and address are not among them.
 */
export function timeOrPlaceChanges(form: EventFormState, base: EventFormState): TimeOrPlace[] {
  const changed = eventPatchFromForm(form, base);
  const out: TimeOrPlace[] = [];
  if ('startDate' in changed || 'endDate' in changed) out.push('time');
  if ('location' in changed) out.push('place');
  return out;
}

/**
 * A new Event was created but a later step of its save (season, gallery)
 * failed. The next save must update `eventId` instead of creating it again.
 */
export class EventSaveIncomplete extends Error {
  readonly eventId: string;

  constructor(eventId: string, cause: unknown) {
    super('Etkinlik oluşturuldu, ama kaydı tamamlanamadı.', { cause });
    this.name = 'EventSaveIncomplete';
    this.eventId = eventId;
  }
}

/**
 * Creates the Event (a draft), or updates `existingId` with the fields that
 * changed since `base`; then its season and gallery. `notifyTicketHolders`
 * answers whether a new time or place is told to the Ticket holders.
 */
export async function saveEventWithSeason(
  form: EventFormState,
  existingId?: string,
  base?: EventFormState,
  options?: { notifyTicketHolders?: boolean },
): Promise<string> {
  const slotted = await attachFormAliases(
    form.formSlots ?? [],
    form.name,
    form.startDate ?? '',
    (body) => urlsApi.create(body),
    form.ownerTeam,
  );
  // The feedback form gets its short link the same way (core binds it to the Event)
  const [feedbackSlot] = form.feedbackSlot
    ? await attachFormAliases(
        [form.feedbackSlot],
        form.name,
        form.startDate ?? '',
        (body) => urlsApi.create(body),
        form.ownerTeam,
      )
    : [];
  const slottedForm = {
    ...form,
    formSlots: slotted,
    ...persistableFormFields(slotted),
    ...(feedbackSlot ? { feedbackSlot } : {}),
  };
  // A new Event opens as a draft: nobody sees it until it is published (ADR 0066)
  const notify =
    options?.notifyTicketHolders === undefined
      ? {}
      : { notifyTicketHolders: options.notifyTicketHolders };
  const saved = existingId
    ? await eventsApi.patch(existingId, { ...eventPatchFromForm(slottedForm, base), ...notify })
    : await eventsApi.create({ ...eventBodyFromForm(slottedForm), status: 'draft' });
  try {
    await finishSave(form, saved, existingId);
  } catch (cause) {
    if (existingId) throw cause;
    throw new EventSaveIncomplete(saved.id, cause);
  }
  return saved.id;
}

async function finishSave(form: EventFormState, saved: CoreEvent, existingId?: string) {
  if (form.seasonId) {
    await seasonsApi.assignEvent(form.seasonId, saved.id);
  } else if (existingId && saved.seasonId) {
    // The season is not in the Event's body: emptying the select takes it off here
    await seasonsApi.unassignEvent(saved.id);
  }
  const next = form.imageIds ?? [];
  const prev = (saved.images ?? []).map((image) => image.id);
  const add = next.filter((id) => !prev.includes(id));
  const remove = existingId ? prev.filter((id) => !next.includes(id)) : [];
  if (remove.length) {
    await eventsApi.removeImages(saved.id, remove);
  }
  if (add.length) {
    await eventsApi.addImages(saved.id, add);
  }
}
