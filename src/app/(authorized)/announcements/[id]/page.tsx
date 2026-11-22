import { redirect } from 'next/navigation';

/** An announcement opens in its editor; the editor's trail leads here. */
export default async function AnnouncementRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/announcements/${id}/edit`);
}
