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
import { urlsApi, shortQrUrl } from '@/lib/api/urls';
import { sessionQrUrl } from '@/lib/api/sessions';
import { CORE_API_URL } from '@/lib/api/core';
import { ProblemError } from '@/lib/api/core';
import { teamsApi } from '@/lib/api/teams';
import { emptyEventForm, parseDoorStaffIds } from '@/components/scheduling/EventEditor';
import { eventBodyFromForm, saveEventWithSeason } from '@/lib/scheduling/save-event';
import { canListEventTickets, ticketApplicantLabel } from '@/lib/tickets-ui';

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

  it('short QR PNG is Go /v1/go/:alias/qr, not Java /api/qr-codes', () => {
    expect(shortQrUrl('hack')).toBe(`${CORE_API_URL}/v1/go/hack/qr`);
    expect(shortQrUrl('hack')).not.toContain('/api/qr-codes');
  });

  it('session QR PNG is Go /v1/sessions/:id/qr', () => {
    expect(sessionQrUrl('s1')).toBe(`${CORE_API_URL}/v1/sessions/s1/qr`);
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
