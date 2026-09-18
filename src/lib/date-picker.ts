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
