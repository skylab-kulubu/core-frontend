/** @jest-environment node */

import { hitSource, urlsApi } from '@/lib/api/urls';

describe('urlsApi', () => {
  const realFetch = global.fetch;
  let urls: URL[];

  beforeEach(() => {
    urls = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      urls.push(new URL(String(input)));
      return Response.json([]);
    }) as typeof fetch;
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  it('lists every link without a source, and one source with ?source=', async () => {
    await urlsApi.listMine();
    await urlsApi.listMine('form');
    await urlsApi.listAll('all');
    await urlsApi.listAll('event');

    expect(urls.map((url) => `${url.pathname}${url.search}`)).toEqual([
      '/v1/urls',
      '/v1/urls?source=form',
      '/v1/urls/all',
      '/v1/urls/all?source=event',
    ]);
  });

  it('asks for an alias’s availability with the alias encoded', async () => {
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
