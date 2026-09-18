'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import type { CoreEvent } from '@/lib/api/events';
import { monthGrid, monthTitle, pad2, shiftMonth, weekdayLabels } from '@/lib/date-picker';
import { eventListSubtitle, eventsByDateKey, localDateKey, undatedEvents } from '@/lib/events-view';
import { listStatus } from '@/lib/list-status';

const CHIP_MAX = 3;

export function EventCalendar({ events }: { events: CoreEvent[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));
  const todayKey = localDateKey(today);
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const cells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor.year, cursor.month]);
  const byDay = useMemo(
    () => eventsByDateKey(events, cursor.year, cursor.month),
    [events, cursor.year, cursor.month],
  );
  const selectedInMonth = selectedKey.startsWith(`${cursor.year}-${pad2(cursor.month + 1)}`);
  const selected = selectedInMonth ? selectedKey : '';
  const selectedEvents = selected ? (byDay.get(selected) ?? []) : [];
  const undated = useMemo(() => undatedEvents(events), [events]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-white/10">
        <div className="flex items-center justify-between px-3 py-2">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-300 hover:bg-white/5"
            aria-label="Önceki ay"
            onClick={() => setCursor((cur) => shiftMonth(cur.year, cur.month, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-medium text-neutral-100">
            {monthTitle(cursor.year, cursor.month)}
          </p>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-300 hover:bg-white/5"
            aria-label="Sonraki ay"
            onClick={() => setCursor((cur) => shiftMonth(cur.year, cur.month, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 border-t border-white/5">
          {weekdayLabels().map((day) => (
            <span
              key={day}
              className="py-2 text-center text-[10px] tracking-wide text-neutral-500 uppercase"
            >
              {day}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 border-t border-white/5">
          {cells.map((day, index) => {
            if (day === null) {
              return (
                <div
                  key={`e-${index}`}
                  className="min-h-[5.5rem] border-t border-r border-white/5"
                />
              );
            }
            const key = `${cursor.year}-${pad2(cursor.month + 1)}-${pad2(day)}`;
            const rows = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            const isSelected = key === selected;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedKey(key)}
                className={`flex min-h-[5.5rem] flex-col gap-1 border-t border-r border-white/5 p-1.5 text-left hover:bg-white/5 ${
                  isSelected ? 'bg-skylab-500/10' : ''
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs ${
                    isSelected
                      ? 'bg-skylab-500/30 text-skylab-200'
                      : isToday
                        ? 'text-skylab-300 ring-skylab-400/40 ring-1'
                        : 'text-neutral-300'
                  }`}
                >
                  {day}
                </span>
                {rows.slice(0, CHIP_MAX).map((event) => (
                  <span
                    key={event.id}
                    className="bg-skylab-500/20 text-skylab-200 truncate rounded px-1 py-0.5 text-[10px] leading-4"
                  >
                    {event.name}
                  </span>
                ))}
                {rows.length > CHIP_MAX ? (
                  <span className="text-[10px] text-neutral-500">+{rows.length - CHIP_MAX}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">
          {selected
            ? new Intl.DateTimeFormat('tr-TR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }).format(new Date(`${selected}T12:00:00`))
            : 'Gün seç'}
        </h2>
        <ListPanel
          status={listStatus({
            loading: false,
            rowCount: selectedEvents.length,
            emptyMessage: selected ? 'Bu günde etkinlik yok' : 'Takvimden bir gün seç',
          })}
        >
          {selectedEvents.map((event) => (
            <ListItem
              key={event.id}
              href={`/events/${event.id}`}
              title={event.name}
              subtitle={eventListSubtitle(event)}
            />
          ))}
        </ListPanel>
      </div>
      {undated.length ? (
        <div className="space-y-2">
          <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">Tarihsiz</h2>
          <ListPanel
            status={listStatus({
              loading: false,
              rowCount: undated.length,
              emptyMessage: 'Tarihsiz etkinlik yok',
            })}
          >
            {undated.map((event) => (
              <ListItem
                key={event.id}
                href={`/events/${event.id}`}
                title={event.name}
                subtitle={eventListSubtitle(event)}
              />
            ))}
          </ListPanel>
        </div>
      ) : null}
    </div>
  );
}
