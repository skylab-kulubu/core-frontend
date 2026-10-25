/** @jest-environment node */

import { identityApi } from '@/lib/api/identity';

describe('identity member add calls', () => {
  const realFetch = global.fetch;
  afterAll(() => {
    global.fetch = realFetch;
  });

  function record() {
    const calls: { method: string; path: string; body?: unknown }[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        method: init?.method ?? 'GET',
        path: new URL(String(input)).pathname,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (init?.method === 'POST') return new Response(null, { status: 204 });
      return Response.json({ privileged: true, ytuLinked: false, warnings: ['not_ytu_verified'] });
    }) as typeof fetch;
    return calls;
  }

  it('asks core what adding the person would warn of', async () => {
    const calls = record();
    await expect(identityApi.memberCheck('g1', 'u-ada')).resolves.toEqual({
      privileged: true,
      ytuLinked: false,
      warnings: ['not_ytu_verified'],
    });
    expect(calls).toEqual([{ method: 'GET', path: '/v1/groups/g1/member-check/u-ada' }]);
  });

  it('searches the Group’s member candidates with the trimmed query', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(`${url.pathname}${url.search}`);
      return Response.json([]);
    }) as typeof fetch;
    await expect(identityApi.memberCandidates('g 1', ' ada@x.test ')).resolves.toEqual([]);
    expect(calls).toEqual(['/v1/groups/g%201/member-candidates?q=ada%40x.test']);
  });

  it('sends unverifiedAck only when the warning was confirmed', async () => {
    const calls = record();
    await identityApi.addMember('g1', 'u-ada');
    await identityApi.addMember('g1', 'u-ada', { unverifiedAck: true });
    expect(calls.map((call) => call.body)).toEqual([
      { userId: 'u-ada' },
      { userId: 'u-ada', unverifiedAck: true },
    ]);
  });
});
