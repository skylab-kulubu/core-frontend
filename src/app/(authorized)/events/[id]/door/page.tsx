import { DoorDesk } from '@/components/scheduling/DoorDesk';

/** An event's door: the one address every "Kapı" link opens (/qr?eventId= comes here). */
export default async function EventDoorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DoorDesk eventId={decodeURIComponent(id)} />;
}
