import { EventTemplateEditorPage } from '@/components/certificates/EventTemplateEditorPage';

/** An event's own certificate template: a focus page, the editor wants the whole width. */
export default async function EventCertificateTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  return (
    <EventTemplateEditorPage
      eventId={decodeURIComponent(id)}
      from={from === 'certificates' ? 'certificates' : undefined}
    />
  );
}
