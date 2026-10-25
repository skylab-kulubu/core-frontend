/** @jest-environment node */

import { urlsApi } from '@/lib/api/urls';

describe('urlsApi lists', () => {
  const realFetch = global.fetch;
  afterAll(() => {
    global.fetch = realFetch;
  });

  it('lists every link without a source, and one kind with ?source=', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(`${url.pathname}${url.search}`);
      return Response.json([]);
    }) as typeof fetch;

    await urlsApi.listMine();
    await urlsApi.listMine('form');
    await urlsApi.listAll('all');
    await urlsApi.listAll('event');
    await urlsApi.listAll('personal');

    expect(calls).toEqual([
      '/v1/urls',
      '/v1/urls?source=form',
      '/v1/urls/all',
      '/v1/urls/all?source=event',
      '/v1/urls/all?source=personal',
    ]);
  });
});
