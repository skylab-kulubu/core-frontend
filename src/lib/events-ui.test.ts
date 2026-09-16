import {
  canCheckInForTeam,
  canManageCompetitors,
  canWriteEvent,
  canWriteSeason,
  isLeader,
} from '@/lib/auth/groups';
import { eventsApi } from '@/lib/api/events';
import { seasonsApi } from '@/lib/api/seasons';
import { ticketsApi } from '@/lib/api/tickets';
import { ProblemError } from '@/lib/api/core';
import { eventTypesApi } from '@/lib/api/event-types';

function jsonRes(body: unknown, status = 200): Response {
  const text = status === 204 ? '' : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => body,
  } as Response;
}

describe('event write policy', () => {
  it('Leader of owner team can update', () => {
    expect(canWriteEvent(['/UYELER/ARGE/WEBLAB/LIDERLER'], 'WEBLAB', 'update')).toBe(true);
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
          { id: 'c1', ticketId: 't1', eventDayId: 'd1', createdAt: '2026-01-01T00:00:00Z' },
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

  it('event types list is public teams, not Java EventType', async () => {
    const rows = await eventTypesApi.list();
    expect(rows[0].team).toBe('WEBLAB');
    expect(rows[0]).not.toHaveProperty('success');
  });

  it('check-in returns CheckIn resource', async () => {
    const created = await ticketsApi.checkIn('t1', 'd1');
    expect(created.id).toBe('c1');
    expect(created).not.toHaveProperty('success');
  });

  it('event tickets list is a resource array', async () => {
    const rows = await ticketsApi.listByEvent('e1');
    expect(Array.isArray(rows)).toBe(true);
    expect(rows[0]).toMatchObject({ id: 't1', eventId: 'e1', ticketType: 'REGISTERED' });
    expect(rows[0]).not.toHaveProperty('success');
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
});
