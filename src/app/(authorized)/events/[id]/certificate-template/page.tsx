import { EventTemplateEditorPage } from '@/components/certificates/EventTemplateEditorPage';

/** An event's own certificate template: a focus page, the editor wants the whole width. */
export default async function EventCertificateTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventTemplateEditorPage eventId={decodeURIComponent(id)} />;
}
