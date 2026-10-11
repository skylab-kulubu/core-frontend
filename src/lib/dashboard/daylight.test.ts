import { greetingFor, sunTimes } from './daylight';

// Istanbul is UTC+3 all year
const istanbul = (iso: string) => new Date(`${iso}+03:00`);
const hhmm = (date: Date) => new Date(date.getTime() + 3 * 3_600_000).toISOString().slice(11, 16);

describe('sunTimes', () => {
  it('matches Istanbul’s sunrise and sunset through the year, to a few minutes', () => {
    const within = (actual: string, expected: string) => {
      const [ah, am] = actual.split(':').map(Number);
      const [eh, em] = expected.split(':').map(Number);
      expect(Math.abs(ah! * 60 + am! - (eh! * 60 + em!))).toBeLessThanOrEqual(4);
    };
    const october = sunTimes(istanbul('2026-10-03T12:00:00'));
    within(hhmm(october.sunrise), '07:05');
    within(hhmm(october.sunset), '18:47');
    // UTC+3 all year: December's sun sets near 17:40, not 16:40
    within(hhmm(sunTimes(istanbul('2026-12-21T12:00:00')).sunset), '17:40');
    within(hhmm(sunTimes(istanbul('2026-06-21T12:00:00')).sunset), '20:39');
  });
});

describe('greetingFor', () => {
  it('follows the sun: evening once it has set, even before the clock says so', () => {
    expect(greetingFor(istanbul('2026-10-03T19:40:00'))).toBe('İyi akşamlar');
    expect(greetingFor(istanbul('2026-12-21T17:00:00'))).toBe('İyi günler');
    expect(greetingFor(istanbul('2026-12-21T17:50:00'))).toBe('İyi akşamlar');
    expect(greetingFor(istanbul('2026-06-21T19:40:00'))).toBe('İyi günler');
  });

  it('says good morning around sunrise and good night late', () => {
    expect(greetingFor(istanbul('2026-10-03T08:30:00'))).toBe('Günaydın');
    expect(greetingFor(istanbul('2026-10-03T13:00:00'))).toBe('İyi günler');
    expect(greetingFor(istanbul('2026-10-03T23:10:00'))).toBe('İyi geceler');
    expect(greetingFor(istanbul('2026-10-03T03:00:00'))).toBe('İyi geceler');
  });
});
