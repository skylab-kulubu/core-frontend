import { coreFetch } from '@/lib/api/core';
import { CORE_READ_MAX_AGE_MS, clearCoreReads, keptReadCount } from '@/lib/api/core-read-cache';
import { SESSION_RENEWED_EVENT } from '@/lib/auth/session-renewal';

// jsdom has no Response
function json(body: unknown, status = 200): Response {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => body,
  } as Response;
}

describe('coreFetch reads', () => {
  const realFetch = global.fetch;
  let now = 5_000_000;
  let coreCalls: Array<{ method: string; url: string }> = [];
  let answer: (url: string, method: string) => Response;

  beforeEach(() => {
    now = 5_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    coreCalls = [];
    answer = (url) => json({ url, n: coreCalls.length });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) return json({ token: 't', expiresIn: 300 });
      const method = init?.method ?? 'GET';
      coreCalls.push({ method, url });
      return answer(url, method);
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
    clearCoreReads();
  });

  it('sends one request for the same GET asked at once and gives each caller its own copy', async () => {
    const [a, b] = await Promise.all([
      coreFetch<{ n: number }>('/v1/events/e1'),
      coreFetch<{ n: number }>('/v1/events/e1'),
    ]);

    expect(coreCalls).toHaveLength(1);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it('answers a repeated GET from memory for a short while, then asks core again', async () => {
    await coreFetch('/v1/teams');
    now += CORE_READ_MAX_AGE_MS - 1;
    await coreFetch('/v1/teams');
    expect(coreCalls).toHaveLength(1);

    now += 2;
    await coreFetch('/v1/teams');
    expect(coreCalls).toHaveLength(2);
  });

  it('drops expired answers when it keeps a new one', async () => {
    await coreFetch('/v1/users?q=ad');
    await coreFetch('/v1/users?q=ada');
    expect(keptReadCount()).toBe(2);

    now += CORE_READ_MAX_AGE_MS;
    await coreFetch('/v1/users?q=adam');

    expect(keptReadCount()).toBe(1);
  });

  it('reads core again after any write', async () => {
    await coreFetch('/v1/events/e1');
    await coreFetch('/v1/events/e1', { method: 'PUT', body: '{}' });
    await coreFetch('/v1/events/e1');

    expect(coreCalls.map((call) => call.method)).toEqual(['GET', 'PUT', 'GET']);
  });

  it('reads core again after a write that failed', async () => {
    await coreFetch('/v1/events/e1');
    answer = (url, method) => (method === 'GET' ? json({ url }) : json({ title: 'Conflict' }, 409));
    await expect(coreFetch('/v1/events/e1', { method: 'DELETE' })).rejects.toMatchObject({
      status: 409,
    });
    await coreFetch('/v1/events/e1');

    expect(coreCalls).toHaveLength(3);
  });

  it('keeps no failed answer', async () => {
    answer = () => json({ title: 'Bad Gateway' }, 502);
    await expect(coreFetch('/v1/teams')).rejects.toMatchObject({ status: 502 });
    answer = (url) => json({ url });
    await expect(coreFetch('/v1/teams')).resolves.toEqual({ url: expect.any(String) });

    expect(coreCalls).toHaveLength(2);
  });

  it("reads core for a 'no-store' read, with headers or with a signal", async () => {
    await coreFetch('/v1/teams');
    await coreFetch('/v1/teams', { cache: 'no-store' });
    await coreFetch('/v1/teams', { headers: { Accept: 'application/json' } });
    await coreFetch('/v1/teams', { signal: new AbortController().signal });

    expect(coreCalls).toHaveLength(4);
  });

  it('reads core again when the person comes back to the tab or the session token changes', async () => {
    await coreFetch('/v1/users/me/capabilities');
    window.dispatchEvent(new Event('focus'));
    await coreFetch('/v1/users/me/capabilities');
    window.dispatchEvent(new Event(SESSION_RENEWED_EVENT));
    await coreFetch('/v1/users/me/capabilities');

    expect(coreCalls).toHaveLength(3);
  });
});
