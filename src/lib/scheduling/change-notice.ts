import type { EventFormState } from '@/components/scheduling/EventEditor';
import type { CoreEvent } from '@/lib/api/events';
import { eventDisplayStatus, eventStatusOf } from '@/lib/events-view';
import {
  eventFieldsFromForm,
  timeOrPlaceChanges,
  type TimeOrPlace,
} from '@/lib/scheduling/save-event';

/**
 * The Event's other details core tells the Ticket holders of when the editor says yes
 * (EVENT_CHANGED_NOTIFICATION, docs event-updated-notification.md#other-details), in its order.
 */
export type EventDetail = 'name' | 'description' | 'attendeeNote' | 'capacity' | 'links';

/** What a save changes that its Ticket holders may be told of. */
export type NoticeChange = TimeOrPlace | EventDetail;

/** The save's question: what changed, and how many hold a Ticket (`null` when not known). */
export type ChangeNotice = { changes: NoticeChange[]; holders: number | null };

/** The links as core compares them: a short link's alias is no change for the holder. */
function linksOf(fields: ReturnType<typeof eventFieldsFromForm>): string {
  return JSON.stringify([
    fields.externalRegistrationUrl ?? '',
    fields.linkedin ?? '',
    fields.formUrl ?? '',
    (fields.extraFormUrls ?? []).map((link) => [link.label, link.url]),
  ]);
}

/** Which of the Event's other details the edit changes since `base`. */
export function detailChanges(form: EventFormState, base: EventFormState): EventDetail[] {
  const next = eventFieldsFromForm(form);
  const before = eventFieldsFromForm(base);
  const out: EventDetail[] = [];
  if (next.name !== before.name) out.push('name');
  if (next.description !== before.description) out.push('description');
  // Left out until core sent it: no change then
  if (typeof next.attendeeNote === 'string' && next.attendeeNote !== (before.attendeeNote ?? '')) {
    out.push('attendeeNote');
  }
  if ((next.capacity ?? 0) !== (before.capacity ?? 0)) out.push('capacity');
  if (linksOf(next) !== linksOf(before)) out.push('links');
  return out;
}

/**
 * Whether saving the edit asks "Bilet sahiplerine bildir": a published Event that has not ended
 * gets a new time or place or other details, and someone may hold a Ticket. The answer goes as
 * `notifyTicketHolders` for both; core tells the details only while EVENT_CHANGED_NOTIFICATION
 * is on (an older core, or the switch off, records nothing of them). `null` saves without asking,
 * telling nobody.
 */
export function changeNoticeFor(
  event: CoreEvent,
  form: EventFormState,
  base: EventFormState,
  now = new Date(),
): ChangeNotice | null {
  if (eventStatusOf(event) !== 'published' || eventDisplayStatus(event, now) === 'ended') {
    return null;
  }
  const changes: NoticeChange[] = [...timeOrPlaceChanges(form, base), ...detailChanges(form, base)];
  if (changes.length === 0) return null;
  const holders = typeof event.ticketCount === 'number' ? event.ticketCount : null;
  if (holders === 0) return null;
  return { changes, holders };
}

const changeLabels: Record<NoticeChange, string> = {
  time: 'saat',
  place: 'yer',
  name: 'ad',
  description: 'açıklama',
  attendeeNote: 'katılımcı notu',
  capacity: 'kontenjan',
  links: 'bağlantılar',
};

/** The question's title: core's summary for a time or place, else the list ("Ad ve açıklama değişti"). */
export function changeNoticeTitle(changes: readonly NoticeChange[]): string {
  if (changes.every((change) => change === 'time' || change === 'place')) {
    if (changes.length > 1) return 'Etkinliğin saati ve yeri değişti';
    return changes[0] === 'time' ? 'Etkinliğin saati değişti' : 'Etkinliğin yeri değişti';
  }
  const words = changes.map((change) => changeLabels[change]);
  const list =
    words.length > 1 ? `${words.slice(0, -1).join(', ')} ve ${words[words.length - 1]}` : words[0];
  return `${list.charAt(0).toLocaleUpperCase('tr')}${list.slice(1)} değişti`;
}
