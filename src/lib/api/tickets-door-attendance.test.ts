import { CORE_API_URL } from '@/lib/api/core';
import { ticketsApi } from '@/lib/api/tickets';

function jsonRes(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as Response;
}

/** Each call to core with its body, the token round left out. */
function recordCalls() {
  const calls: { url: string; body?: string }[] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/auth/token')) return jsonRes({ token: 'tok' });
    calls.push({ url, body: typeof init?.body === 'string' ? init.body : undefined });
    return jsonRes({ total: 0, items: [] }, 201);
  }) as typeof fetch;
  return calls;
}

describe('ticketsApi at a session’s door', () => {
  it('reads the session’s attendance alone, never the day’s venue entries', async () => {
    const calls = recordCalls();
    await ticketsApi.doorActivity('s1');
    expect(calls.map((call) => call.url)).toEqual([
      `${CORE_API_URL}/v1/sessions/s1/check-ins?kind=check_in`,
    ]);
  });

  it('asks for the session’s attendance on a scan only when told to', async () => {
    const calls = recordCalls();
    await ticketsApi.scanCheckIn('s1', 'tk-1');
    await ticketsApi.scanCheckIn('s1', 'tk-2', { checkIn: true });
    expect(calls).toEqual([
      { url: `${CORE_API_URL}/v1/sessions/s1/check-in/scan`, body: '{"token":"tk-1"}' },
      {
        url: `${CORE_API_URL}/v1/sessions/s1/check-in/scan`,
        body: '{"token":"tk-2","checkIn":true}',
      },
    ]);
  });
});
