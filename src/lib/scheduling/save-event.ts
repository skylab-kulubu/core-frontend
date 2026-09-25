import { eventsApi, type CoreEvent, type EventBody } from '@/lib/api/events';
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
    active: form.active,
    ranked: form.ranked,
    prizeInfo: form.prizeInfo || undefined,
    coverImageId: form.coverImageId || undefined,
    attendanceRule: form.attendanceRule || 'none',
    attendanceRatio: form.attendanceRule === 'ratio' ? form.attendanceRatio : undefined,
    doorStaffIds: form.doorStaffIds ?? [],
  };
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

export async function saveEventWithSeason(
  form: EventFormState,
  existingId?: string,
): Promise<string> {
  const slotted = await attachFormAliases(
    form.formSlots ?? [],
    form.name,
    form.startDate ?? '',
    (body) => urlsApi.create(body),
    form.ownerTeam,
  );
  const body = eventBodyFromForm({
    ...form,
    formSlots: slotted,
    ...persistableFormFields(slotted),
  });
  const saved = existingId
    ? await eventsApi.update(existingId, body)
    : await eventsApi.create(body);
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
