import type { DashboardHome, DashboardSummary, EventStat } from '@/lib/api/dashboard';
import { changeLabel, homeView, numberRows, todoRows, weekDays } from './home';

// Sunday 22 November 2026, 15:00 in Istanbul
const now = new Date('2026-11-22T12:00:00Z');

const emptyTodo: NonNullable<DashboardHome['todo']> = {
  drafts: [],
  incomplete: [],
  failedCertificates: [],
  subjectRequests: null,
};

describe('todoRows', () => {
  it('is null for a reader who can act on none of it', () => {
    expect(todoRows(null, now)).toBeNull();
  });

  it('puts data subject requests past due and failed certificates before gaps and drafts', () => {
    const rows = todoRows(
      {
        drafts: [
          {
            id: 'd1',
            name: 'Gecekodu Aralık',
            ownerTeam: 'GECEKODU',
            startDate: '2026-12-12T16:00:00Z',
          },
        ],
        incomplete: [
          {
            id: 'e1',
            name: 'Atölye',
            ownerTeam: 'WEBLAB',
            startDate: '2026-11-23T15:00:00Z',
            live: false,
            missing: ['location', 'sessions'],
          },
          {
            id: 'e2',
            name: 'Hackathon',
            ownerTeam: 'GECEKODU',
            startDate: '2026-11-22T06:00:00Z',
            live: true,
            missing: ['sessions'],
          },
        ],
        failedCertificates: [{ eventId: 'e3', eventName: 'Seminer', failed: 3 }],
        subjectRequests: { open: 2, overdue: 1 },
      },
      now,
    );
    expect(rows).toEqual([
      {
        key: 'subject-requests',
        title: '2 KVKK başvurusu yanıt bekliyor',
        detail: '1 tanesinin süresi geçti',
        href: '/subject-requests',
        tone: 'danger',
      },
      {
        key: 'certificates-e3',
        title: 'Seminer: 3 sertifika basılamadı',
        href: '/events/e3/certificates',
        tone: 'danger',
      },
      {
        key: 'incomplete-e1',
        title: 'Atölye',
        detail: 'Yarın 18:00 · Yer yok, program yok',
        href: '/events/e1',
        tone: 'warning',
      },
      {
        key: 'incomplete-e2',
        title: 'Hackathon',
        detail: 'Sürüyor · Program yok',
        href: '/events/e2/program',
        tone: 'warning',
      },
      {
        key: 'draft-d1',
        title: 'Gecekodu Aralık',
        detail: 'Taslak · 12 Ara',
        href: '/events/d1',
        tone: 'neutral',
      },
    ]);
  });

  it('folds more than three drafts into one row to the drafts list', () => {
    const drafts = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, ownerTeam: 'WEBLAB' }));
    expect(todoRows({ ...emptyTodo, drafts }, now)).toEqual([
      {
        key: 'drafts',
        title: '4 taslak etkinlik yayında değil',
        href: '/events?status=draft',
        tone: 'neutral',
      },
    ]);
  });

  it('leaves out data subject requests when none is open', () => {
    expect(todoRows({ ...emptyTodo, subjectRequests: { open: 0, overdue: 0 } }, now)).toEqual([]);
  });
});

describe('weekDays', () => {
  const week: DashboardHome['week'] = {
    from: '2026-11-21T21:00:00Z',
    to: '2026-11-28T21:00:00Z',
    events: [
      {
        id: 'hack',
        name: 'Hackathon',
        ownerTeam: 'GECEKODU',
        location: 'Kongre Merkezi',
        startDate: '2026-11-21T06:00:00Z',
        endDate: '2026-11-23T15:00:00Z',
        live: true,
      },
      {
        id: 'robot',
        name: 'Robotik Seçmeleri',
        ownerTeam: 'ROBOTLAB',
        location: 'Atölye',
        startDate: '2026-11-28T10:00:00Z',
        live: false,
      },
    ],
    sessions: [
      {
        id: 's2',
        eventId: 'hack',
        eventName: 'Hackathon',
        title: 'Jüri sunumları',
        startTime: '2026-11-23T10:00:00Z',
        endTime: '2026-11-23T13:00:00Z',
      },
      {
        id: 's1',
        eventId: 'hack',
        eventName: 'Hackathon',
        title: 'Mentor turu',
        startTime: '2026-11-22T17:00:00Z',
        endTime: '2026-11-22T18:00:00Z',
      },
    ],
  };

  it('groups Sessions by day and shows a running Event today when it has no Session today', () => {
    const days = weekDays(week, now);
    expect(
      days.map((day) => [day.label, day.rows.map((row) => `${row.time} ${row.title}`)]),
    ).toEqual([
      ['Bugün', ['20:00 Mentor turu']],
      ['Yarın', ['13:00 Jüri sunumları']],
      ['28 Kasım Cumartesi', ['13:00 Robotik Seçmeleri']],
    ]);
    expect(days[0].rows[0]).toMatchObject({
      subtitle: 'Hackathon · Kongre Merkezi',
      href: '/events/hack/program',
      live: false,
    });
    expect(days[2].rows[0]).toMatchObject({ subtitle: 'ROBOTLAB · Atölye', href: '/events/robot' });
  });

  it('marks a running Event "Sürüyor" today and puts it first', () => {
    const days = weekDays({ ...week, sessions: [] }, now);
    expect(days[0].rows[0]).toMatchObject({ time: 'Sürüyor', title: 'Hackathon', live: true });
  });

  it('is empty when nothing runs', () => {
    expect(weekDays({ ...week, events: [], sessions: [] }, now)).toEqual([]);
  });
});

describe('numbers', () => {
  it('lists new members only when core gives them', () => {
    const compare = {
      days: 30,
      applications: { current: 40, previous: 25 },
      attendees: { current: 12, previous: 18 },
      events: { current: 3, previous: 0 },
      newMembers: null,
    };
    expect(numberRows(compare)?.map((row) => row.label)).toEqual([
      'Başvuru',
      'Katılan',
      'Etkinlik',
    ]);
    expect(
      numberRows({ ...compare, newMembers: { current: 9, previous: 4 } })?.map((row) => row.label),
    ).toContain('Yeni üye');
    expect(numberRows(null)).toBeNull();
  });

  it('says the change in Turkish percent, with nothing to set against a zero', () => {
    expect(changeLabel({ current: 40, previous: 25 })).toBe('+%60');
    expect(changeLabel({ current: 12, previous: 18 })).toBe('−%33');
    expect(changeLabel({ current: 5, previous: 5 })).toBe('%0');
    expect(changeLabel({ current: 3, previous: 0 })).toBeNull();
  });
});

describe('homeView on an older core', () => {
  const stat = (partial: Partial<EventStat>): EventStat => ({
    id: 'x',
    name: 'X',
    ownerTeam: 'GECEKODU',
    location: 'Salon',
    active: true,
    status: 'published',
    live: false,
    capacity: 0,
    hasApplicationForm: true,
    hasCoverImage: true,
    applications: 0,
    members: 0,
    guests: 0,
    checkedIn: 0,
    dailyApplications: [],
    ...partial,
  });
  const summary = (eventStats: EventStat[]): DashboardSummary => ({
    generatedAt: now.toISOString(),
    timeZone: 'Europe/Istanbul',
    ownerTeams: ['GECEKODU'],
    events: { total: 0, upcoming: 0, live: 0, byMonth: [] },
    applications: { total: 0, members: 0, guests: 0, checkedIn: 0, daily: [] },
    eventStats,
    members: null,
  });
  const stats = [
    stat({
      id: 'tomorrow',
      name: 'Yarınki',
      startDate: '2026-11-23T15:00:00Z',
      location: '',
      hasApplicationForm: false,
    }),
    stat({ id: 'draft', name: 'Taslak', status: 'draft', startDate: '2026-12-12T16:00:00Z' }),
    stat({ id: 'later', name: 'Sonraki', startDate: '2026-11-26T15:00:00Z', location: '' }),
  ];

  it('makes the to-dos and the week from the Event figures, without numbers', () => {
    const view = homeView(summary(stats), ['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER'], now);
    expect(view.fallback).toBe(true);
    expect(view.todo?.map((row) => row.title)).toEqual(['Yarınki', 'Taslak']);
    expect(view.todo?.[0].detail).toBe('Yarın 18:00 · Yer yok, form yok');
    expect(view.week.flatMap((day) => day.rows.map((row) => row.title))).toEqual([
      'Yarınki',
      'Sonraki',
    ]);
    expect(view.numbers).toBeNull();
  });

  it('gives a DK reader no to-dos', () => {
    expect(homeView(summary(stats), ['/DK'], now).todo).toBeNull();
  });

  it('uses core home when it is there', () => {
    const withHome = {
      ...summary(stats),
      home: { todo: null, week: { from: '', to: '', events: [], sessions: [] }, compare: null },
    };
    const view = homeView(withHome, ['/YK'], now);
    expect(view).toEqual({ todo: null, week: [], numbers: null, fallback: false });
  });
});
