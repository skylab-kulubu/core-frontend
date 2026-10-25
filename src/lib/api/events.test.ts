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

describe('eventsApi status writes', () => {
  const realFetch = global.fetch;
  afterAll(() => {
    global.fetch = realFetch;
  });

  function recordFetch() {
    const calls: Array<{ method: string; path: string; body: unknown }> = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push({
        method: init?.method ?? 'GET',
        path: `${url.pathname}${url.search}`,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      });
      return Response.json({});
    }) as typeof fetch;
    return calls;
  }

  it('asks core for the drafts the reader may see', async () => {
    const calls = recordFetch();
    await eventsApi.list('GECEKODU', undefined, { drafts: true });
    expect(calls[0]?.path).toBe('/v1/events?ownerTeam=GECEKODU&drafts=include');
  });

  it('posts each transition to its own endpoint', async () => {
    const calls = recordFetch();
    await eventsApi.publish('e1');
    await eventsApi.unpublish('e1');
    await eventsApi.cancel('e1', { reason: 'Hava', notifyTicketHolders: true });
    await eventsApi.uncancel('e1', { notifyTicketHolders: false });
    await eventsApi.patch('e1', { registrationClosed: true });

    expect(calls).toEqual([
      { method: 'POST', path: '/v1/events/e1/publish', body: undefined },
      { method: 'POST', path: '/v1/events/e1/unpublish', body: undefined },
      {
        method: 'POST',
        path: '/v1/events/e1/cancel',
        body: { reason: 'Hava', notifyTicketHolders: true },
      },
      { method: 'POST', path: '/v1/events/e1/uncancel', body: { notifyTicketHolders: false } },
      { method: 'PATCH', path: '/v1/events/e1', body: { registrationClosed: true } },
    ]);
  });
});
