import { redirect } from 'next/navigation';
import { eventSettingsHref } from '@/lib/event-workspace';

/** Etkinlik ayarları opens on its first page, Genel. */
export default async function EventSettingsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(eventSettingsHref(decodeURIComponent(id)));
}
