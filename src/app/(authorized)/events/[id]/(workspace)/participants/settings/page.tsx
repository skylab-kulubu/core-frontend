'use client';

import { useCallback } from 'react';
import { Switch } from '@/components/chrome/Switch';
import {
  EventCapacityFields,
  EventRegistrationFormFields,
  TicketNoteField,
} from '@/components/scheduling/EventEditor';
import { EventTicketImageFields } from '@/components/scheduling/EventTicketImageFields';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import {
  EventCardFrame,
  EventSettingsCard,
  EventSettingsCards,
  eventKnownMedia,
} from '@/components/scheduling/settings/EventSettingsCard';
import { newlyListedForms, useBindQuestion } from '@/components/scheduling/use-bind-question';
import { EVENT_CARDS } from '@/lib/event-workspace';
import { eventStatusOf } from '@/lib/events-view';

/**
 * Katılımcılar › Kayıt ayarları: how people register (the form, its tickets, the external link,
 * whether applying is open), how many may, and what their ticket says and shows.
 */
export default function EventRegistrationSettingsPage() {
  const { event, editor, canMutate, canAssign } = useEventWorkspace();
  // A save that links a Skyforms form asks whether its respondents get Tickets: core lets who
  // may edit the Event or add attendees send them (Update || Assign, as the attendee import)
  const [askBind, bindDialog] = useBindQuestion();
  const canSendTickets = canMutate || canAssign;
  const { markDirty } = editor;
  const ticketImageDirty = useCallback(
    (dirty: boolean) => markDirty('bilet-gorseli', dirty),
    [markDirty],
  );
  const base = editor.base;
  return (
    <EventSettingsCards>
      <EventSettingsCard
        id={EVENT_CARDS.registrationForm}
        title="Kayıt formu"
        fields={[
          'formSlots',
          'formUrl',
          'formAlias',
          'extraFormUrls',
          'formResponsesAutoTicket',
          'externalRegistrationUrl',
          'registrationClosed',
        ]}
        afterSave={async (saved) => {
          if (!canSendTickets) return;
          for (const formId of newlyListedForms(event, saved)) {
            await askBind(event.id, formId);
          }
        }}
      >
        {(fields) => (
          <>
            <EventRegistrationFormFields
              {...fields}
              returnTo={typeof window !== 'undefined' ? window.location.href : ''}
              formInUse={editor.inUse}
              canSendTickets={canSendTickets}
            />
            {/* A cancelled event takes no one; an older core sends no switch */}
            {eventStatusOf(event) !== 'cancelled' &&
            typeof fields.value.registrationClosed === 'boolean' ? (
              <Switch
                checked={!fields.value.registrationClosed}
                onChange={(open) => fields.patch({ registrationClosed: !open })}
                label="Kayıt açık"
              />
            ) : null}
          </>
        )}
      </EventSettingsCard>
      <EventSettingsCard
        id={EVENT_CARDS.capacity}
        title="Kontenjan"
        fields={['capacity', 'registrationClosesAt', 'waitlistEnabled']}
      >
        {(fields) => <EventCapacityFields {...fields} activeTickets={event.ticketCount} />}
      </EventSettingsCard>
      {base?.ticketNote !== undefined ? (
        <EventSettingsCard id={EVENT_CARDS.ticket} title="Bilet" fields={['ticketNote']}>
          {(fields) => <TicketNoteField {...fields} />}
        </EventSettingsCard>
      ) : null}
      <EventCardFrame id="bilet-gorseli" title="Bilet görseli">
        <EventTicketImageFields
          eventId={event.id}
          coverImageId={base?.coverImageId ?? ''}
          knownMedia={eventKnownMedia(event)}
          theme={base?.theme}
          onDirtyChange={ticketImageDirty}
        />
      </EventCardFrame>
      {bindDialog}
    </EventSettingsCards>
  );
}
