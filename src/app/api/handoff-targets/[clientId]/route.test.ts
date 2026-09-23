/** @jest-environment node */

import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { PUT } from '@/app/api/handoff-targets/[clientId]/route';

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

const KEYCLOAK_ADMIN = 'https://e.yildizskylab.com/realms/e-skylab/sky-handoff/v1/admin';

function accessToken(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({ sub: 'admin-1', exp: Math.floor(Date.now() / 1000) + 300 }),
  ).toString('base64url');
  return `${header}.${body}.sig`;
}

type KeycloakHandler = (request: Request) => Response | Promise<Response>;

/** Stands in for Keycloak's sky-handoff admin API on the network boundary. */
function fakeKeycloak(handler: KeycloakHandler): Request[] {
  const seen: Request[] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    seen.push(request.clone());
    return handler(request);
  }) as typeof fetch;
  return seen;
}

function signedIn(values: Record<string, string>) {
  (cookies as jest.Mock).mockResolvedValue({
    get: (name: string) => (name in values ? { name, value: values[name] } : undefined),
    set: jest.fn(),
    delete: jest.fn(),
  });
}

function put(clientId: string, body: string, contentType = 'application/json') {
  const request = new NextRequest(
    `https://admin.yildizskylab.com/api/handoff-targets/${encodeURIComponent(clientId)}`,
    { method: 'PUT', body, headers: { 'Content-Type': contentType } },
  );
  return PUT(request, { params: Promise.resolve({ clientId }) });
}

describe('PUT /api/handoff-targets/[clientId]', () => {
  const issuer = process.env.OAUTH2_ISSUER;
  const realFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OAUTH2_ISSUER = 'https://e.yildizskylab.com/realms/e-skylab';
  });

  afterAll(() => {
    process.env.OAUTH2_ISSUER = issuer;
    global.fetch = realFetch;
  });

  it('saves only the three handoff fields as the signed-in admin and returns the stored target', async () => {
    const token = accessToken();
    signedIn({ auth_token: token });
    const stored = {
      clientId: 'skyforms',
      name: 'SkyForms',
      rootUrl: 'https://forms.yildizskylab.com',
      enabled: true,
      signInPath: '/auth/signin',
      returnParam: 'callbackUrl',
    };
    const seen = fakeKeycloak(() => Response.json(stored));

    const response = await put(
      'skyforms',
      JSON.stringify({
        enabled: true,
        signInPath: '/auth/signin',
        returnParam: 'callbackUrl',
        redirectUris: ['https://evil.example/*'],
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(stored);
    expect(seen).toHaveLength(1);
    expect(seen[0].method).toBe('PUT');
    expect(seen[0].url).toBe(`${KEYCLOAK_ADMIN}/targets/skyforms`);
    expect(seen[0].headers.get('authorization')).toBe(`Bearer ${token}`);
    expect(seen[0].headers.get('content-type')).toBe('application/json');
    expect(await seen[0].json()).toEqual({
      enabled: true,
      signInPath: '/auth/signin',
      returnParam: 'callbackUrl',
    });
  });

  it("relays Keycloak's validation problem with its field", async () => {
    signedIn({ auth_token: accessToken() });
    const problem = {
      type: 'https://e.yildizskylab.com/problems/invalid-sign-in-path',
      title: 'Bad Request',
      status: 400,
      detail: 'Giriş kapısı yolu "/" ile başlamalı.',
      field: 'signInPath',
    };
    fakeKeycloak(() =>
      Response.json(problem, {
        status: 400,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    );

    const response = await put(
      'skyforms',
      JSON.stringify({ enabled: true, signInPath: '/auth/signin', returnParam: 'callbackUrl' }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(problem);
  });

  it.each([
    [403, 'Bu işlem için realm süper yöneticisi olmalısın.'],
    [404, 'Bu istemci bulunamadı.'],
  ])('relays a %i problem from Keycloak', async (status, detail) => {
    signedIn({ auth_token: accessToken() });
    fakeKeycloak(() =>
      Response.json(
        { type: 'about:blank', title: 'Error', status, detail },
        { status, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );

    const response = await put(
      'missing',
      JSON.stringify({ enabled: false, signInPath: '/a', returnParam: 'b' }),
    );

    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ status, detail });
  });

  it.each(['..', '.', ' '])(
    'refuses the client id %j without calling Keycloak',
    async (clientId) => {
      signedIn({ auth_token: accessToken() });
      const seen = fakeKeycloak(() => Response.json({}));

      const response = await put(
        clientId,
        JSON.stringify({ enabled: false, signInPath: '/a', returnParam: 'b' }),
      );

      expect(seen).toHaveLength(0);
      expect(response.status).toBe(400);
    },
  );

  it.each([
    ['a form post', 'enabled=true', 'application/x-www-form-urlencoded', 415],
    ['broken JSON', '{"enabled":', 'application/json', 400],
    [
      'a non-boolean switch',
      '{"enabled":"true","signInPath":"/a","returnParam":"b"}',
      'application/json',
      400,
    ],
    ['a missing field', '{"enabled":false,"signInPath":"/a"}', 'application/json', 400],
  ])('refuses %s without calling Keycloak', async (_name, body, contentType, status) => {
    signedIn({ auth_token: accessToken() });
    const seen = fakeKeycloak(() => Response.json({}));

    const response = await put('skyforms', body, contentType);

    expect(seen).toHaveLength(0);
    expect(response.status).toBe(status);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
  });

  it('answers 401 without calling Keycloak when there is no session', async () => {
    signedIn({});
    const seen = fakeKeycloak(() => Response.json({}));

    const response = await put(
      'skyforms',
      JSON.stringify({ enabled: false, signInPath: '/a', returnParam: 'b' }),
    );

    expect(seen).toHaveLength(0);
    expect(response.status).toBe(401);
  });
});
