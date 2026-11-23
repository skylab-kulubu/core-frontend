import { redirect } from 'next/navigation';

/** The old edit address opens the season's settings. */
export default async function EditSeasonRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/seasons/${id}?bolum=ayarlar`);
}
