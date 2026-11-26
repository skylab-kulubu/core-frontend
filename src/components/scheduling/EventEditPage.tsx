'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useFormState, useWatch } from 'react-hook-form';
import { LoadError } from '@/components/chrome/LoadError';
import { StateCard } from '@/components/chrome/StateCard';
import { EventEditTemplate } from '@/components/scheduling/EventEditTemplate';
import { EventOrganizers } from '@/components/scheduling/EventOrganizers';
import { EventEditor, sectionOfIssue } from '@/components/scheduling/EventEditor';
import { EventFormLayout } from '@/components/scheduling/EventFormLayout';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { useChangeNoticeQuestion } from '@/components/scheduling/use-change-notice-question';
import { newlyListedForms, useBindQuestion } from '@/components/scheduling/use-bind-question';
import { certificatesApi } from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';
import { eventTabHref } from '@/lib/event-workspace';
import { useTeamDecide } from '@/lib/use-app-can';
import { useUnsavedChanges } from '@/lib/ui/use-unsaved-changes';

export const ORGANIZERS_UNSAVED =
  'Düzenleyenler değişikliği kaydedilmedi; önce kaydet ya da vazgeç.';

/** Jumps to the section a form problem is in, so the reader sees the field. */
export function showIssueSection(issue: string | undefined) {
  if (!issue || typeof document === 'undefined') return;
  document.getElementById(sectionOfIssue(issue))?.scrollIntoView({ block: 'start' });
}

/**
 * Whether core has the certificate rule editor (GET /certificate-rule): an
 * older core answers 404 and the rule keeps its ratio field on this page.
 */
export function useLegacyCertificateRules(eventId: string, enabled: boolean): boolean {
  const [legacy, setLegacy] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    certificatesApi.rule(eventId).catch((err: unknown) => {
      if (!cancelled && err instanceof ProblemError && err.status === 404) setLegacy(true);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId, enabled]);
  return legacy;
}

/** /events/[id]/edit: the whole event on one page in sections, saved from the bar below. */
export function EventEditPage() {
  const router = useRouter();
  const { event, canMutate, canAssign, editor } = useEventWorkspace();
  // A save that links a Skyforms form asks whether its respondents get Tickets: core lets who
  // may edit the Event or add attendees send them (Update || Assign, as the attendee import)
  const [askBind, bindDialog] = useBindQuestion();
  const canSendTickets = canMutate || canAssign;
  const { form } = editor;
  // Subscribed here, not in the workspace: the page must redraw when load() resets the form
  const value = useWatch({ control: form.control, name: 'event' });
  const {
    isDirty: dirty,
    isSubmitting: saving,
    isSubmitted,
    errors,
  } = useFormState({
    control: form.control,
  });
  // Düzenleyenler is saved on its own: the event's Kaydet waits until it is saved or dropped
  const [organizersDirty, setOrganizersDirty] = useState(false);
  const [organizersHeld, setOrganizersHeld] = useState(false);
  // One question for the page, whichever part is unsaved
  const guard = useUnsavedChanges((dirty || organizersDirty) && !saving);
  const overview = eventTabHref(event.id);
  const legacyRules = useLegacyCertificateRules(event.id, canMutate);
  const [askChangeNotice, changeNoticeDialog] = useChangeNoticeQuestion();
  // core's Assign on the saved Event (privileged, or its Owner team's Leader); the group rule if unread
  const teamDecide = useTeamDecide();
  const assignDoorStaff = teamDecide(
    event.ownerTeam ?? '',
    'event.assignDoorStaff',
    editor.privileged,
  );

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

  const issue = errors.event?.message;

  return (
    <>
      <EventFormLayout
        dirty={dirty}
        saving={saving}
        submitLabel="Kaydet"
        onCancel={() => guard.leave(overview)}
        error={
          (organizersHeld && organizersDirty ? ORGANIZERS_UNSAVED : null) ?? editor.error ?? issue
        }
        onSubmit={form.handleSubmit(
          async ({ event: values }) => {
            if (organizersDirty) {
              setOrganizersHeld(true);
              document.getElementById('duzenleyenler')?.scrollIntoView({ block: 'start' });
              return;
            }
            // A new time or place of a published event: ask whether its ticket holders are told
            const notice = editor.changeNotice(values);
            const notifyTicketHolders = notice ? await askChangeNotice(notice) : false;
            if (notifyTicketHolders === null) return;
            if (await editor.save(values, { notifyTicketHolders })) {
              guard.allowLeave();
              if (canSendTickets) {
                for (const formId of newlyListedForms(event, values)) {
                  await askBind(event.id, formId);
                }
              }
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
              shouldValidate: isSubmitted,
            })
          }
          ownerOptions={editor.ownerOptions}
          lockOwner={!editor.privileged}
          seasons={editor.seasons}
          showSeason={editor.privileged}
          ownerOptional={editor.privileged}
          assignDoorStaff={assignDoorStaff}
          knownMedia={[
            ...(event.coverImageId
              ? [{ id: event.coverImageId, name: 'Kapak', url: event.coverImageUrl }]
              : []),
            ...(event.images ?? []).map((image) => ({ id: image.id, url: image.url })),
          ]}
          returnTo={typeof window !== 'undefined' ? window.location.href : ''}
          formInUse={editor.inUse}
          canSendTickets={canSendTickets}
          certificatesHref={eventTabHref(event.id, 'certificates')}
          legacyRules={legacyRules}
          activeTickets={event.ticketCount}
          storedRatio={
            event.attendanceRule === 'ratio' ? (event.attendanceRatio ?? 0.75) : undefined
          }
          certificateTemplate={
            <EventEditTemplate
              leave={guard.leave}
              autoSend={
                (value.attendanceRule ?? 'none') !== 'none' && value.attendanceAutoFinalize === true
              }
            />
          }
          organizers={<EventOrganizers event={event} onDirtyChange={setOrganizersDirty} />}
          notices={{
            temel: editor.optionsFailed.teams ? (
              <LoadError title="Ekipler yüklenemedi" onRetry={editor.reloadOptions} />
            ) : null,
            yayin: editor.optionsFailed.seasons ? (
              <LoadError title="Sezonlar yüklenemedi" onRetry={editor.reloadOptions} />
            ) : null,
          }}
        />
      </EventFormLayout>
      {guard.dialog}
      {changeNoticeDialog}
      {bindDialog}
    </>
  );
}
