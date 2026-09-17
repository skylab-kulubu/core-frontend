import { eventsApi, type EventBody } from '@/lib/api/events';
import { seasonsApi } from '@/lib/api/seasons';
import { toRfc3339 } from '@/lib/datetime-local';
import type { EventFormState } from '@/components/scheduling/EventEditor';

export function eventBodyFromForm(form: EventFormState): EventBody {
  return {
    name: form.name.trim(),
    description: form.description,
    location: form.location.trim(),
    ownerTeam: form.ownerTeam.trim(),
    formUrl: form.formUrl || undefined,
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
  };
}

export async function saveEventWithSeason(
  form: EventFormState,
  existingId?: string,
): Promise<string> {
  const body = eventBodyFromForm(form);
  const saved = existingId
    ? await eventsApi.update(existingId, body)
    : await eventsApi.create(body);
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
  return saved.id;
}

export const saveClass =
  'border-skylab-400/40 bg-skylab-500/10 text-2xs text-skylab-300 h-8 rounded-md border px-3 font-medium';
