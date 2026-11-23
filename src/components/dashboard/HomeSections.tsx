'use client';

import { Card, Skeleton, StatusDot } from '@skylab-kulubu/skylcn-ui';
import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { upcomingRows, type TodoRow, type WeekDay } from '@/lib/dashboard/home';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';

/** A compact titled card of the strip above the charts. */
function StripCard({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <Card className="min-w-0 p-0">
      <section aria-labelledby={id} className="flex min-w-0 flex-col">
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
          <h2 id={id} className="text-foreground text-sm font-semibold">
            {title}
            {meta ? (
              <span className="text-muted-foreground ml-2 font-normal tabular-nums">{meta}</span>
            ) : null}
          </h2>
          {action}
        </div>
        {children}
      </section>
    </Card>
  );
}

/** Two quiet lines where a card's rows will come. */
function RowsSkeleton() {
  return (
    <div className="space-y-2 px-4 pb-4" aria-hidden>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

/** Nothing waits on the reader: one line in place of the card. */
export function TodoLine() {
  return (
    <p
      className={`border-border-subtle bg-card text-secondary-foreground flex items-center gap-2 rounded-lg border px-4 py-2.5 ${TEXT_SECONDARY}`}
    >
      <CircleCheck className="text-success size-4 shrink-0" aria-hidden />
      <span className="text-foreground font-medium">Yapılacaklar</span>
      <span aria-hidden>·</span>
      Bekleyen iş yok
    </p>
  );
}

const DOT: Record<TodoRow['tone'], { tone: 'danger' | 'warning' | 'neutral'; label: string }> = {
  danger: { tone: 'danger', label: 'Acil' },
  warning: { tone: 'warning', label: 'Eksik' },
  neutral: { tone: 'neutral', label: 'Bekliyor' },
};

const TODO_LIMIT = 4;

/** What waits on the reader; each row goes straight to where it is done. */
export function TodoCard({ rows, loading }: { rows: TodoRow[]; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const shown = open ? rows : rows.slice(0, TODO_LIMIT);
  return (
    <StripCard
      title="Yapılacaklar"
      meta={loading || rows.length === 0 ? null : rows.length}
      action={
        rows.length > TODO_LIMIT ? (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            {open ? 'Daha az' : `${rows.length - TODO_LIMIT} tane daha`}
          </button>
        ) : null
      }
    >
      {loading ? (
        <RowsSkeleton />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground px-4 pb-4 text-sm">Bekleyen iş yok</p>
      ) : (
        <ListPanel status={{ kind: 'ready' }}>
          {shown.map((row) => (
            <ListItem
              key={row.key}
              href={row.href}
              leading={<StatusDot tone={DOT[row.tone].tone} label={DOT[row.tone].label} />}
              title={row.title}
              subtitle={row.detail}
            />
          ))}
        </ListPanel>
      )}
    </StripCard>
  );
}

const WEEK_LIMIT = 5;

/**
 * The week from now on, one list. linked is false for a reader who cannot open
 * the Event pages: the rows only inform. A running Event offers its door.
 */
export function WeekCard({
  days,
  loading,
  linked = true,
}: {
  days: WeekDay[];
  loading: boolean;
  linked?: boolean;
}) {
  const rows = upcomingRows(days);
  return (
    <StripCard
      title="Bu hafta"
      meta={loading || rows.length === 0 ? null : rows.length}
      action={
        linked ? (
          <Link
            href="/events?view=calendar"
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            Takvim
          </Link>
        ) : null
      }
    >
      {loading ? (
        <RowsSkeleton />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground px-4 pb-4 text-sm">Bu hafta etkinlik yok</p>
      ) : (
        <ListPanel status={{ kind: 'ready' }}>
          {rows.slice(0, WEEK_LIMIT).map((row) => (
            <ListItem
              key={row.key}
              href={linked ? row.href : undefined}
              leading={
                <span className="text-muted-foreground w-20 shrink-0 text-xs leading-tight tabular-nums">
                  <span className="block">{row.day}</span>
                  {/* A running event says so here, in place of its time: the row's end keeps only
                      the door, so the name is not cut on a phone */}
                  <span
                    className={`block text-sm ${row.live ? 'text-success font-medium' : 'text-foreground'}`}
                  >
                    {row.live ? 'Sürüyor' : row.time}
                  </span>
                </span>
              }
              title={row.title}
              subtitle={row.subtitle}
              trailing={
                row.live && linked ? (
                  <Link
                    href={`/events/${row.eventId}/door`}
                    className="text-muted-foreground hover:text-foreground text-sm"
                  >
                    Kapı
                  </Link>
                ) : undefined
              }
            />
          ))}
          {rows.length > WEEK_LIMIT && linked ? (
            <ListItem
              href="/events?view=calendar"
              title={`${rows.length - WEEK_LIMIT} tane daha`}
            />
          ) : null}
        </ListPanel>
      )}
    </StripCard>
  );
}
