import type { CoreEvent } from '@/lib/api/events';
import type { Ticket } from '@/lib/api/tickets';
import { applicationsByDay, attentionItems, checkedIn, featuredEvent } from './insights';

const NOW = new Date('2026-10-03T12:00:00');

function event(id: string, startDate: string, extra: Partial<CoreEvent> = {}): CoreEvent {
  return {
    id,
    name: `Etkinlik ${id}`,
    description: '',
    location: '',
    ownerTeam: 'WEBLAB',
    capacity: 0,
    startDate,
    active: true,
    ranked: false,
    createdAt: '2026-09-01T00:00:00',
    updatedAt: '2026-09-01T00:00:00',
    formUrl: 'https://forms.example.com/f',
    coverImageUrl: 'https://cdn.example.com/c.png',
    ...extra,
  };
}

function ticket(createdAt: string, checkIns = 0): Ticket {
  return {
    id: createdAt,
    eventId: 'e',
    ticketType: 'GUEST',
    createdAt,
    updatedAt: createdAt,
    checkIns: Array.from({ length: checkIns }, () => ({}) as never),
  };
}

describe('featuredEvent', () => {
  it('prefers the event running now over the next one', () => {
    const running = event('a', '2026-10-03T10:00:00', { endDate: '2026-10-03T18:00:00' });
    const next = event('b', '2026-10-05T10:00:00');
    expect(featuredEvent([next, running], NOW)).toEqual({ event: running, live: true });
  });

  it('falls back to the nearest upcoming event', () => {
    const later = event('a', '2026-10-20T10:00:00');
    const sooner = event('b', '2026-10-05T10:00:00');
    expect(featuredEvent([later, sooner, event('c', '2026-09-01T10:00:00')], NOW)).toEqual({
      event: sooner,
      live: false,
    });
  });

  it('returns null when nothing is running or coming', () => {
    expect(featuredEvent([event('a', '2026-09-01T10:00:00')], NOW)).toBeNull();
  });
});

describe('applicationsByDay', () => {
  it('counts applications per day, oldest first', () => {
    const counts = applicationsByDay(
      [
        ticket('2026-10-03T09:00:00'),
        ticket('2026-10-03T11:00:00'),
        ticket('2026-10-01T08:00:00'),
        ticket('2026-09-01T08:00:00'),
      ],
      3,
      NOW,
    );
    expect(counts).toEqual([1, 0, 2]);
  });
});

describe('attentionItems', () => {
  it('flags upcoming events without a form, nearly full or without a cover', () => {
    const noForm = event('a', '2026-10-10T10:00:00', { formUrl: undefined });
    const full = event('b', '2026-10-12T10:00:00', { capacity: 10, coverImageUrl: undefined });
    const fine = event('c', '2026-10-15T10:00:00');
    const far = event('d', '2026-12-15T10:00:00', { formUrl: undefined });
    const tickets = new Map([
      ['b', Array.from({ length: 9 }, (_, i) => ticket(`2026-10-0${(i % 3) + 1}T08:00:00`))],
    ]);
    expect(
      attentionItems([full, fine, noForm, far], tickets, NOW).map((item) => [
        item.id,
        item.tone,
        item.messages,
      ]),
    ).toEqual([
      ['a', 'warning', ['Başvuru formu bağlanmamış']],
      ['b', 'warning', ["Kontenjanın %90'i dolu", 'Kapak görseli yok']],
    ]);
  });
});

describe('checkedIn', () => {
  it('counts applicants with at least one check-in', () => {
    expect(
      checkedIn([
        ticket('2026-10-01T08:00:00', 1),
        ticket('2026-10-01T08:00:00'),
        ticket('2026-10-01T08:00:00', 2),
      ]),
    ).toBe(2);
  });
});
