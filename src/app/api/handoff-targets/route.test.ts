/** @jest-environment node */

import { cookies } from 'next/headers';
import { GET } from '@/app/api/handoff-targets/route';
import { saveEnv } from '@/test/server/env';

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

const KEYCLOAK_TARGETS = 'https://e.yildizskylab.com/realms/e-skylab/sky-handoff/v1/admin/targets';

function accessToken(expiresInSeconds = 300): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({ sub: 'admin-1', exp: Math.floor(Date.now() / 1000) + expiresInSeconds }),
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
  const set = jest.fn();
  (cookies as jest.Mock).mockResolvedValue({
    get: (name: string) => (name in values ? { name, value: values[name] } : undefined),
    set,
    delete: jest.fn(),
  });
  return { set };
}

describe('GET /api/handoff-targets', () => {
  const issuer = process.env.OAUTH2_ISSUER;

  const realFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OAUTH2_ISSUER = 'https://e.yildizskylab.com/realms/e-skylab/';
  });

  afterAll(() => {
    process.env.OAUTH2_ISSUER = issuer;
    global.fetch = realFetch;
  });

  it("lists handoff targets from Keycloak with the signed-in admin's access token", async () => {
    const token = accessToken();
    signedIn({ auth_token: token });
    const targets = [
      {
        clientId: 'skyforms',
        name: 'SkyForms',
        rootUrl: 'https://forms.yildizskylab.com',
        enabled: true,
        signInPath: '/auth/signin',
        returnParam: 'callbackUrl',
      },
      {
        clientId: 'account-center',
        name: null,
        rootUrl: 'https://my.yildizskylab.com',
        enabled: null,
        signInPath: null,
        returnParam: null,
      },
    ];
    const seen = fakeKeycloak(() => Response.json(targets));

    const response = await GET();

    expect(seen).toHaveLength(1);
    expect(seen[0].method).toBe('GET');
    expect(seen[0].url).toBe(KEYCLOAK_TARGETS);
    expect(seen[0].headers.get('authorization')).toBe(`Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(targets);
  });

  it('answers 401 without calling Keycloak when there is no session', async () => {
    signedIn({});
    const seen = fakeKeycloak(() => Response.json([]));

    const response = await GET();

    expect(seen).toHaveLength(0);
    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(await response.json()).toMatchObject({
      status: 401,
      detail: 'Oturumun sona ermiş. Yeniden giriş yap.',
    });
  });

  describe('with Secure (__Host-) session cookies', () => {
    afterEach(saveEnv('AUTH_COOKIE_SECURE'));

    it('answers 401 without calling Keycloak when only a legacy unprefixed session cookie is present', async () => {
      process.env.AUTH_COOKIE_SECURE = 'true';
      signedIn({ auth_token: accessToken(), refresh_token: 'refresh-1' });
      const seen = fakeKeycloak(() => Response.json([]));

      const response = await GET();

      expect(seen).toHaveLength(0);
      expect(response.status).toBe(401);
    });
  });

  it('refreshes an expired access token and keeps the new session in httpOnly cookies', async () => {
    const fresh = accessToken();
    const { set } = signedIn({ auth_token: accessToken(-60), refresh_token: 'refresh-1' });
    process.env.OAUTH2_CLIENT_ID = 'superadmin';
    const seen = fakeKeycloak((request) =>
      request.url.endsWith('/protocol/openid-connect/token')
        ? Response.json({ access_token: fresh, refresh_token: 'refresh-2' })
        : Response.json([]),
    );

    const response = await GET();

    expect(response.status).toBe(200);
    expect(seen.map((request) => request.url)).toEqual([
      'https://e.yildizskylab.com/realms/e-skylab/protocol/openid-connect/token',
      KEYCLOAK_TARGETS,
    ]);
    expect(seen[1].headers.get('authorization')).toBe(`Bearer ${fresh}`);
    expect(set).toHaveBeenCalledWith(
      'auth_token',
      fresh,
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
    expect(set).toHaveBeenCalledWith(
      'refresh_token',
      'refresh-2',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
  });

  it("relays Keycloak's 403 problem so the page can hide itself", async () => {
    signedIn({ auth_token: accessToken() });
    fakeKeycloak(() =>
      Response.json(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          detail: 'Bu işlem için realm süper yöneticisi olmalısın.',
        },
        { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );

    const response = await GET();

    expect(response.status).toBe(403);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(await response.json()).toEqual({
      type: 'about:blank',
      title: 'Forbidden',
      status: 403,
      detail: 'Bu işlem için realm süper yöneticisi olmalısın.',
    });
  });

  it.each([
    ['is unreachable', () => Promise.reject(new TypeError('fetch failed'))],
    [
      'answers with an HTML error page',
      () => new Response('<html>Bad gateway</html>', { status: 502 }),
    ],
  ])('answers 502 when Keycloak %s', async (_name, keycloakAnswer) => {
    signedIn({ auth_token: accessToken() });
    fakeKeycloak(keycloakAnswer as KeycloakHandler);

    const response = await GET();

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      status: 502,
      detail: 'Keycloak şu an yanıt vermiyor. Biraz sonra tekrar dene.',
    });
  });

  it('says the sky-handoff admin API is missing when Keycloak does not know the path', async () => {
    signedIn({ auth_token: accessToken() });
    fakeKeycloak(() =>
      Response.json({ error: 'Unable to find matching target resource method' }, { status: 404 }),
    );

    const response = await GET();

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      status: 502,
      detail:
        "Keycloak'ta SkyApp geçiş yönetimi bulunamadı; sky-handoff eklentisi henüz kurulu olmayabilir.",
    });
  });

  it('keeps a bare 403 from Keycloak a 403', async () => {
    signedIn({ auth_token: accessToken() });
    fakeKeycloak(() => Response.json({ error: 'insufficient_scope' }, { status: 403 }));

    const response = await GET();

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      status: 403,
      detail: 'Bu işlem için realm süper yöneticisi olmalısın.',
    });
  });
});
