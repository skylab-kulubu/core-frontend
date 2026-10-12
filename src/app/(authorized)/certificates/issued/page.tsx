import { redirect } from 'next/navigation';
import { eventTabHref } from '@/lib/event-workspace';

// Issued certificates and generation jobs live in each event's Sertifikalar tab
export default async function IssuedCertificatesRedirect({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string | string[] }>;
}) {
  const { eventId } = await searchParams;
  redirect(
    typeof eventId === 'string' && eventId ? eventTabHref(eventId, 'certificates') : '/events',
  );
}
