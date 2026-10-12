import { redirect } from 'next/navigation';
import { eventTabHref } from '@/lib/event-workspace';

export default async function EditCompetitorRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ eventId?: string | string[] }>;
}) {
  const [{ id }, { eventId }] = await Promise.all([params, searchParams]);
  redirect(
    typeof eventId === 'string' && eventId
      ? `${eventTabHref(eventId, 'competition')}/${encodeURIComponent(id)}`
      : '/events',
  );
}
