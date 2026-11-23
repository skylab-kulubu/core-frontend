'use client';

import { Button, cn } from '@skylab-kulubu/skylcn-ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionHeading } from '@/components/chrome/PanelChart';
import { StatusChip, StatusDot } from '@/components/chrome/StatusChip';
import type { CoreEvent } from '@/lib/api/events';
import { monthTitle, shiftMonth, weekdayLabels } from '@/lib/date-picker';
import { monthAgenda, monthWeeks, weekBars } from '@/lib/event-calendar';
import {
  eventDisplayStatus,
  eventListSubtitle,
  eventsOnDateKey,
  localDateKey,
  undatedEvents,
  type EventDisplayStatus,
} from '@/lib/events-view';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';

/** A bar's look by the Event's state: a draft dashed, a cancelled one struck through. */
const BAR: Record<EventDisplayStatus, string> = {
  draft: 'border border-dashed border-skylab-400/70 bg-card text-foreground',
  upcoming: 'bg-skylab-500/25 text-foreground',
  live: 'bg-success/25 text-foreground',
  ended: 'bg-muted text-muted-foreground',
  undated: 'bg-muted text-foreground',
  cancelled: 'bg-muted text-subtle-foreground line-through',
};

const LANES = 3;
const LANE_HEIGHT = 22;

const dayTitle = (date: Date) =>
  new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);

/** An Event in a day's list: opens it beside the calendar. */
function CalendarRow({ event, onOpen }: { event: CoreEvent; onOpen: (id: string) => void }) {
  const status = eventDisplayStatus(event);
  return (
    <button
      type="button"
      onClick={() => onOpen(event.id)}
      className="hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-3 px-3 py-2.5 text-left outline-hidden focus-visible:ring-2"
    >
      <StatusDot kind={status} />
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-sm font-medium">{event.name}</span>
        <span className={cn('text-subtle-foreground block truncate', TEXT_SECONDARY)}>
          {eventListSubtitle(event)}
        </span>
      </span>
      <StatusChip kind={status} />
    </button>
  );
}

function RowList({
  events,
  onOpen,
  empty,
}: {
  events: readonly CoreEvent[];
  onOpen: (id: string) => void;
  empty: string;
}) {
  if (!events.length) {
    return <p className={cn('text-subtle-foreground py-3', TEXT_SECONDARY)}>{empty}</p>;
  }
  return (
    <div className="border-border-subtle bg-card divide-border-subtle divide-y overflow-hidden rounded-lg border">
      {events.map((event) => (
        <CalendarRow key={event.id} event={event} onOpen={onOpen} />
      ))}
    </div>
  );
}

/**
 * The month (Outlook's month view on wide screens): an Event over several days is one bar
 * across them, coloured by its state; pressing it opens the Event beside the calendar. On a
 * phone the month reads as an agenda, a day strip on top.
 */
export function EventCalendar({
  events,
  onOpen,
}: {
  events: CoreEvent[];
  onOpen: (id: string) => void;
}) {
  const today = new Date();
  const todayKey = localDateKey(today);
  const [cursor, setCursor] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const agendaRefs = useRef(new Map<string, HTMLElement>());
  const strip = useRef<HTMLDivElement>(null);
  const weeks = useMemo(() => monthWeeks(cursor.year, cursor.month), [cursor.year, cursor.month]);
  const agenda = useMemo(
    () => monthAgenda(events, cursor.year, cursor.month),
    [events, cursor.year, cursor.month],
  );
  const undated = useMemo(() => undatedEvents(events), [events]);
  const inMonth = weeks.some((week) => week.some((day) => day.inMonth && day.key === selectedKey));
  const selected = inMonth ? selectedKey : '';
  const selectedEvents = selected ? eventsOnDateKey(events, selected) : [];
  const monthDays = weeks.flat().filter((day) => day.inMonth);
  const busy = new Set(agenda.map((day) => day.key));

  // The day strip opens on today (or the month's first day), not on the 1st
  useEffect(() => {
    const row = strip.current;
    const chip = row?.querySelector<HTMLElement>('[data-today="true"]');
    if (row && chip) row.scrollLeft = chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2;
    else if (row) row.scrollLeft = 0;
  }, [cursor.year, cursor.month]);

  const move = (delta: number) => setCursor((cur) => shiftMonth(cur.year, cur.month, delta));
  const goToday = () => {
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedKey(todayKey);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className={BUTTON_TEXT}
          onClick={goToday}
          disabled={cursor.year === today.getFullYear() && cursor.month === today.getMonth()}
        >
          Bugün
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Önceki ay" onClick={() => move(-1)}>
          <ChevronLeft aria-hidden />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Sonraki ay" onClick={() => move(1)}>
          <ChevronRight aria-hidden />
        </Button>
        <h2 className="text-foreground-strong text-base font-semibold" aria-live="polite">
          {monthTitle(cursor.year, cursor.month)}
        </h2>
      </div>

      {/* Wide screens: the month grid with the Events as bars */}
      <div
        className="border-border-subtle bg-card hidden overflow-hidden rounded-lg border sm:block"
        data-slot="event-calendar-month"
      >
        <div className="border-border-subtle grid grid-cols-7 border-b">
          {weekdayLabels().map((day) => (
            <span key={day} className="text-subtle-foreground py-2 text-center text-xs font-medium">
              {day}
            </span>
          ))}
        </div>
        {weeks.map((week) => {
          const { bars, hidden } = weekBars(events, week, LANES);
          return (
            <div
              key={week[0].key}
              className="border-border-subtle relative grid grid-cols-7 border-b last:border-b-0"
            >
              {week.map((day) => {
                const isToday = day.key === todayKey;
                const isSelected = day.key === selected;
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => setSelectedKey(day.key)}
                    aria-label={`${dayTitle(day.date)}${busy.has(day.key) ? ', etkinlik var' : ''}`}
                    aria-pressed={isSelected}
                    className={cn(
                      'border-border-subtle hover:bg-accent/60 focus-visible:ring-ring flex flex-col items-start border-r p-1.5 text-left outline-hidden last:border-r-0 focus-visible:ring-2 focus-visible:ring-inset',
                      !day.inMonth && 'bg-muted/30',
                      isSelected && 'bg-skylab-500/10',
                    )}
                    style={{ minHeight: 30 + LANES * LANE_HEIGHT + 22 }}
                  >
                    <span
                      className={cn(
                        'inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums',
                        isToday
                          ? 'bg-skylab-600 font-semibold text-white'
                          : day.inMonth
                            ? 'text-secondary-foreground'
                            : 'text-subtle-foreground',
                      )}
                    >
                      {day.date.getDate()}
                    </span>
                  </button>
                );
              })}
              <div
                className="pointer-events-none absolute inset-x-0 top-8 grid grid-cols-7 gap-y-0.5 px-0.5"
                style={{ gridAutoRows: `${LANE_HEIGHT - 2}px` }}
              >
                {bars.map((bar) => (
                  <button
                    key={bar.event.id}
                    type="button"
                    onClick={() => onOpen(bar.event.id)}
                    title={bar.event.name}
                    className={cn(
                      'focus-visible:ring-ring pointer-events-auto mx-0.5 truncate px-1.5 text-left text-xs leading-[18px] font-medium outline-hidden hover:brightness-110 focus-visible:ring-2',
                      BAR[eventDisplayStatus(bar.event)],
                      bar.before ? 'rounded-l-none' : 'rounded-l-md',
                      bar.after ? 'rounded-r-none' : 'rounded-r-md',
                    )}
                    style={{
                      gridColumn: `${bar.start + 1} / span ${bar.span}`,
                      gridRow: bar.lane + 1,
                    }}
                  >
                    {bar.event.name}
                  </button>
                ))}
                {hidden.map((count, col) =>
                  count ? (
                    <span
                      key={`more-${col}`}
                      className="text-subtle-foreground px-1.5 text-xs leading-[18px]"
                      style={{ gridColumn: col + 1, gridRow: LANES + 1 }}
                    >
                      +{count} daha
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="hidden space-y-2 sm:block">
        <SectionHeading title={selected ? dayTitle(new Date(`${selected}T12:00:00`)) : 'Gün seç'} />
        <RowList events={selectedEvents} onOpen={onOpen} empty="Bu günde etkinlik yok" />
      </div>

      {/* Phones: a strip of the month's days and the agenda under it */}
      <div className="space-y-3 sm:hidden" data-slot="event-calendar-agenda">
        <div
          ref={strip}
          role="group"
          aria-label="Günler"
          className="scrollbar-hidden -mx-4 flex gap-1 overflow-x-auto px-4 pb-1"
        >
          {monthDays.map((day) => {
            const has = busy.has(day.key);
            const isToday = day.key === todayKey;
            return (
              <button
                key={day.key}
                type="button"
                disabled={!has}
                data-today={isToday ? 'true' : undefined}
                aria-label={`${dayTitle(day.date)}${has ? '' : ', etkinlik yok'}`}
                onClick={() =>
                  agendaRefs.current
                    .get(day.key)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                className={cn(
                  'flex h-14 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border text-xs tabular-nums',
                  isToday ? 'border-skylab-500 bg-skylab-500/15' : 'border-border-subtle bg-card',
                  !has && 'opacity-50',
                )}
              >
                <span className="text-subtle-foreground text-[11px]">
                  {weekdayLabels()[(day.date.getDay() + 6) % 7]}
                </span>
                <span className="text-foreground font-semibold">{day.date.getDate()}</span>
                <span
                  aria-hidden
                  className={cn('size-1 rounded-full', has ? 'bg-skylab-400' : 'bg-transparent')}
                />
              </button>
            );
          })}
        </div>
        {agenda.length ? (
          agenda.map((day) => (
            <section
              key={day.key}
              ref={(node) => {
                if (node) agendaRefs.current.set(day.key, node);
                else agendaRefs.current.delete(day.key);
              }}
              className="scroll-mt-20 space-y-1.5"
            >
              <h3
                className={cn(
                  'text-sm font-semibold',
                  day.key === todayKey ? 'text-skylab-300' : 'text-foreground',
                )}
              >
                {dayTitle(day.date)}
                {day.key === todayKey ? ' · Bugün' : ''}
              </h3>
              <RowList events={day.events} onOpen={onOpen} empty="" />
            </section>
          ))
        ) : (
          <p className={cn('text-subtle-foreground py-3', TEXT_SECONDARY)}>Bu ay etkinlik yok</p>
        )}
      </div>

      {undated.length ? (
        <div className="space-y-2">
          <SectionHeading title="Tarihsiz" />
          <RowList events={undated} onOpen={onOpen} empty="" />
        </div>
      ) : null}
    </div>
  );
}
