/** @jest-environment node */

import { hitSource, urlsApi } from '@/lib/api/urls';

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

describe('urlsApi availability', () => {
  const realFetch = global.fetch;
  afterAll(() => {
    global.fetch = realFetch;
  });

  it('asks for an alias’s availability with the alias encoded', async () => {
    const urls: URL[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      urls.push(new URL(String(input)));
      return Response.json({ alias: 'a b&c', available: false, reason: 'invalid' });
    }) as typeof fetch;

    await urlsApi.availability('a b&c');

    expect(urls[0].pathname).toBe('/v1/urls/availability');
    expect(urls[0].searchParams.get('alias')).toBe('a b&c');
  });
});

describe('hitSource', () => {
  it('gives the hit’s utm source, or nothing when it carried none', () => {
    expect(hitSource({ utm: { source: 'instagram' } })).toBe('instagram');
    expect(hitSource({ utm: { source: ' ' } })).toBeUndefined();
    expect(hitSource({})).toBeUndefined();
  });
});
