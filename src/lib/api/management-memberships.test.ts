/** @jest-environment node */

import { managementMembershipsApi } from '@/lib/api/management-memberships';

describe('managementMembershipsApi', () => {
  const realFetch = global.fetch;
  afterAll(() => {
    global.fetch = realFetch;
  });

  it('calls core’s term routes with their bodies', async () => {
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push({
        method: init?.method ?? 'GET',
        path: url.pathname,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      });
      return init?.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json([]);
    }) as typeof fetch;

    await managementMembershipsApi.list();
    await managementMembershipsApi.extend('t1', '2027-09-30');
    await managementMembershipsApi.handover('t1', {
      userId: 'u2',
      mode: 'at_term_end',
      unverifiedAck: true,
    });
    await managementMembershipsApi.remove('t1');

    expect(calls).toEqual([
      { method: 'GET', path: '/v1/management-memberships', body: undefined },
      {
        method: 'POST',
        path: '/v1/management-memberships/t1/extend',
        body: { endsAt: '2027-09-30' },
      },
      {
        method: 'POST',
        path: '/v1/management-memberships/t1/handover',
        body: { userId: 'u2', mode: 'at_term_end', unverifiedAck: true },
      },
      { method: 'DELETE', path: '/v1/management-memberships/t1', body: undefined },
    ]);
  });
});
