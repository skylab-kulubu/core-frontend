'use client';

import { EventMailList } from '@/components/scheduling/settings/EventMailList';
import { EventSettingsCards } from '@/components/scheduling/settings/EventSettingsCard';

/** Postalar: the mails the event sends by itself, with their switches. */
export default function EventEmailsPage() {
  return (
    <EventSettingsCards>
      <EventMailList />
    </EventSettingsCards>
  );
}
