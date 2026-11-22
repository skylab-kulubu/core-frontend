import {
  formatDatetimeLabel,
  formatTypedDate,
  monthGrid,
  parseDatetimeLocal,
  parseTypedDate,
  shiftMonth,
  toDatetimeLocalValue,
  withDate,
  withTime,
} from '@/lib/date-picker';

describe('date picker values', () => {
  it('round-trips a datetime-local string without UTC shift', () => {
    const d = parseDatetimeLocal('2026-09-18T16:30');
    expect(d).not.toBeNull();
    expect(toDatetimeLocalValue(d!)).toBe('2026-09-18T16:30');
  });

  it('formats an empty value as blank', () => {
    expect(formatDatetimeLabel('')).toBe('');
  });

  it('builds a Monday-first September 2026 grid', () => {
    const cells = monthGrid(2026, 8);
    expect(cells[1]).toBe(1);
    expect(cells.filter((day) => day !== null)).toHaveLength(30);
  });

  it('keeps time when picking a day', () => {
    expect(withDate('2026-09-18T16:30', 2026, 8, 20)).toBe('2026-09-20T16:30');
  });

  it('keeps the calendar day when setting time', () => {
    expect(withTime('2026-09-18T16:30', 9, 5)).toBe('2026-09-18T09:05');
  });

  it('shifts December into the next year', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  });
});

describe('typed dates', () => {
  it('reads a day and time the way people write them', () => {
    expect(parseTypedDate('15.11.2026 19:00', 'datetime')).toBe('2026-11-15T19:00');
    expect(parseTypedDate('5/1/26 9.30', 'datetime')).toBe('2026-01-05T09:30');
    expect(parseTypedDate('15112026 1900', 'datetime')).toBe('2026-11-15T19:00');
    expect(parseTypedDate('2026-11-15T19:00', 'datetime')).toBe('2026-11-15T19:00');
  });

  it('gives a day without a time the fallback time', () => {
    expect(parseTypedDate('15.11.2026', 'datetime')).toBe('2026-11-15T18:00');
    expect(parseTypedDate('15.11.2026', 'datetime', '09:15')).toBe('2026-11-15T09:15');
  });

  it('reads a date alone for a day field, and no time there', () => {
    expect(parseTypedDate('01.10.2026', 'date')).toBe('2026-10-01');
    expect(parseTypedDate('01.10.2026 10:00', 'date')).toBeNull();
  });

  it('says empty and refuses what is no date', () => {
    expect(parseTypedDate('  ', 'date')).toBe('');
    expect(parseTypedDate('31.02.2026', 'date')).toBeNull();
    expect(parseTypedDate('15.11.2026 25:00', 'datetime')).toBeNull();
    expect(parseTypedDate('yarın', 'datetime')).toBeNull();
  });

  it('writes the stored value back the way it is typed', () => {
    expect(formatTypedDate('2026-11-15T19:00', 'datetime')).toBe('15.11.2026 19:00');
    expect(formatTypedDate('2026-10-01', 'date')).toBe('01.10.2026');
    expect(formatTypedDate('', 'date')).toBe('');
  });
});
