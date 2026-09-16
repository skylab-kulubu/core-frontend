import { filterSidebarNavForUser } from '@/lib/navigation/sidebar-nav';
import { cmsBaseUrl, newsApi } from '@/lib/api/cms';
import { ProblemError } from '@/lib/api/core';
import type { UserDto } from '@/types/api';

function jsonRes(body: unknown, status = 200): Response {
  const text = status === 204 ? '' : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => body,
  } as Response;
}

const privileged: UserDto = {
  id: '1',
  username: 'yk',
  email: 'yk@example.com',
  firstName: 'Y',
  lastName: 'K',
  roles: [],
  groups: ['/UYELER/YK'],
};

const member: UserDto = {
  id: '2',
  username: 'm',
  email: 'm@example.com',
  firstName: 'M',
  lastName: 'M',
  roles: [],
  groups: ['/UYELER/ARGE/WEBLAB'],
};

const leader: UserDto = {
  id: '3',
  username: 'lead',
  email: 'lead@example.com',
  firstName: 'L',
  lastName: 'E',
  roles: [],
  groups: ['/UYELER/ARGE/WEBLAB/LIDERLER'],
};

describe('News nav is Privileged only', () => {
  it('Privileged sees Duyurular', () => {
    expect(filterSidebarNavForUser(privileged).map((l) => l.href)).toContain('/announcements');
  });

  it('member does not see Duyurular', () => {
    expect(filterSidebarNavForUser(member).map((l) => l.href)).not.toContain('/announcements');
  });

  it('Leader does not see Duyurular', () => {
    expect(filterSidebarNavForUser(leader).map((l) => l.href)).not.toContain('/announcements');
  });
});

describe('News writes go to CMS, not core', () => {
  const cmsHost = 'https://cms.test.example';
  const coreHost = 'https://core.test.example';

  beforeEach(() => {
    process.env.NEXT_PUBLIC_CMS_URL = cmsHost;
    process.env.NEXT_PUBLIC_API_URL = coreHost;
  });

  it('cmsBaseUrl is the CMS origin, not core', () => {
    expect(cmsBaseUrl()).toBe(cmsHost);
    expect(cmsBaseUrl()).not.toContain('core.test.example');
    expect(cmsBaseUrl()).not.toContain('api.yildizskylab.com');
  });

  it('create posts JSON to /cms/collections/News with the user token', async () => {
    const calls: { method: string; url: string; body: string; auth: string }[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) {
        return jsonRes({ token: 'privileged-jwt' });
      }
      const headers = new Headers(init?.headers);
      calls.push({
        method: init?.method ?? 'GET',
        url,
        body: String(init?.body ?? ''),
        auth: headers.get('Authorization') ?? '',
      });
      return jsonRes(
        {
          id: '11111111-1111-1111-1111-111111111111',
          collectionKey: 'News',
          slug: 'onemli-duyuru',
          data: { title: 'Önemli duyuru', body: 'Merhaba' },
          version: 1,
        },
        201,
      );
    }) as typeof fetch;

    const created = await newsApi.create({ title: 'Önemli duyuru', body: 'Merhaba' });

    expect(created.slug).toBe('onemli-duyuru');
    expect(created).not.toHaveProperty('success');
    expect(created.data).toEqual({ title: 'Önemli duyuru', body: 'Merhaba' });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe(`${cmsHost}/cms/collections/News`);
    expect(calls[0].url).not.toContain(coreHost);
    expect(calls[0].url).not.toContain('/api/announcements');
    expect(calls[0].auth).toBe('Bearer privileged-jwt');
    expect(JSON.parse(calls[0].body)).toEqual({
      data: { title: 'Önemli duyuru', body: 'Merhaba' },
    });
  });

  it('edit puts JSON to CMS slug, not core patch', async () => {
    const calls: { method: string; url: string }[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) {
        return jsonRes({ token: 'privileged-jwt' });
      }
      calls.push({ method: init?.method ?? 'GET', url });
      return jsonRes({
        id: '11111111-1111-1111-1111-111111111111',
        collectionKey: 'News',
        slug: 'onemli-duyuru',
        data: { title: 'Güncel', body: 'Yeni gövde' },
        version: 2,
      });
    }) as typeof fetch;

    await newsApi.update('onemli-duyuru', { title: 'Güncel', body: 'Yeni gövde' }, 1);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].url).toBe(`${cmsHost}/cms/collections/News/onemli-duyuru`);
    expect(calls[0].url).not.toContain(coreHost);
    expect(calls[0].url).not.toContain('/api/announcements');
    expect(calls[0].url).not.toContain('/v1/');
  });

  it('CMS problem+json becomes ProblemError', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) return jsonRes({ token: 'privileged-jwt' });
      return jsonRes({ title: 'Forbidden', status: 403, detail: 'User cannot create' }, 403);
    }) as typeof fetch;

    await expect(newsApi.create({ title: 'X', body: 'Y' })).rejects.toBeInstanceOf(ProblemError);
    await expect(newsApi.create({ title: 'X', body: 'Y' })).rejects.toMatchObject({
      title: 'Forbidden',
      status: 403,
    });
  });
});
