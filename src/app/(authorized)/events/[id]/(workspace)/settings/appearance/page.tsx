'use client';

import { EventAppearanceFields } from '@/components/scheduling/EventEditor';
import {
  EventSettingsCard,
  EventSettingsCards,
} from '@/components/scheduling/settings/EventSettingsCard';

/** Etkinlik ayarları › Görünüm: the theme of the event's pages, forms and ticket. */
export default function EventAppearanceSettingsPage() {
  return (
    <EventSettingsCards>
      <EventSettingsCard id="tema" title="Tema" fields={['theme', 'ticketAccentColor']}>
        {(fields) => <EventAppearanceFields {...fields} />}
      </EventSettingsCard>
    </EventSettingsCards>
  );
}
