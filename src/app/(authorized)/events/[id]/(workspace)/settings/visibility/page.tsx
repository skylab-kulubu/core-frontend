'use client';

import { LoadError } from '@/components/chrome/LoadError';
import { EventVisibilityFields } from '@/components/scheduling/EventEditor';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import {
  EventSettingsCard,
  EventSettingsCards,
} from '@/components/scheduling/settings/EventSettingsCard';

/** Etkinlik ayarları › Görünürlük ve yayın: its season, Sıralamalı, prize and LinkedIn. */
export default function EventVisibilitySettingsPage() {
  const { editor } = useEventWorkspace();
  return (
    <EventSettingsCards>
      <EventSettingsCard
        id="yayin"
        title="Görünürlük ve yayın"
        fields={['seasonId', 'ranked', 'prizeInfo', 'linkedin']}
      >
        {(fields) => (
          <>
            {editor.optionsFailed.seasons ? (
              <LoadError title="Sezonlar yüklenemedi" onRetry={editor.reloadOptions} />
            ) : null}
            <EventVisibilityFields
              {...fields}
              seasons={editor.seasons}
              showSeason={editor.privileged}
            />
          </>
        )}
      </EventSettingsCard>
    </EventSettingsCards>
  );
}
