import {
  followProgramOn,
  pickProgramSession,
  programTitle,
  setFollowProgramOn,
} from '@/lib/program-follow';

// ARTLAB's day (Istanbul = UTC+3): Açılış 11:30–12:00, 1. Oturum 12:15–12:45, 2. Oturum 13:00–13:30.
const day = [
  {
    id: 'b',
    title: '1. Oturum',
    startTime: '2026-11-27T09:15:00Z',
    endTime: '2026-11-27T09:45:00Z',
  },
  { id: 'a', title: 'Açılış', startTime: '2026-11-27T08:30:00Z', endTime: '2026-11-27T09:00:00Z' },
  {
    id: 'c',
    title: '2. Oturum',
    startTime: '2026-11-27T10:00:00Z',
    endTime: '2026-11-27T10:30:00Z',
  },
];
const at = (iso: string) => Date.parse(iso);

describe('pickProgramSession', () => {
  it('shows the next session before the day starts', () => {
    expect(pickProgramSession(day, at('2026-11-27T07:00:00Z'))).toEqual({
      session: day[1],
      state: 'next',
    });
  });

  it('shows the session running now, from its start until its end', () => {
    expect(pickProgramSession(day, at('2026-11-27T08:30:00Z'))?.session.id).toBe('a');
    expect(pickProgramSession(day, at('2026-11-27T08:59:59Z'))).toMatchObject({
      session: { id: 'a' },
      state: 'current',
    });
  });

  it('shows the next one in the gap between two sessions', () => {
    expect(pickProgramSession(day, at('2026-11-27T09:00:00Z'))).toMatchObject({
      session: { id: 'b' },
      state: 'next',
    });
  });

  it('keeps the last session once the day is over', () => {
    expect(pickProgramSession(day, at('2026-11-27T15:00:00Z'))).toMatchObject({
      session: { id: 'c' },
      state: 'last',
    });
  });

  it('skips cancelled and untimed sessions; null when none is left', () => {
    const sessions = [{ ...day[1], cancelled: true }, { id: 'x', title: 'Saatsiz' }, day[0]];
    expect(pickProgramSession(sessions, at('2026-11-27T08:40:00Z'))).toMatchObject({
      session: { id: 'b' },
      state: 'next',
    });
    expect(pickProgramSession([{ id: 'x', title: 'Saatsiz' }], Date.now())).toBeNull();
  });

  it('runs a session without an end until the next one starts, the last one an hour', () => {
    const open = [
      { id: 'a', title: 'A', startTime: '2026-11-27T08:00:00Z' },
      { id: 'b', title: 'B', startTime: '2026-11-27T09:00:00Z' },
    ];
    expect(pickProgramSession(open, at('2026-11-27T08:59:00Z'))?.session.id).toBe('a');
    expect(pickProgramSession(open, at('2026-11-27T09:59:00Z'))).toMatchObject({
      session: { id: 'b' },
      state: 'current',
    });
    expect(pickProgramSession(open, at('2026-11-27T10:00:00Z'))?.state).toBe('last');
  });

  it('takes the latest started of overlapping sessions', () => {
    const overlap = [
      {
        id: 'long',
        title: 'Uzun',
        startTime: '2026-11-27T08:00:00Z',
        endTime: '2026-11-27T12:00:00Z',
      },
      {
        id: 'short',
        title: 'Kısa',
        startTime: '2026-11-27T09:00:00Z',
        endTime: '2026-11-27T09:30:00Z',
      },
    ];
    expect(pickProgramSession(overlap, at('2026-11-27T09:10:00Z'))?.session.id).toBe('short');
    expect(pickProgramSession(overlap, at('2026-11-27T09:40:00Z'))?.session.id).toBe('long');
  });
});

describe('programTitle', () => {
  it('says "Sıradaki" with the start time in Istanbul for the next session', () => {
    expect(programTitle({ session: day[0], state: 'next' })).toBe('Sıradaki: 1. Oturum · 12:15');
    expect(programTitle({ session: day[0], state: 'current' })).toBe('1. Oturum');
  });
});

describe('followProgramOn', () => {
  beforeEach(() => window.localStorage.clear());

  it('is off until turned on, and remembered on this device', () => {
    expect(followProgramOn()).toBe(false);
    setFollowProgramOn(true);
    expect(followProgramOn()).toBe(true);
    setFollowProgramOn(false);
    expect(followProgramOn()).toBe(false);
  });
});
