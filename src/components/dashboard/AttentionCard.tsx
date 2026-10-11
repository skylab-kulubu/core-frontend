'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@skylab-kulubu/skylcn-ui';
import { CircleAlert, CircleCheck, CircleDashed } from 'lucide-react';
import Link from 'next/link';
import type { Attention } from '@/lib/dashboard/insights';

const MAX = 5;

/** The next 30 days' loose ends, one row per event, each linking to the event to fix it. */
export function AttentionCard({
  items,
  loading,
  className,
}: {
  items: readonly Attention[];
  loading: boolean;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Dikkat isteyenler</CardTitle>
        <CardDescription>Önümüzdeki 30 günün etkinlikleri</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-subtle-foreground py-6 text-center text-xs">Yükleniyor…</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-xs">
            <CircleCheck className="text-success size-4" aria-hidden /> Eksik görünen bir şey yok
          </p>
        ) : (
          <ul className="divide-border-subtle flex flex-col divide-y">
            {items.slice(0, MAX).map((item) => {
              const Icon = item.tone === 'warning' ? CircleAlert : CircleDashed;
              return (
                <li key={item.id}>
                  <Link
                    href={`/events/${encodeURIComponent(item.eventId)}`}
                    className="hover:bg-accent focus-visible:ring-ring flex items-start gap-2.5 rounded-md px-1 py-2.5 outline-hidden focus-visible:ring-2"
                  >
                    <Icon
                      aria-hidden
                      className={
                        item.tone === 'warning'
                          ? 'text-warning mt-0.5 size-4 shrink-0'
                          : 'text-subtle-foreground mt-0.5 size-4 shrink-0'
                      }
                    />
                    <span className="min-w-0">
                      <span className="text-foreground block truncate text-sm">
                        {item.eventName}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {item.messages.join(' · ')}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {items.length > MAX ? (
          <p className="text-2xs text-subtle-foreground mt-2">
            {items.length - MAX} etkinlikte daha eksik var
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
