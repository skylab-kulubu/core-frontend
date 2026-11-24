import type { Ticket } from '@/lib/api/tickets';
import {
  capacityBelowTickets,
  capacityFigure,
  capacityFull,
  overCapacityLine,
  waitedFor,
  waitlistOrder,
  waitlistPlaces,
} from '@/lib/capacity';

const waiting = (id: string, waitlistedAt: string | undefined, createdAt: string) =>
  ({ id, waitlistedAt, createdAt }) as Ticket;

describe('capacity', () => {
  it('says the figure only for a bounded Event', () => {
    expect(capacityFigure(48, 50)).toBe('48/50');
    expect(capacityFigure(48, 0)).toBeNull();
    expect(capacityFigure(48, undefined)).toBeNull();
  });

  it('is full once the active tickets reach the capacity', () => {
    expect(capacityFull(49, 50)).toBe(false);
    expect(capacityFull(50, 50)).toBe(true);
    expect(capacityFull(500, 0)).toBe(false);
  });

  it('notices a capacity set below the tickets', () => {
    expect(capacityBelowTickets(40, 52)).toBe(true);
    expect(capacityBelowTickets(60, 52)).toBe(false);
    expect(capacityBelowTickets(0, 52)).toBe(false);
    expect(capacityBelowTickets(40, undefined)).toBe(false);
  });

  it('says how far past the capacity a write went', () => {
    expect(overCapacityLine(52, 50)).toBe('Kontenjan aşıldı (52/50)');
    expect(overCapacityLine(3, 0)).toBe('Kontenjan aşıldı');
  });
});

describe('waiting list', () => {
  const list = [
    waiting('c', '2026-11-22T10:00:00Z', '2026-11-20T10:00:00Z'),
    waiting('a', '2026-11-21T10:00:00Z', '2026-11-21T10:00:00Z'),
    waiting('b', undefined, '2026-11-21T12:00:00Z'),
  ];

  it('serves the longest waiting first, as core does', () => {
    expect(waitlistOrder(list).map((ticket) => ticket.id)).toEqual(['a', 'b', 'c']);
  });

  it('numbers the places from one', () => {
    const places = waitlistPlaces(list);
    expect(places.get('a')).toBe(1);
    expect(places.get('c')).toBe(3);
  });

  it('says how long a ticket has waited', () => {
    const now = Date.parse('2026-11-24T12:00:00Z');
    expect(waitedFor('2026-11-24T11:55:00Z', now)).toBe('5 dk');
    expect(waitedFor('2026-11-24T11:59:50Z', now)).toBe('1 dk');
    expect(waitedFor('2026-11-24T09:00:00Z', now)).toBe('3 saat');
    expect(waitedFor('2026-11-21T12:00:00Z', now)).toBe('3 gün');
    expect(waitedFor(undefined, now)).toBeNull();
    expect(waitedFor('yok', now)).toBeNull();
  });
});
