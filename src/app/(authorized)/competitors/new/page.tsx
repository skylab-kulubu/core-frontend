import { redirect } from 'next/navigation';
import { eventTabHref } from '@/lib/event-workspace';

export default async function NewCompetitorRedirect({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string | string[] }>;
}) {
  const { eventId } = await searchParams;
  redirect(
    typeof eventId === 'string' && eventId
      ? `${eventTabHref(eventId, 'competition')}/new`
      : '/events',
  );
}
