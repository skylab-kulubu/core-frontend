import {
  formatDatetimeLabel,
  monthGrid,
  parseDatetimeLocal,
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
