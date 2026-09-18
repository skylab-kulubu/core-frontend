import {
  mixPercents,
  ticketCheckInMix,
  ticketMix,
  topClickUrls,
  upcomingEvents,
} from './panel-charts';

describe('ticketMix', () => {
  it('splits guest vs member even when one side is empty', () => {
    expect(
      ticketMix([{ ticketType: 'GUEST' }, { ticketType: 'GUEST' }, { ticketType: 'REGISTERED' }]),
    ).toEqual([
      { label: 'Misafir', count: 2 },
      { label: 'Üye', count: 1 },
    ]);
  });
});

describe('ticketCheckInMix', () => {
  it('counts checked-in vs still registered', () => {
    expect(
      ticketCheckInMix([
        { checkIns: [{ id: '1' }] },
        { checkIns: [] },
        { checkIns: [{ id: '2' }, { id: '3' }] },
      ]),
    ).toEqual([
      { label: 'Giriş yaptı', count: 2 },
      { label: 'Kayıtlı', count: 1 },
    ]);
  });
});

describe('topClickUrls', () => {
  it('ranks aliases by clicks and drops zeros', () => {
    expect(
      topClickUrls(
        [
          { alias: 'quiet', clickCount: 0 },
          { alias: 'jam', clickCount: 12 },
          { alias: 'ctf', clickCount: 40 },
        ],
        2,
      ),
    ).toEqual([
      { label: 'ctf', count: 40 },
      { label: 'jam', count: 12 },
    ]);
  });
});

describe('upcomingEvents', () => {
  it('keeps future dated events soonest first', () => {
    const now = new Date('2026-09-19T12:00:00+03:00');
    expect(
      upcomingEvents(
        [
          { id: 'past', name: 'Eski', startDate: '2026-01-01T10:00:00+03:00' },
          { id: 'later', name: 'Sonra', startDate: '2026-11-01T10:00:00+03:00' },
          { id: 'next', name: 'Yakın', startDate: '2026-10-01T10:00:00+03:00' },
          { id: 'none', name: 'Tarihsiz' },
        ],
        now,
        2,
      ).map((row) => row.id),
    ).toEqual(['next', 'later']);
  });
});

describe('mixPercents', () => {
  it('turns counts into whole percents that sum to 100', () => {
    expect(
      mixPercents([
        { label: 'Misafir', count: 2 },
        { label: 'Üye', count: 1 },
      ]),
    ).toEqual([
      { label: 'Misafir', count: 2, percent: 67 },
      { label: 'Üye', count: 1, percent: 33 },
    ]);
    expect(mixPercents([{ label: 'Boş', count: 0 }])).toEqual([
      { label: 'Boş', count: 0, percent: 0 },
    ]);
  });
});
