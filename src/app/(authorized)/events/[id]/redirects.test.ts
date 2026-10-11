/** @jest-environment node */

import EventDaysRedirect from '@/app/(authorized)/events/[id]/days/page';
import EditEventRedirect from '@/app/(authorized)/events/[id]/edit/page';
import { redirectTarget } from '@/test/server/redirect';

jest.mock('next/navigation', () => jest.requireActual('@/test/server/redirect').navigation);

const params = Promise.resolve({ id: 'e1' });

describe('old event addresses', () => {
  it('sends /events/[id]/days to the Program tab', async () => {
    expect(await redirectTarget(() => EventDaysRedirect({ params }))).toBe('/events/e1/program');
  });

  it('sends /events/[id]/edit to the event, where Düzenle is', async () => {
    expect(await redirectTarget(() => EditEventRedirect({ params }))).toBe('/events/e1');
  });
});
