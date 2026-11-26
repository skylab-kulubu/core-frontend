import { CORE_API_URL } from '@/lib/api/core';
import { ticketsApi } from '@/lib/api/tickets';

function jsonRes(body: unknown, status = 201): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as Response;
}

describe('ticketsApi.createDoorQr', () => {
  it('asks for the door, display or static class', async () => {
    const urls: string[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) return jsonRes({ token: 'tok' }, 200);
      urls.push(url);
      return jsonRes({ token: 'v1.s.x', svg: '<svg/>' });
    }) as typeof fetch;
    await ticketsApi.createDoorQr('s1');
    await ticketsApi.createDoorQr('s1', 'display');
    await ticketsApi.createDoorQr('s1', 'static');
    expect(urls).toEqual([
      `${CORE_API_URL}/v1/sessions/s1/door-qr?svg=1`,
      `${CORE_API_URL}/v1/sessions/s1/door-qr?svg=1&use=display`,
      `${CORE_API_URL}/v1/sessions/s1/door-qr?svg=1&use=static`,
    ]);
  });
});
