const WEEKDAYS_TR = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'] as const;

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseDatetimeLocal(value: string): Date | null {
  if (!value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const d = new Date(year, month, day, hour, minute);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDatetimeLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatDatetimeLabel(value: string): string {
  const d = parseDatetimeLocal(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export function monthGrid(year: number, month: number): Array<number | null> {
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= days; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function weekdayLabels(): readonly string[] {
  return WEEKDAYS_TR;
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function withDate(value: string, year: number, month: number, day: number): string {
  const current = parseDatetimeLocal(value);
  const hour = current?.getHours() ?? 18;
  const minute = current?.getMinutes() ?? 0;
  return toDatetimeLocalValue(new Date(year, month, day, hour, minute));
}

export function withTime(value: string, hour: number, minute: number): string {
  const current = parseDatetimeLocal(value) ?? new Date();
  return toDatetimeLocalValue(
    new Date(current.getFullYear(), current.getMonth(), current.getDate(), hour, minute),
  );
}

export function monthTitle(year: number, month: number): string {
  const raw = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(
    new Date(year, month, 1),
  );
  return raw.charAt(0).toLocaleUpperCase('tr-TR') + raw.slice(1);
}

export type DateFieldMode = 'date' | 'datetime';

/** The typed form of a stored value: 15.11.2026 or 15.11.2026 19:00. */
export function formatTypedDate(value: string, mode: DateFieldMode): string {
  if (!value.trim()) return '';
  if (mode === 'date') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    return match ? `${match[3]}.${match[2]}.${match[1]}` : '';
  }
  const date = parseDatetimeLocal(value);
  if (!date) return '';
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function validDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(year, month, 0).getDate();
}

const DAY_FIRST =
  /^(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{2}|\d{4})(?:[\sT,]+(\d{1,2})(?:[:.]?(\d{2}))?)?$/;
const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[\sT]+(\d{1,2})(?::(\d{2}))?)?$/;
const DIGITS = /^(\d{2})(\d{2})(\d{4})(?:\s*(\d{2})(\d{2}))?$/;

/**
 * Reads a typed day (and time): 15.11.2026 19:00, 15/11/26 19.00, 15112026 1900
 * or 2026-11-15T19:00. Gives the stored value (YYYY-MM-DD or YYYY-MM-DDTHH:mm),
 * '' for an empty field and null for text that is no date. A day typed without
 * a time keeps `fallbackTime` (HH:MM).
 */
export function parseTypedDate(
  text: string,
  mode: DateFieldMode,
  fallbackTime = '18:00',
): string | null {
  const raw = text.trim();
  if (!raw) return '';
  let parts: RegExpExecArray | null = DAY_FIRST.exec(raw);
  let day: number, month: number, year: number;
  let hour: string | undefined, minute: string | undefined;
  if (parts) {
    [day, month, year] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
    [hour, minute] = [parts[4], parts[5]];
  } else if ((parts = ISO.exec(raw))) {
    [year, month, day] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
    [hour, minute] = [parts[4], parts[5]];
  } else if ((parts = DIGITS.exec(raw))) {
    [day, month, year] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
    [hour, minute] = [parts[4], parts[5]];
  } else {
    return null;
  }
  if (year < 100) year += 2000;
  if (!validDay(year, month, day)) return null;
  const date = `${year}-${pad2(month)}-${pad2(day)}`;
  if (mode === 'date') return hour === undefined ? date : null;
  const fallback = /^(\d{2}):(\d{2})$/.exec(fallbackTime);
  const h = hour === undefined ? Number(fallback?.[1] ?? 18) : Number(hour);
  const m = hour === undefined ? Number(fallback?.[2] ?? 0) : Number(minute ?? 0);
  if (h > 23 || m > 59) return null;
  return `${date}T${pad2(h)}:${pad2(m)}`;
}
