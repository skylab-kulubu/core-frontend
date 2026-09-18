'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  formatDatetimeLabel,
  monthGrid,
  monthTitle,
  parseDatetimeLocal,
  shiftMonth,
  weekdayLabels,
  withDate,
  withTime,
} from '@/lib/date-picker';

type DatePickerProps = {
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
};

export function DatePicker({ value, onChange, required }: DatePickerProps) {
  const selected = parseDatetimeLocal(value);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => ({
    year: selected?.getFullYear() ?? new Date().getFullYear(),
    month: selected?.getMonth() ?? new Date().getMonth(),
  }));
  const rootRef = useRef<HTMLDivElement>(null);
  const hours = selected?.getHours() ?? 18;
  const minutes = selected?.getMinutes() ?? 0;
  const cells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor.year, cursor.month]);
  const timeValue = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const label = formatDatetimeLabel(value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const d = parseDatetimeLocal(value);
    if (!d) return;
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  }, [open, value]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-required={required}
        onClick={() => setOpen((next) => !next)}
        className="focus:border-skylab-400/50 flex h-8 w-full items-center gap-2 rounded-md border border-white/10 bg-white/3 px-3 text-left text-xs text-neutral-100 focus:bg-white/5 focus:outline-none"
      >
        <CalendarDays className="text-skylab-300 h-3.5 w-3.5 shrink-0" />
        <span className={label ? 'truncate' : 'text-neutral-600'}>{label || 'Tarih ve saat'}</span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Tarih ve saat seç"
          className="absolute z-30 mt-1 w-[min(100%,18rem)] rounded-md border border-white/10 bg-[#16151a] p-3 shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-300 hover:bg-white/5"
              aria-label="Önceki ay"
              onClick={() => setCursor((cur) => shiftMonth(cur.year, cur.month, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-xs font-medium text-neutral-100">
              {monthTitle(cursor.year, cursor.month)}
            </p>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-300 hover:bg-white/5"
              aria-label="Sonraki ay"
              onClick={() => setCursor((cur) => shiftMonth(cur.year, cur.month, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {weekdayLabels().map((day) => (
              <span
                key={day}
                className="py-1 text-center text-[10px] tracking-wide text-neutral-500 uppercase"
              >
                {day}
              </span>
            ))}
            {cells.map((day, index) => {
              if (day === null) {
                return <span key={`e-${index}`} className="h-7" />;
              }
              const isSelected =
                selected !== null &&
                selected.getFullYear() === cursor.year &&
                selected.getMonth() === cursor.month &&
                selected.getDate() === day;
              const today = new Date();
              const isToday =
                today.getFullYear() === cursor.year &&
                today.getMonth() === cursor.month &&
                today.getDate() === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => onChange(withDate(value, cursor.year, cursor.month, day))}
                  className={`h-7 rounded-md text-xs ${
                    isSelected
                      ? 'bg-skylab-500/30 text-skylab-200'
                      : isToday
                        ? 'text-skylab-300 ring-skylab-400/40 ring-1'
                        : 'text-neutral-200 hover:bg-white/5'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <label className="mt-3 block space-y-1">
            <span className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">Saat</span>
            <input
              type="time"
              value={timeValue}
              onChange={(event) => {
                const [h, m] = event.target.value.split(':').map(Number);
                onChange(withTime(value, h || 0, m || 0));
              }}
              className="focus:border-skylab-400/50 h-8 w-full rounded-md border border-white/10 bg-[#f5f1ec] px-3 text-xs text-[#1a1a1a] scheme-light focus:bg-white focus:outline-none"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
