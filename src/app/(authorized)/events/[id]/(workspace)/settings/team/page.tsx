'use client';

import { useCallback } from 'react';
import { EventOrganizers } from '@/components/scheduling/EventOrganizers';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import {
  EventCardFrame,
  EventSettingsCards,
} from '@/components/scheduling/settings/EventSettingsCard';

/** Etkinlik ayarları › Ekip: the Co-organizer teams and people, saved on their own. */
export default function EventTeamSettingsPage() {
  const { event, editor } = useEventWorkspace();
  const { markDirty } = editor;
  const onDirtyChange = useCallback(
    (dirty: boolean) => markDirty('duzenleyenler', dirty),
    [markDirty],
  );
  return (
    <EventSettingsCards>
      <EventCardFrame id="duzenleyenler" title="Düzenleyenler">
        <EventOrganizers event={event} onDirtyChange={onDirtyChange} />
      </EventCardFrame>
    </EventSettingsCards>
  );
}
