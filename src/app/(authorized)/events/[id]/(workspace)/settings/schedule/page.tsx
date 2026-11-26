'use client';

import { EventScheduleFields } from '@/components/scheduling/EventEditor';
import {
  EventSettingsCard,
  EventSettingsCards,
} from '@/components/scheduling/settings/EventSettingsCard';

/** Etkinlik ayarları › Zaman ve yer: when the event starts and ends, and where. */
export default function EventScheduleSettingsPage() {
  return (
    <EventSettingsCards>
      <EventSettingsCard
        id="zaman"
        title="Zaman ve yer"
        fields={[
          'startDate',
          'endDate',
          'location',
          'locationAddress',
          'locationLat',
          'locationLng',
        ]}
      >
        {(fields) => <EventScheduleFields {...fields} />}
      </EventSettingsCard>
    </EventSettingsCards>
  );
}
