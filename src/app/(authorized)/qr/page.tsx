import { redirect } from 'next/navigation';
import { DoorEventList } from '@/components/scheduling/DoorEventList';
import { eventDoorHref } from '@/lib/event-workspace';

/**
 * Kapı: the doors the person staffs. An event's door has one address under the
 * event; the old /qr?eventId= links go there.
 */
export default async function QrPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { eventId } = await searchParams;
  const requested = typeof eventId === 'string' ? eventId.trim() : '';
  if (requested) redirect(eventDoorHref(requested));
  return <DoorEventList />;
}
