/** @jest-environment node */

import { eventsApi } from '@/lib/api/events';

describe('eventsApi.list', () => {
  const realFetch = global.fetch;
  afterAll(() => {
    global.fetch = realFetch;
  });

  it('asks core for archived Events by lifecycle', async () => {
    const urls: URL[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      urls.push(new URL(String(input)));
      return Response.json([]);
    }) as typeof fetch;

    await eventsApi.list(undefined, 'inactive');
    await eventsApi.list('GECEKODU', 'inactive');

    expect(urls.map((url) => url.search)).toEqual([
      '?lifecycle=inactive',
      '?ownerTeam=GECEKODU&lifecycle=inactive',
    ]);
  });
});
