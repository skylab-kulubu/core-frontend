'use client';

import { LoadError } from '@/components/chrome/LoadError';
import { EventCoverFields, EventIdentityFields } from '@/components/scheduling/EventEditor';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import {
  EventSettingsCard,
  EventSettingsCards,
  eventKnownMedia,
} from '@/components/scheduling/settings/EventSettingsCard';

/** Etkinlik ayarları › Genel: the event's name, owner team and description, its cover and gallery. */
export default function EventGeneralSettingsPage() {
  const { event, editor } = useEventWorkspace();
  return (
    <EventSettingsCards>
      <EventSettingsCard
        id="temel"
        title="Temel bilgiler"
        fields={['name', 'ownerTeam', 'description']}
      >
        {(fields) => (
          <>
            {editor.optionsFailed.teams ? (
              <LoadError title="Ekipler yüklenemedi" onRetry={editor.reloadOptions} />
            ) : null}
            <EventIdentityFields
              {...fields}
              ownerOptions={editor.ownerOptions}
              lockOwner={!editor.privileged}
              ownerOptional={editor.privileged}
            />
          </>
        )}
      </EventSettingsCard>
      <EventSettingsCard id="kapak" title="Kapak ve galeri" fields={['coverImageId', 'imageIds']}>
        {(fields) => <EventCoverFields {...fields} knownMedia={eventKnownMedia(event)} />}
      </EventSettingsCard>
    </EventSettingsCards>
  );
}
