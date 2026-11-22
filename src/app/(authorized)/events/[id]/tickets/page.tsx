import { redirect } from 'next/navigation';
import { eventTabHref } from '@/lib/event-workspace';

/** The tickets of an event are its Katılımcılar tab; a ticket's trail leads here. */
export default async function EventTicketsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(eventTabHref(decodeURIComponent(id), 'participants'));
}
