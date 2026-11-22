import { accessToken, forgetAccessToken, isKeptAccessToken } from '@/lib/auth/access-token';
import { coreFetch } from '@/lib/api/core';

// jsdom has no Response
function json(body: unknown, init: { status?: number } = {}): Response {
  const status = init.status ?? 200;
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => body,
  } as Response;
}

function tokenRoute(answers: Array<{ token: string | null; expiresIn?: number | null }>) {
  let i = 0;
  const route = jest.fn(async () => {
    const answer = answers[Math.min(i, answers.length - 1)];
    i += 1;
    return json(answer, { status: answer.token ? 200 : 401 });
  });
  return route;
}

describe('accessToken', () => {
  const realFetch = global.fetch;
  let now = 1_000_000;

  beforeEach(() => {
    forgetAccessToken();
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('asks the token route once for requests that start together', async () => {
    const route = tokenRoute([{ token: 'token-1', expiresIn: 300 }]);
    global.fetch = route as unknown as typeof fetch;

    const tokens = await Promise.all([accessToken(), accessToken(), accessToken()]);

    expect(tokens).toEqual(['token-1', 'token-1', 'token-1']);
    expect(route).toHaveBeenCalledTimes(1);
  });

  it('keeps the token until shortly before the server says it expires, then asks again', async () => {
    const route = tokenRoute([
      { token: 'token-1', expiresIn: 300 },
      { token: 'token-2', expiresIn: 300 },
    ]);
    global.fetch = route as unknown as typeof fetch;

    expect(await accessToken()).toBe('token-1');
    now += 289_000;
    expect(await accessToken()).toBe('token-1');
    expect(route).toHaveBeenCalledTimes(1);

    now += 2_000;
    expect(await accessToken()).toBe('token-2');
    expect(route).toHaveBeenCalledTimes(2);
  });

  it('does not keep a token whose lifetime the route does not give', async () => {
    const route = tokenRoute([{ token: 'token-1' }]);
    global.fetch = route as unknown as typeof fetch;

    await accessToken();
    await accessToken();

    expect(route).toHaveBeenCalledTimes(2);
    expect(isKeptAccessToken('token-1')).toBe(false);
  });

  it('keeps no token without a session', async () => {
    const route = tokenRoute([{ token: null }]);
    global.fetch = route as unknown as typeof fetch;

    expect(await accessToken()).toBeNull();
    expect(await accessToken()).toBeNull();
    expect(route).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['the window gets focus', () => window.dispatchEvent(new Event('focus'))],
    ['the tab is shown again', () => document.dispatchEvent(new Event('visibilitychange'))],
  ])('asks the route again when %s (another tab may have switched the person)', async (_, back) => {
    const route = tokenRoute([
      { token: 'token-X', expiresIn: 300 },
      { token: 'token-Y', expiresIn: 300 },
    ]);
    global.fetch = route as unknown as typeof fetch;

    expect(await accessToken()).toBe('token-X');
    back();
    expect(await accessToken()).toBe('token-Y');
    expect(route).toHaveBeenCalledTimes(2);
  });

  it('keeps the token while the tab is hidden', async () => {
    const route = tokenRoute([{ token: 'token-X', expiresIn: 300 }]);
    global.fetch = route as unknown as typeof fetch;
    const visibility = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

    await accessToken();
    document.dispatchEvent(new Event('visibilitychange'));
    await accessToken();

    expect(route).toHaveBeenCalledTimes(1);
    visibility.mockRestore();
  });

  it('a read that started before the token was dropped does not keep its answer', async () => {
    let release: (value: Response) => void = () => undefined;
    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    ) as unknown as typeof fetch;

    const early = accessToken();
    forgetAccessToken();
    release(json({ token: 'old', expiresIn: 300 }));
    await early;

    expect(isKeptAccessToken('old')).toBe(false);
  });
});

describe('coreFetch with a kept token', () => {
  const realFetch = global.fetch;

  beforeEach(() => forgetAccessToken());

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('reads the token once for several core requests', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/api/auth/token')) return json({ token: 't1', expiresIn: 300 });
      return json({ ok: true });
    }) as typeof fetch;

    await Promise.all([coreFetch('/v1/a'), coreFetch('/v1/b'), coreFetch('/v1/c')]);
    await coreFetch('/v1/d');

    expect(calls.filter((url) => url.includes('/api/auth/token'))).toHaveLength(1);
  });

  it('retries once with a new token when core refuses the kept one', async () => {
    const seen: Array<string | null> = [];
    let tokenReads = 0;
    let revoked = false;
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) {
        tokenReads += 1;
        return json({ token: `t${tokenReads}`, expiresIn: 300 });
      }
      const auth = (init?.headers as Record<string, string>).Authorization ?? null;
      seen.push(auth);
      return revoked && auth === 'Bearer t1'
        ? json({ title: 'Unauthorized' }, { status: 401 })
        : json({ id: 'e1' });
    }) as typeof fetch;

    await coreFetch('/v1/warm');
    revoked = true;
    const event = await coreFetch<{ id: string }>('/v1/events/e1');

    expect(event).toEqual({ id: 'e1' });
    expect(seen).toEqual(['Bearer t1', 'Bearer t1', 'Bearer t2']);
    expect(tokenReads).toBe(2);
  });

  it("sends the new person's token after coming back to the tab", async () => {
    const seen: string[] = [];
    let cookie = 'token-X';
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) return json({ token: cookie, expiresIn: 300 });
      seen.push((init?.headers as Record<string, string>).Authorization);
      return json({ ok: true });
    }) as typeof fetch;

    await coreFetch('/v1/a');
    cookie = 'token-Y';
    window.dispatchEvent(new Event('focus'));
    await coreFetch('/v1/b');

    expect(seen).toEqual(['Bearer token-X', 'Bearer token-Y']);
  });

  it('gives the 401 back when the new read returns the same token', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) return json({ token: 't1', expiresIn: 300 });
      return json({ title: 'Unauthorized' }, { status: 401 });
    }) as typeof fetch;

    await expect(coreFetch('/v1/events')).rejects.toMatchObject({ status: 401 });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
