/** @jest-environment node */

import EditSeasonRedirect from '@/app/(authorized)/seasons/[id]/edit/page';
import { redirectTarget } from '@/test/server/redirect';

jest.mock('next/navigation', () => jest.requireActual('@/test/server/redirect').navigation);

it('sends the old edit address to the season’s settings', async () => {
  expect(
    await redirectTarget(() => EditSeasonRedirect({ params: Promise.resolve({ id: 's1' }) })),
  ).toBe('/seasons/s1?bolum=ayarlar');
});
