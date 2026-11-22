'use client';

import { StatusDot } from '@skylab-kulubu/skylcn-ui';
import Link from 'next/link';
import { useId, type ReactNode } from 'react';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { StatusChip } from '@/components/chrome/StatusChip';
import { changeLabel, type NumberRow, type TodoRow, type WeekDay } from '@/lib/dashboard/home';

/**
 * A titled region of the page. skylcn's Section draws its title as a 12 px
 * caption; the home page's three parts need a real heading.
 */
function HomeSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-foreground text-base font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const DOT: Record<TodoRow['tone'], { tone: 'danger' | 'warning' | 'neutral'; label: string }> = {
  danger: { tone: 'danger', label: 'Acil' },
  warning: { tone: 'warning', label: 'Eksik' },
  neutral: { tone: 'neutral', label: 'Bekliyor' },
};

/** Each row goes straight to where the thing is done. */
export function TodoSection({ rows, loading }: { rows: TodoRow[]; loading: boolean }) {
  return (
    <HomeSection title="Yapılacaklar">
      <ListPanel
        framed
        status={
          loading
            ? { kind: 'loading' }
            : rows.length
              ? { kind: 'ready' }
              : { kind: 'empty', message: 'Bekleyen iş yok' }
        }
      >
        {rows.map((row) => (
          <ListItem
            key={row.key}
            href={row.href}
            leading={<StatusDot tone={DOT[row.tone].tone} label={DOT[row.tone].label} />}
            title={row.title}
            subtitle={row.detail}
          />
        ))}
      </ListPanel>
    </HomeSection>
  );
}

const DAY_LIMIT = 6;

/** linked is false for a reader who cannot open the Event pages: the rows only inform. */
export function WeekSection({
  days,
  loading,
  linked = true,
}: {
  days: WeekDay[];
  loading: boolean;
  linked?: boolean;
}) {
  return (
    <HomeSection
      title="Bu hafta"
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
      {loading || days.length === 0 ? (
        <ListPanel
          framed
          status={
            loading ? { kind: 'loading' } : { kind: 'empty', message: 'Bu hafta etkinlik yok' }
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {days.map((day) => (
            <div key={day.date} className="flex flex-col gap-2">
              <h3 className="text-foreground text-sm font-medium">{day.label}</h3>
              <ListPanel framed status={{ kind: 'ready' }}>
                {day.rows.slice(0, DAY_LIMIT).map((row) => (
                  <ListItem
                    key={row.key}
                    href={linked ? row.href : undefined}
                    leading={
                      <span className="text-muted-foreground w-11 shrink-0 text-sm tabular-nums sm:w-14">
                        {row.time}
                      </span>
                    }
                    title={row.title}
                    subtitle={row.subtitle}
                    trailing={row.live ? <StatusChip kind="live" /> : undefined}
                  />
                ))}
                {linked && day.rows.length > DAY_LIMIT ? (
                  <ListItem
                    href="/events?view=calendar"
                    title={`${day.rows.length - DAY_LIMIT} tane daha`}
                  />
                ) : null}
              </ListPanel>
            </div>
          ))}
        </div>
      )}
    </HomeSection>
  );
}

/** A few figures, each set against the period before; no colour, the words carry the change. */
export function NumbersSection({ rows, days }: { rows: NumberRow[]; days: number }) {
  return (
    <HomeSection title={`Son ${days} gün`}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map((row) => {
          const change = changeLabel(row);
          const body = (
            <dl>
              <dt className="text-muted-foreground text-sm">{row.label}</dt>
              <dd className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
                {row.current.toLocaleString('tr-TR')}
              </dd>
              <dd className="text-muted-foreground mt-1 text-sm tabular-nums">
                Önceki: {row.previous.toLocaleString('tr-TR')}
                {change ? ` · ${change}` : ''}
              </dd>
            </dl>
          );
          return row.href ? (
            <Link
              key={row.key}
              href={row.href}
              className="border-border hover:bg-accent focus-visible:ring-ring rounded-xl border p-4 outline-hidden transition-colors focus-visible:ring-2"
            >
              {body}
            </Link>
          ) : (
            <div key={row.key} className="border-border rounded-xl border p-4">
              {body}
            </div>
          );
        })}
      </div>
    </HomeSection>
  );
}
