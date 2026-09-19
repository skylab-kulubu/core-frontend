import {
  canCheckInForTeam,
  canManageCompetitors,
  canModerateUrls,
  canUseUrls,
  canWriteEvent,
  canWriteSeason,
  isLeader,
} from '@/lib/auth/groups';
import { eventsApi } from '@/lib/api/events';
import { seasonsApi } from '@/lib/api/seasons';
import { ticketsApi } from '@/lib/api/tickets';
import { mediaApi } from '@/lib/api/media';
import { urlsApi, shortQrFileName, shortQrUrl } from '@/lib/api/urls';
import { identityApi } from '@/lib/api/identity';
import { CORE_API_URL, coreFetchBlob, ProblemError } from '@/lib/api/core';
import { teamsApi } from '@/lib/api/teams';
import { emptyEventForm, parseDoorStaffIds } from '@/components/scheduling/EventEditor';
import { eventBodyFromForm, saveEventWithSeason } from '@/lib/scheduling/save-event';
import { sessionQrFileName, sessionQrUrl } from '@/lib/api/sessions';
import {
  canAssignEventTicket,
  canDeskCheckIn,
  canListEventTickets,
  ticketApplicantLabel,
} from '@/lib/tickets-ui';

function jsonRes(body: unknown, status = 200): Response {
  const text = status === 204 ? '' : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => body,
  } as Response;
}

describe('url access from JWT client roles', () => {
  it('Privileged can use and moderate without url roles', () => {
    expect(canUseUrls(['/UYELER/YK'], [])).toBe(true);
    expect(canModerateUrls(['/UYELER/YK'], [])).toBe(true);
  });
  it('url:create can use but not moderate', () => {
    expect(canUseUrls(['/UYELER/ARGE/WEBLAB'], ['url:create'])).toBe(true);
    expect(canModerateUrls(['/UYELER/ARGE/WEBLAB'], ['url:create'])).toBe(false);
  });
  it('skylapp:moderator can moderate', () => {
    expect(canModerateUrls(['/UYELER/ARGE/WEBLAB'], ['skylapp:moderator'])).toBe(true);
  });
});

describe('event write policy', () => {
  it('Leader of owner team can update', () => {
    expect(canWriteEvent(['/UYELER/ARGE/WEBLAB/LIDERLER'], 'WEBLAB', 'update')).toBe(true);
  });
  it('Privileged can write events with no owner team', () => {
    expect(canWriteEvent(['/UYELER/YK'], '', 'create')).toBe(true);
    expect(canWriteEvent(['/UYELER/ARGE/WEBLAB/LIDERLER'], '', 'create')).toBe(false);
  });
  it('other team Leader cannot', () => {
    expect(canWriteEvent(['/UYELER/ARGE/SKYSEC/LIDERLER'], 'WEBLAB', 'update')).toBe(false);
  });
  it('GECEKODU member can create', () => {
    expect(canWriteEvent(['/UYELER/ORGANIZASYON/GECEKODU'], 'GECEKODU', 'create')).toBe(true);
  });
  it('plain member cannot create default team event', () => {
    expect(canWriteEvent(['/UYELER/ARGE/WEBLAB'], 'WEBLAB', 'create')).toBe(false);
  });
  it('Leader is detected from LIDERLER path', () => {
    expect(isLeader(['/UYELER/ARGE/WEBLAB/LIDERLER'])).toBe(true);
    expect(isLeader(['/UYELER/ARGE/WEBLAB'])).toBe(false);
  });
  it('season write is Privileged only', () => {
    expect(canWriteSeason(['/UYELER/YK'])).toBe(true);
    expect(canWriteSeason(['/UYELER/ARGE/WEBLAB/LIDERLER'])).toBe(false);
  });
  it('Leader manages competitors for owner team only', () => {
    expect(canManageCompetitors(['/UYELER/ARGE/WEBLAB/LIDERLER'], 'WEBLAB')).toBe(true);
    expect(canManageCompetitors(['/UYELER/ARGE/WEBLAB/LIDERLER'], 'SKYSEC')).toBe(false);
    expect(canManageCompetitors(['/UYELER/YK'], 'WEBLAB')).toBe(true);
  });
  it('Leader lists tickets for owner team only', () => {
    expect(canCheckInForTeam(['/UYELER/ARGE/WEBLAB/LIDERLER'], 'WEBLAB')).toBe(true);
    expect(canCheckInForTeam(['/UYELER/ARGE/WEBLAB'], 'WEBLAB')).toBe(false);
    expect(canCheckInForTeam(['/UYELER/YK'], 'WEBLAB')).toBe(true);
  });
  it('Event organizers see the applicant roster', () => {
    expect(canListEventTickets(['/UYELER/ARGE/WEBLAB/LIDERLER'], 'WEBLAB')).toBe(true);
    expect(canListEventTickets(['/UYELER/ARGE/WEBLAB'], 'WEBLAB')).toBe(false);
    expect(canListEventTickets(['/UYELER/ORGANIZASYON/GECEKODU'], 'GECEKODU')).toBe(true);
    expect(
      ticketApplicantLabel(
        {
          id: 't1',
          eventId: 'e1',
          ticketType: 'GUEST',
          guestFirstName: 'Ada',
          guestLastName: 'Lovelace',
          guestEmail: 'ada@example.com',
          checkIns: [],
          createdAt: '',
          updatedAt: '',
        },
        new Map(),
      ),
    ).toBe('Ada Lovelace · ada@example.com');
  });
  it('GECEKODU member can write the event but cannot desk check-in on the hub', () => {
    const gece = ['/UYELER/ORGANIZASYON/GECEKODU'];
    expect(canWriteEvent(gece, 'GECEKODU', 'update')).toBe(true);
    expect(canListEventTickets(gece, 'GECEKODU')).toBe(true);
    expect(canDeskCheckIn(gece, 'GECEKODU')).toBe(false);
    expect(canDeskCheckIn(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER'], 'GECEKODU')).toBe(true);
    expect(canDeskCheckIn(['/UYELER/YK'], 'GECEKODU')).toBe(true);
  });
  it('apply-for-other is Ticket Assign, not write-event', () => {
    const gece = ['/UYELER/ORGANIZASYON/GECEKODU'];
    expect(canAssignEventTicket(gece, 'GECEKODU')).toBe(false);
    expect(canAssignEventTicket(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER'], 'GECEKODU')).toBe(true);
    expect(canAssignEventTicket(['/UYELER/YK'], 'GECEKODU')).toBe(true);
    expect(canAssignEventTicket(['/UYELER/ARGE/WEBLAB/LIDERLER'], '')).toBe(false);
    expect(canAssignEventTicket(['/UYELER/YK'], '')).toBe(true);
  });
});

describe('scheduling clients speak RFC 7807 resources', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) {
        return jsonRes({ token: 't' });
      }
      if (url.includes('/v1/events') && !url.includes('/days') && !url.includes('/tickets')) {
        return jsonRes([{ id: 'e1', name: 'Hack', ownerTeam: 'WEBLAB' }]);
      }
      if (url.includes('/v1/seasons')) {
        return jsonRes([{ id: 's1', name: '2026', active: true }]);
      }
      if (url.includes('/v1/teams')) {
        return jsonRes([
          { team: 'WEBLAB', path: '/UYELER/ARGE/WEBLAB', displayName: { tr: 'Web' } },
        ]);
      }
      if (url.includes('/check-in')) {
        return jsonRes(
          {
            id: 'c1',
            ticketId: 't1',
            sessionId: 's1',
            eventDayId: 'd1',
            createdAt: '2026-01-01T00:00:00Z',
          },
          201,
        );
      }
      if (url.includes('/tickets')) {
        return jsonRes([
          {
            id: 't1',
            eventId: 'e1',
            ticketType: 'REGISTERED',
            ownerId: 'u1',
            checkIns: [],
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ]);
      }
      if (url.includes('/v1/urls')) {
        return jsonRes([
          {
            id: 'u1',
            alias: 'hack',
            url: 'https://skylab.com',
            clickCount: 3,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ]);
      }
      if (url.includes('/v1/media')) {
        return jsonRes([
          {
            id: 'm1',
            name: 'dot.png',
            type: 'image/png',
            url: 'https://cdn.example.test/images/m1',
            size: 12,
            uploadedBy: 'u1',
            kind: 'IMAGE',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ]);
      }
      return jsonRes({ title: 'Forbidden' }, 403);
    }) as typeof fetch;
  });

  it('events list is a resource array, not a success/data envelope', async () => {
    const rows = await eventsApi.list();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows[0]).toMatchObject({ id: 'e1', name: 'Hack' });
    expect(rows[0]).not.toHaveProperty('success');
    expect(rows).not.toHaveProperty('data');
    expect(rows).not.toHaveProperty('success');
  });

  it('seasons list does not wrap data', async () => {
    const rows = await seasonsApi.list();
    expect(rows[0].name).toBe('2026');
    expect(Object.keys(rows[0]).includes('success')).toBe(false);
  });

  it('public teams list is not a Java EventType table', async () => {
    const rows = await teamsApi.list();
    expect(rows[0].team).toBe('WEBLAB');
    expect(rows[0]).not.toHaveProperty('success');
  });

  it('check-in posts to session path, not EventDay', async () => {
    const created = await ticketsApi.checkIn('t1', 's1');
    expect(created.id).toBe('c1');
    expect(created.sessionId).toBe('s1');
    expect(created).not.toHaveProperty('success');
    const urls = (global.fetch as jest.Mock).mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('/v1/tickets/t1/sessions/s1/check-in'))).toBe(true);
    expect(urls.some((url) => url.includes('/event-days/'))).toBe(false);
  });

  it('event tickets list is a resource array', async () => {
    const rows = await ticketsApi.listByEvent('e1');
    expect(Array.isArray(rows)).toBe(true);
    expect(rows[0]).toMatchObject({ id: 't1', eventId: 'e1', ticketType: 'REGISTERED' });
    expect(rows[0]).not.toHaveProperty('success');
  });

  it('ticket detail is GET /v1/tickets/:id, not a list envelope', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) return jsonRes({ token: 't' });
      if (url.includes('/v1/tickets/t1') && !url.includes('/sessions')) {
        return jsonRes({
          id: 't1',
          eventId: 'e1',
          ticketType: 'GUEST',
          guestFirstName: 'Ada',
          guestLastName: 'Lovelace',
          guestEmail: 'ada@example.com',
          checkIns: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        });
      }
      return jsonRes({ title: 'Forbidden' }, 403);
    }) as typeof fetch;
    const ticket = await ticketsApi.get('t1');
    expect(ticket).toMatchObject({
      id: 't1',
      ticketType: 'GUEST',
      guestEmail: 'ada@example.com',
    });
    expect(ticket).not.toHaveProperty('success');
    const urls = (global.fetch as jest.Mock).mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('/v1/tickets/t1'))).toBe(true);
    expect(urls.some((url) => url.includes('/api/tickets'))).toBe(false);
  });

  it('member apply posts to applications/me, not a public form', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) return jsonRes({ token: 't' });
      if (url.includes('/applications/me')) {
        expect(init?.method).toBe('POST');
        return jsonRes(
          {
            id: 't2',
            eventId: 'e1',
            ticketType: 'REGISTERED',
            ownerId: 'u1',
            checkIns: [],
          },
          201,
        );
      }
      return jsonRes({ title: 'Forbidden' }, 403);
    }) as typeof fetch;
    const ticket = await ticketsApi.applyMe('e1');
    expect(ticket).toMatchObject({ ticketType: 'REGISTERED', ownerId: 'u1' });
    const urls = (global.fetch as jest.Mock).mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('/v1/events/e1/applications/me'))).toBe(true);
    expect(urls.some((url) => url.includes('formUrl') || url.includes('skyforms'))).toBe(false);
  });

  it('event mail list posts to /v1/events/:id/mail-list', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) return jsonRes({ token: 't' });
      if (url.includes('/mail-list')) {
        expect(init?.method).toBe('POST');
        return jsonRes({
          mailListId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          name: 'WEBLAB SkyDays',
          recipientCount: 2,
        });
      }
      return jsonRes({ title: 'Forbidden' }, 403);
    }) as typeof fetch;
    const got = await eventsApi.syncMailList('e1');
    expect(got).toMatchObject({
      mailListId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      recipientCount: 2,
    });
    const urls = (global.fetch as jest.Mock).mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('/v1/events/e1/mail-list'))).toBe(true);
  });

  it('media list is a resource array', async () => {
    const rows = await mediaApi.list();
    expect(rows[0]).toMatchObject({ id: 'm1', name: 'dot.png' });
    expect(rows[0]).not.toHaveProperty('success');
  });

  it('url list is a resource array, not a DataResult envelope', async () => {
    const rows = await urlsApi.listMine();
    expect(rows[0]).toMatchObject({ id: 'u1', alias: 'hack' });
    expect(rows[0]).not.toHaveProperty('success');
    expect(rows).not.toHaveProperty('data');
  });

  it('short QR PNG is Go /v1/go/:alias/qr with club logo, not Java /api/qr-codes', () => {
    expect(shortQrUrl('hack')).toBe(`${CORE_API_URL}/v1/go/hack/qr?logo=1`);
    expect(shortQrUrl('hack')).not.toContain('/api/qr-codes');
  });

  it('short QR download prefers size 1024 and names the PNG after the alias', () => {
    expect(shortQrUrl('hack', { size: 1024 })).toBe(
      `${CORE_API_URL}/v1/go/hack/qr?logo=1&size=1024`,
    );
    expect(shortQrFileName('hack')).toBe('skylapp-hack.png');
  });

  it('session QR PNG is Go /v1/sessions/:id/qr with club logo', () => {
    expect(sessionQrUrl('s1')).toBe(`${CORE_API_URL}/v1/sessions/s1/qr?logo=1`);
  });

  it('session QR download prefers size 1024', () => {
    expect(sessionQrUrl('s1', { size: 1024 })).toBe(
      `${CORE_API_URL}/v1/sessions/s1/qr?logo=1&size=1024`,
    );
  });

  it('session QR download uses the session title when present', () => {
    expect(sessionQrFileName('s1', 'Açılış')).toBe('oturum-Açılış.png');
    expect(sessionQrFileName('s1')).toBe('oturum-s1.png');
  });

  it('QR PNG download fetches CORE with bearer', async () => {
    const calls: { url: string; auth?: string }[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) return jsonRes({ token: 'tok' });
      const headers = init?.headers as Record<string, string> | undefined;
      calls.push({ url, auth: headers?.Authorization });
      return {
        ok: true,
        status: 200,
        blob: async () => new Blob(['png']),
        text: async () => '',
      } as Response;
    }) as typeof fetch;
    const blob = await coreFetchBlob('/v1/go/hack/qr?logo=1&size=1024');
    expect(blob).toBeInstanceOf(Blob);
    expect(calls).toEqual([
      { url: `${CORE_API_URL}/v1/go/hack/qr?logo=1&size=1024`, auth: 'Bearer tok' },
    ]);
  });

  it('admin profile PATCH is /v1/users/:id and omits uid, sky number, and password', async () => {
    const calls: { url: string; method?: string; body?: string }[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) return jsonRes({ token: 't' });
      calls.push({ url, method: init?.method, body: String(init?.body ?? '') });
      return jsonRes({
        id: 'u1',
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        university: 'YTÜ',
        phone: '555',
        groups: [],
        inheritedRoles: [],
        extraRoles: [],
      });
    }) as typeof fetch;
    const card = await identityApi.updateUser('u1', {
      university: 'YTÜ',
      faculty: 'Elektrik',
      department: 'Bilgisayar',
      linkedin: 'https://linkedin.com/in/ada',
      phone: '555',
    });
    expect(card.university).toBe('YTÜ');
    expect(card.phone).toBe('555');
    expect(calls.some((c) => c.method === 'PATCH' && c.url.includes('/v1/users/u1'))).toBe(true);
    const body = JSON.parse(calls.find((c) => c.method === 'PATCH')?.body ?? '{}') as Record<
      string,
      unknown
    >;
    expect(body).toEqual({
      university: 'YTÜ',
      faculty: 'Elektrik',
      department: 'Bilgisayar',
      linkedin: 'https://linkedin.com/in/ada',
      phone: '555',
    });
    expect(body).not.toHaveProperty('skyNumber');
    expect(body).not.toHaveProperty('studentCardUid');
    expect(body).not.toHaveProperty('password');
    expect(calls.some((c) => c.url.includes('/api/users'))).toBe(false);
  });

  it('apply-for-other posts to applications/users/:userId, not applications/me', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) return jsonRes({ token: 't' });
      if (url.includes('/applications/users/u1')) {
        expect(init?.method).toBe('POST');
        return jsonRes(
          {
            id: 't-other',
            eventId: 'e1',
            ticketType: 'REGISTERED',
            ownerId: 'u1',
            checkIns: [],
          },
          201,
        );
      }
      return jsonRes({ title: 'Forbidden' }, 403);
    }) as typeof fetch;
    const ticket = await ticketsApi.applyForOther('e1', 'u1');
    expect(ticket).toMatchObject({ ticketType: 'REGISTERED', ownerId: 'u1' });
    const urls = (global.fetch as jest.Mock).mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('/v1/events/e1/applications/users/u1'))).toBe(true);
    expect(urls.some((url) => url.includes('/applications/other'))).toBe(false);
    expect(urls.some((url) => url.includes('/applications/me'))).toBe(false);
  });

  it('guest apply posts name, surname, email, and phone to applications/guest', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) return jsonRes({ token: 't' });
      if (url.includes('/applications/guest')) {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.com',
          phoneNumber: '555',
        });
        return jsonRes(
          {
            id: 't-guest',
            eventId: 'e1',
            ticketType: 'GUEST',
            guestEmail: 'ada@example.com',
            checkIns: [],
          },
          201,
        );
      }
      return jsonRes({ title: 'Forbidden' }, 403);
    }) as typeof fetch;
    const ticket = await ticketsApi.applyGuest('e1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phoneNumber: '555',
    });
    expect(ticket).toMatchObject({ ticketType: 'GUEST', guestEmail: 'ada@example.com' });
    const urls = (global.fetch as jest.Mock).mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('/v1/events/e1/applications/guest'))).toBe(true);
    expect(urls.some((url) => url.includes('/api/events') || url.includes('/api/tickets'))).toBe(
      false,
    );
  });

  it('short URL hits are a resource array and keep empty userId', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) return jsonRes({ token: 't' });
      if (url.includes('/v1/urls/u1/hits')) {
        return jsonRes([
          {
            id: 'h1',
            urlId: 'u1',
            alias: 'club',
            createdAt: '2026-09-19T08:00:00Z',
            ip: '203.0.113.10',
            userAgent: 'Mozilla/5.0',
            referer: 'https://instagram.com/',
            userId: '',
          },
        ]);
      }
      return jsonRes({ title: 'Forbidden' }, 403);
    }) as typeof fetch;
    const rows = await urlsApi.listHits('u1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'h1',
      urlId: 'u1',
      alias: 'club',
      createdAt: '2026-09-19T08:00:00Z',
      ip: '203.0.113.10',
      userAgent: 'Mozilla/5.0',
      referer: 'https://instagram.com/',
      userId: '',
    });
    expect(rows[0]).not.toHaveProperty('time');
    expect(rows[0]).not.toHaveProperty('user');
    expect(rows[0]).not.toHaveProperty('success');
    const urls = (global.fetch as jest.Mock).mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('/v1/urls/u1/hits'))).toBe(true);
    expect(urls.some((url) => url.includes('/api/urls') || url.includes('/api/go'))).toBe(false);
  });

  it('problem+json becomes ProblemError', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) return jsonRes({ token: 't' });
      return jsonRes({ title: 'Forbidden', status: 403 }, 403);
    }) as typeof fetch;
    await expect(eventsApi.list()).rejects.toBeInstanceOf(ProblemError);
    await expect(eventsApi.list()).rejects.toMatchObject({ title: 'Forbidden', status: 403 });
  });

  it('create posts JSON body without multipart DataResult', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) return jsonRes({ token: 't' });
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      expect(init?.body).toBe(
        JSON.stringify({
          name: 'N',
          description: '',
          location: 'YTÜ',
          ownerTeam: 'WEBLAB',
          capacity: 0,
          active: true,
          ranked: false,
        }),
      );
      return jsonRes({ id: 'e2', name: 'N', ownerTeam: 'WEBLAB', location: 'YTÜ' }, 201);
    }) as typeof fetch;
    const created = await eventsApi.create({
      name: 'N',
      description: '',
      location: 'YTÜ',
      ownerTeam: 'WEBLAB',
      capacity: 0,
      active: true,
      ranked: false,
    });
    expect(created.name).toBe('N');
    expect(created).not.toHaveProperty('data');
    expect(calls.some((c) => c.startsWith('POST') && c.includes('/v1/events'))).toBe(true);
  });

  it('eventBodyFromForm sends formUrl as başvuru and extras separately', () => {
    const body = eventBodyFromForm({
      ...emptyEventForm('WEBLAB'),
      name: 'Skydays',
      location: 'YTÜ',
      formSlots: [
        {
          key: 'apply',
          label: 'Başvuru formu',
          mode: 'external',
          url: 'https://apply.example.test',
          alias: 'skydays2026',
        },
        {
          key: 'extra-ctf',
          label: 'CTF',
          mode: 'external',
          url: 'https://ctf.example.test',
          alias: 'skydays-ctf2026',
        },
      ],
    });
    expect(body.formUrl).toBe('https://apply.example.test');
    expect(body.formAlias).toBe('skydays2026');
    expect(body.extraFormUrls).toEqual([
      { label: 'CTF', url: 'https://ctf.example.test', alias: 'skydays-ctf2026' },
    ]);
  });

  it('eventBodyFromForm sends coverImageId as a resource field', () => {
    const body = eventBodyFromForm({
      ...emptyEventForm('WEBLAB'),
      name: 'Hack',
      location: 'YTÜ',
      coverImageId: 'm1',
    });
    expect(body.coverImageId).toBe('m1');
    expect(body).not.toHaveProperty('success');
  });

  it('eventBodyFromForm sends attendance rule on the event', () => {
    const body = eventBodyFromForm({
      ...emptyEventForm('WEBLAB'),
      name: 'ARTLAB',
      location: 'YTÜ',
      attendanceRule: 'ratio',
      attendanceRatio: 0.75,
    });
    expect(body.attendanceRule).toBe('ratio');
    expect(body.attendanceRatio).toBe(0.75);
  });

  it('parseDoorStaffIds splits a small list of user ids', () => {
    expect(
      parseDoorStaffIds(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa, bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      ),
    ).toEqual(['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']);
    expect(parseDoorStaffIds('')).toEqual([]);
  });

  it('eventBodyFromForm sends doorStaffIds for Superadmin assign', () => {
    const body = eventBodyFromForm({
      ...emptyEventForm('WEBLAB'),
      name: 'Hack',
      location: 'YTÜ',
      doorStaffIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'],
    });
    expect(body.doorStaffIds).toEqual(['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']);
  });

  it('eventBodyFromForm sends the reserved Event id so create keeps the Skyforms EventId', () => {
    const body = eventBodyFromForm({
      ...emptyEventForm('WEBLAB'),
      name: 'Hack',
      location: 'YTÜ',
      reservedId: '11111111-1111-4111-8111-111111111111',
    });
    expect(body.id).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('saveEventWithSeason attaches gallery image ids', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/token')) return jsonRes({ token: 't' });
      calls.push(`${init?.method ?? 'GET'} ${url} ${String(init?.body ?? '')}`);
      if (url.includes('/images')) {
        return jsonRes({ id: 'e2', images: [{ id: 'm2' }] });
      }
      return jsonRes({ id: 'e2', name: 'Hack', images: [] }, 201);
    }) as typeof fetch;
    await saveEventWithSeason({
      ...emptyEventForm('WEBLAB'),
      name: 'Hack',
      location: 'YTÜ',
      imageIds: ['m2'],
    });
    expect(
      calls.some(
        (c) => c.includes('POST') && c.includes('/v1/events/e2/images') && c.includes('m2'),
      ),
    ).toBe(true);
  });
});
