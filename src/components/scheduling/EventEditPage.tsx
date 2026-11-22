'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { StateCard } from '@/components/chrome/StateCard';
import { EventEditor, sectionOfIssue } from '@/components/scheduling/EventEditor';
import { EventFormLayout } from '@/components/scheduling/EventFormLayout';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { eventTabHref } from '@/lib/event-workspace';
import { useUnsavedChanges } from '@/lib/ui/use-unsaved-changes';

/** Jumps to the section a form problem is in, so the reader sees the field. */
export function showIssueSection(issue: string | undefined) {
  if (!issue || typeof document === 'undefined') return;
  document.getElementById(sectionOfIssue(issue))?.scrollIntoView({ block: 'start' });
}

/** /events/[id]/edit: the whole event on one page in sections, saved from the bar below. */
export function EventEditPage() {
  const router = useRouter();
  const { event, canMutate, editor } = useEventWorkspace();
  const { form } = editor;
  const value = form.watch('event');
  const dirty = form.formState.isDirty;
  const saving = form.formState.isSubmitting;
  const guard = useUnsavedChanges(dirty && !saving);
  const overview = eventTabHref(event.id);

  // Leaving the page drops what was not saved: the next visit starts from the event
  useEffect(() => () => form.reset(), [form]);

  // A link to a section (#sertifika from the Sertifikalar tab) lands on it once the form is in
  useEffect(() => {
    if (!editor.ready || typeof window === 'undefined' || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [editor.ready]);

  if (!canMutate) {
    return <StateCard title="Bu etkinliği düzenleme yetkin yok" tone="danger" />;
  }
  if (!editor.ready) return <StateCard title="Yükleniyor…" isLoading />;

  const issue = form.formState.errors.event?.message;

  return (
    <>
      <EventFormLayout
        dirty={dirty}
        saving={saving}
        submitLabel="Kaydet"
        onCancel={() => guard.leave(overview)}
        error={editor.error ?? issue}
        onSubmit={form.handleSubmit(
          async ({ event: values }) => {
            if (await editor.save(values)) {
              guard.allowLeave();
              router.push(overview);
            }
          },
          (errors) => showIssueSection(errors.event?.message),
        )}
      >
        <EventEditor
          value={value}
          onChange={(next) =>
            form.setValue('event', next, {
              shouldDirty: true,
              shouldValidate: form.formState.isSubmitted,
            })
          }
          ownerOptions={editor.ownerOptions}
          lockOwner={!editor.privileged}
          seasons={editor.seasons}
          showSeason={editor.privileged}
          ownerOptional={editor.privileged}
          assignDoorStaff={editor.privileged}
          knownMedia={[
            ...(event.coverImageId
              ? [{ id: event.coverImageId, name: 'Kapak', url: event.coverImageUrl }]
              : []),
            ...(event.images ?? []).map((image) => ({ id: image.id, url: image.url })),
          ]}
          returnTo={typeof window !== 'undefined' ? window.location.href : ''}
          formInUse={editor.inUse}
        />
      </EventFormLayout>
      {guard.dialog}
    </>
  );
}
