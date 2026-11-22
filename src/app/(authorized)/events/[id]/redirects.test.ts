/** @jest-environment node */

import EventDaysRedirect from '@/app/(authorized)/events/[id]/days/page';
import { redirectTarget } from '@/test/server/redirect';

jest.mock('next/navigation', () => jest.requireActual('@/test/server/redirect').navigation);

const params = Promise.resolve({ id: 'e1' });

describe('old event addresses', () => {
  it('sends /events/[id]/days to the Program tab', async () => {
    expect(await redirectTarget(() => EventDaysRedirect({ params }))).toBe('/events/e1/program');
  });
});
