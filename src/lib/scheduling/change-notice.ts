import type { EventFormState } from '@/components/scheduling/EventEditor';
import type { CoreEvent } from '@/lib/api/events';
import { eventDisplayStatus, eventStatusOf } from '@/lib/events-view';
import { timeOrPlaceChanges, type TimeOrPlace } from '@/lib/scheduling/save-event';

/** The save's question: what changed, and how many hold a Ticket (`null` when not known). */
export type ChangeNotice = { changes: TimeOrPlace[]; holders: number | null };

/**
 * Whether saving the edit asks "Bilet sahiplerine bildir": a published Event that has not ended
 * gets a new time or place, and someone may hold a Ticket (core tells only then, docs
 * event-updated-notification.md). `null` saves without asking, telling nobody.
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
  const changes = timeOrPlaceChanges(form, base);
  if (changes.length === 0) return null;
  const holders = typeof event.ticketCount === 'number' ? event.ticketCount : null;
  if (holders === 0) return null;
  return { changes, holders };
}

/** The question's title, after core's summary of the change. */
export function changeNoticeTitle(changes: readonly TimeOrPlace[]): string {
  if (changes.length > 1) return 'Etkinliğin saati ve yeri değişti';
  return changes[0] === 'time' ? 'Etkinliğin saati değişti' : 'Etkinliğin yeri değişti';
}
