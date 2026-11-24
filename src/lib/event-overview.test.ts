import {
  capacityFill,
  certificateRuleLabel,
  checkInsBySession,
  eventInitials,
  eventReadiness,
  eventShareLinks,
  eventWhenLong,
  latestRegistrations,
  sessionClock,
  sessionNowAndNext,
} from './event-overview';
import type { EventSession } from './api/sessions';

const session = (id: string, start?: string, end?: string, extra: Partial<EventSession> = {}) =>
  ({
    id,
    eventDayId: 'd1',
    title: id,
    speakerName: '',
    orderIndex: 0,
    sessionType: 'TALK',
    startTime: start,
    endTime: end,
    ...extra,
  }) as EventSession;

describe('eventReadiness', () => {
  it('ticks what the event has and points each open item where it is filled', () => {
    const items = eventReadiness(
      {
        id: 'e1',
        startDate: '2026-12-12T19:00:00+03:00',
        location: 'Kütüphane',
        coverImageUrl: undefined,
        description: '  ',
        formUrl: undefined,
      },
      0,
    );
    expect(items.filter((item) => item.done).map((item) => item.key)).toEqual(['date', 'place']);
    expect(items.find((item) => item.key === 'form')?.href).toBe('/events/e1/edit#basvuru');
    expect(items.find((item) => item.key === 'program')?.href).toBe('/events/e1/program');
    // No limit on places and no certificate are choices, not gaps
    expect(items.map((item) => item.key)).toEqual([
      'date',
      'place',
      'cover',
      'description',
      'form',
      'program',
    ]);
  });

  it('is all done for a filled event', () => {
    const items = eventReadiness(
      {
        id: 'e1',
        startDate: '2026-12-12T19:00:00+03:00',
        location: 'Kütüphane',
        coverImageUrl: 'covers/a.png',
        description: 'Gece boyu kod',
        formUrl: 'https://forms.example.test/x',
      },
      3,
    );
    expect(items.every((item) => item.done)).toBe(true);
  });
});

describe('sessionNowAndNext', () => {
  const sessions = [
    session('block', '2026-11-22T10:00:00+03:00', '2026-11-22T23:59:00+03:00'),
    session('talk', '2026-11-22T20:00:00+03:00', '2026-11-22T21:00:00+03:00'),
    session('jury', '2026-11-23T13:00:00+03:00', '2026-11-23T16:00:00+03:00'),
    session('gone', '2026-11-22T20:30:00+03:00', '2026-11-22T22:00:00+03:00', { cancelled: true }),
    session('untimed'),
  ];

  it('takes the one that started last when two run at once', () => {
    const { current, next } = sessionNowAndNext(sessions, new Date('2026-11-22T20:15:00+03:00'));
    expect(current?.id).toBe('talk');
    expect(next?.id).toBe('jury');
  });

  it('has nothing running between sessions and none after the last', () => {
    expect(sessionNowAndNext(sessions, new Date('2026-11-23T09:00:00+03:00'))).toEqual({
      current: null,
      next: sessions[2],
    });
    expect(sessionNowAndNext(sessions, new Date('2026-11-24T09:00:00+03:00'))).toEqual({
      current: null,
      next: null,
    });
  });
});

it('writes a session clock in Istanbul time', () => {
  expect(sessionClock(session('a', '2026-11-22T09:00:00+03:00', '2026-11-22T10:30:00+03:00'))).toBe(
    '09:00–10:30',
  );
  expect(sessionClock(session('a', '2026-11-22T09:00:00+03:00'))).toBe('09:00');
  expect(sessionClock(session('a'))).toBe('');
});

it('counts each registration once per session it entered', () => {
  const counts = checkInsBySession([
    { checkIns: [{ sessionId: 's1' }, { sessionId: 's1' }, { sessionId: 's2' }] },
    { checkIns: [{ sessionId: 's1' }] },
    { checkIns: [] },
  ] as never);
  expect(Object.fromEntries(counts)).toEqual({ s1: 2, s2: 1 });
});

it('lists the latest registrations first', () => {
  const rows = latestRegistrations(
    [
      { id: 'a', createdAt: '2026-11-01T10:00:00Z' },
      { id: 'b', createdAt: '2026-11-03T10:00:00Z' },
      { id: 'c', createdAt: '2026-11-02T10:00:00Z' },
    ],
    2,
  );
  expect(rows.map((row) => row.id)).toEqual(['b', 'c']);
});

it('measures capacity only when there is one', () => {
  expect(capacityFill(30, 120)).toEqual({ ratio: 0.25, left: 90 });
  expect(capacityFill(130, 120)).toEqual({ ratio: 130 / 120, left: 0 });
  expect(capacityFill(30, 0)).toBeNull();
});

it('gives the short link of each form to hand out', () => {
  expect(
    eventShareLinks({
      formUrl: 'https://forms.example.test/1',
      formAlias: 'hackathon26',
      extraFormUrls: [{ label: 'Mentor başvurusu', url: 'https://forms.example.test/2' }],
      feedbackFormUrl: 'https://forms.example.test/3',
      feedbackFormAlias: 'hackathon26-geri',
    }).map((link) => [link.label, link.url.replace(/^https?:\/\/[^/]+/, ''), link.alias]),
  ).toEqual([
    ['Başvuru formu', '/hackathon26', 'hackathon26'],
    ['Mentor başvurusu', '/2', undefined],
    ['Geri bildirim formu', '/hackathon26-geri', 'hackathon26-geri'],
  ]);
  expect(eventShareLinks({})).toEqual([]);
});

it('names the certificate rule as the edit page does', () => {
  expect(certificateRuleLabel({ attendanceRule: 'none' })).toBe('Yok');
  expect(certificateRuleLabel({ attendanceRule: 'once' })).toBe('En az bir oturum');
  expect(certificateRuleLabel({ attendanceRule: 'ratio', attendanceRatio: 0.5 })).toBe(
    "Oturumların %50'si",
  );
  expect(certificateRuleLabel({ attendanceRule: 'ratio', attendanceRatio: 0.75 })).toBe(
    "Oturumların %75'i",
  );
  expect(certificateRuleLabel({ attendanceRule: 'count' })).toBe("Oturumların %75'i");
  expect(certificateRuleLabel({ attendanceRule: 'count', attendanceMinCount: 6 })).toBe(
    'En az 6 oturum',
  );
});

it('writes the date in full, the end clock alone on the same day', () => {
  expect(
    eventWhenLong({ startDate: '2026-11-08T19:00:00+03:00', endDate: '2026-11-08T21:00:00+03:00' }),
  ).toMatch(/^8 Kasım 2026 .* 19:00 – 21:00$/);
  expect(
    eventWhenLong({ startDate: '2026-11-22T09:00:00+03:00', endDate: '2026-11-23T18:00:00+03:00' }),
  ).toMatch(/^22 Kasım 2026 .* 09:00 – 23 Kasım 2026 .* 18:00$/);
  expect(eventWhenLong({})).toBe('');
});

it('takes two initials for a cover placeholder, skipping a year', () => {
  expect(eventInitials('Yıldız Hackathon 2026')).toBe('YH');
  expect(eventInitials(' işletme günü')).toBe('İG');
  expect(eventInitials('2026')).toBe('20');
});
