/** @jest-environment node */

import { HandoffProblemError, handoffTargetsApi } from '@/lib/api/handoff-targets';

describe('handoffTargetsApi', () => {
  const realFetch = global.fetch;
  afterAll(() => {
    global.fetch = realFetch;
  });

  it("saves through superadmin's own route, never Keycloak or a token", async () => {
    const calls: Request[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(new Request(new URL(String(input), 'https://admin.yildizskylab.com'), init));
      return Response.json({ clientId: 'account-center', enabled: true });
    }) as typeof fetch;

    await handoffTargetsApi.update('account-center', {
      enabled: true,
      signInPath: '/api/auth/login',
      returnParam: 'returnTo',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].url).toBe('https://admin.yildizskylab.com/api/handoff-targets/account-center');
    expect(calls[0].headers.get('authorization')).toBeNull();
    expect(calls[0].headers.get('content-type')).toBe('application/json');
    expect(await calls[0].json()).toEqual({
      enabled: true,
      signInPath: '/api/auth/login',
      returnParam: 'returnTo',
    });
  });

  it('turns a problem answer into an error carrying its Turkish detail and field', async () => {
    global.fetch = jest.fn(async () =>
      Response.json(
        {
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: 'Yol geçersiz.',
          field: 'signInPath',
        },
        { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    ) as typeof fetch;

    const failure = handoffTargetsApi.update('skyforms', {
      enabled: true,
      signInPath: '/x',
      returnParam: 'y',
    });

    await expect(failure).rejects.toBeInstanceOf(HandoffProblemError);
    await expect(failure).rejects.toMatchObject({
      status: 400,
      detail: 'Yol geçersiz.',
      field: 'signInPath',
    });
  });

  it('falls back to a Turkish message when the network fails', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;

    await expect(handoffTargetsApi.list()).rejects.toMatchObject({
      status: 0,
      detail: 'Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.',
    });
  });

  it('treats a bounce to the login page as an ended session', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      redirected: true,
      url: 'https://admin.yildizskylab.com/login',
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    })) as unknown as typeof fetch;

    await expect(handoffTargetsApi.list()).rejects.toMatchObject({
      status: 401,
      detail: 'Oturumun sona ermiş. Yeniden giriş yap.',
    });
  });

  it('refuses a list that is not a list', async () => {
    global.fetch = jest.fn(async () => Response.json({ targets: [] })) as typeof fetch;

    await expect(handoffTargetsApi.list()).rejects.toBeInstanceOf(HandoffProblemError);
  });

  it('reads omitted attributes as unset and refuses a target without a client id', async () => {
    global.fetch = jest.fn(async () =>
      Response.json([{ clientId: 'skyforms', name: 'SkyForms', enabled: true }]),
    ) as typeof fetch;
    await expect(handoffTargetsApi.list()).resolves.toEqual([
      {
        clientId: 'skyforms',
        name: 'SkyForms',
        rootUrl: null,
        enabled: true,
        signInPath: null,
        returnParam: null,
      },
    ]);

    global.fetch = jest.fn(async () => Response.json([{ name: 'Nameless' }])) as typeof fetch;
    await expect(handoffTargetsApi.list()).rejects.toBeInstanceOf(HandoffProblemError);
  });
});
