/** @jest-environment node */

import EventDaysRedirect from '@/app/(authorized)/events/[id]/days/page';
import EventTicketsRedirect from '@/app/(authorized)/events/[id]/tickets/page';
import EventSettingsRedirect from '@/app/(authorized)/events/[id]/(workspace)/settings/page';
import { redirectTarget } from '@/test/server/redirect';

jest.mock('next/navigation', () => jest.requireActual('@/test/server/redirect').navigation);

const params = Promise.resolve({ id: 'e1' });

describe('old event addresses', () => {
  it('sends /events/[id]/days to the Program tab', async () => {
    expect(await redirectTarget(() => EventDaysRedirect({ params }))).toBe('/events/e1/program');
  });

  it('sends /events/[id]/tickets, where a ticket’s trail leads, to the Katılımcılar tab', async () => {
    expect(await redirectTarget(() => EventTicketsRedirect({ params }))).toBe(
      '/events/e1/participants',
    );
  });

  it('opens Etkinlik ayarları on Genel', async () => {
    expect(await redirectTarget(() => EventSettingsRedirect({ params }))).toBe(
      '/events/e1/settings/general',
    );
  });
});
