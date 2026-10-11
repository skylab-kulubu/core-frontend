import { redirect } from 'next/navigation';
import { eventTabHref } from '@/lib/event-workspace';

export default async function EventDaysRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(eventTabHref(id, 'program'));
}
