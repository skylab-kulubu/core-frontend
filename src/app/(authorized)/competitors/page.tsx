import { redirect } from 'next/navigation';
import { eventTabHref } from '@/lib/event-workspace';

// Competitors live in each event's Yarışma tab
export default async function CompetitorsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string | string[] }>;
}) {
  const { eventId } = await searchParams;
  redirect(
    typeof eventId === 'string' && eventId ? eventTabHref(eventId, 'competition') : '/events',
  );
}
