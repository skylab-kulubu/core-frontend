import { eventsApi, type CoreEvent, type EventBody, type EventPatch } from '@/lib/api/events';
import { urlsApi } from '@/lib/api/urls';
import { seasonsApi } from '@/lib/api/seasons';
import { toRfc3339 } from '@/lib/datetime-local';
import { isEventId } from '@/lib/event-draft';
import { attachFormAliases, persistableFormFields } from '@/lib/event-forms';
import type { EventFormState } from '@/components/scheduling/EventEditor';

export function eventBodyFromForm(form: EventFormState): EventBody {
  const forms = persistableFormFields(form.formSlots ?? []);
  const reservedId = isEventId(form.reservedId) ? form.reservedId : undefined;
  return {
    ...(reservedId ? { id: reservedId } : {}),
    name: form.name.trim(),
    description: form.description,
    location: form.location.trim(),
    ownerTeam: form.ownerTeam.trim(),
    formUrl: forms.formUrl || undefined,
    formAlias: forms.formAlias || undefined,
    extraFormUrls: forms.extraFormUrls,
    capacity: form.capacity,
    startDate: toRfc3339(form.startDate ?? ''),
    endDate: toRfc3339(form.endDate ?? ''),
    linkedin: form.linkedin || undefined,
    ranked: form.ranked,
    prizeInfo: form.prizeInfo || undefined,
    coverImageId: form.coverImageId || undefined,
    attendanceRule: form.attendanceRule || 'none',
    attendanceRatio: form.attendanceRule === 'ratio' ? form.attendanceRatio : undefined,
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
  return {
    name: form.name.trim(),
    description: form.description,
    location: form.location.trim(),
    ...(ownerTeam ? { ownerTeam } : {}),
    formUrl: forms.formUrl || null,
    formAlias: forms.formAlias || null,
    extraFormUrls: forms.extraFormUrls ?? [],
    capacity: form.capacity,
    startDate: toRfc3339(form.startDate ?? '') ?? null,
    endDate: toRfc3339(form.endDate ?? '') ?? null,
    linkedin: form.linkedin || null,
    ranked: form.ranked,
    prizeInfo: form.prizeInfo || null,
    coverImageId: form.coverImageId || null,
    attendanceRule: form.attendanceRule || 'none',
    attendanceRatio: form.attendanceRule === 'ratio' ? (form.attendanceRatio ?? null) : null,
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
  return Object.fromEntries(
    Object.entries(next).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(before[key]),
    ),
  ) as EventPatch;
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
 * changed since `base`; then its season and gallery.
 */
export async function saveEventWithSeason(
  form: EventFormState,
  existingId?: string,
  base?: EventFormState,
): Promise<string> {
  const slotted = await attachFormAliases(
    form.formSlots ?? [],
    form.name,
    form.startDate ?? '',
    (body) => urlsApi.create(body),
    form.ownerTeam,
  );
  const slottedForm = { ...form, formSlots: slotted, ...persistableFormFields(slotted) };
  // A new Event opens as a draft: nobody sees it until it is published (ADR 0066)
  const saved = existingId
    ? await eventsApi.patch(existingId, eventPatchFromForm(slottedForm, base))
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
