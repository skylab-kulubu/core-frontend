import { displayCount, errorCount, okCount, sessionsByEvent } from './ozet-stats';

describe('displayCount', () => {
  it('does not render a silent zero', () => {
    expect(displayCount({ kind: 'loading' })).toBe('--');
    expect(displayCount(errorCount('boom'))).toBe('Hata');
    expect(displayCount(okCount(0))).toBe('Boş');
    expect(displayCount(okCount(12))).toBe('12');
  });
});

describe('sessionsByEvent', () => {
  it('ranks events by session count', () => {
    expect(
      sessionsByEvent([{ eventName: 'Jam' }, { eventName: 'Jam' }, { eventName: 'CTF' }]),
    ).toEqual([
      { label: 'Jam', count: 2 },
      { label: 'CTF', count: 1 },
    ]);
  });

  it('treats a missing event name as Etkinlik', () => {
    expect(sessionsByEvent([{ eventName: undefined as unknown as string }])).toEqual([
      { label: 'Etkinlik', count: 1 },
    ]);
  });
});
