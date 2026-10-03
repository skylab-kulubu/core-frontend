'use client';

import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Notice,
} from '@skylab-kulubu/skylcn-ui';
import Link from 'next/link';
import { BarChart } from '@/components/chrome/PanelChart';
import type { DashboardSummary } from '@/lib/api/dashboard';
import { monthCounts } from '@/lib/dashboard/insights';
import { fromNow } from './format';

/**
 * New members by month and the latest to register, for those who may read
 * people. Keycloak is read at most every few minutes, so it can trail a little.
 */
export function MembersSection({
  members,
  unavailable,
}: {
  members: DashboardSummary['members'];
  unavailable?: boolean;
}) {
  if (!members && !unavailable) return null;

  return (
    <section aria-labelledby="members-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="members-heading" className="text-foreground text-base font-semibold">
          Üyeler
        </h2>
        {members ? (
          <p className="text-subtle-foreground text-xs">{fromNow(members.asOf)} güncellendi</p>
        ) : null}
      </div>
      {!members ? (
        <Notice tone="info" title="Üye bilgisi şu an okunamıyor">
          Kimlik sistemine ulaşılamadı. Birazdan yeniden dene.
        </Notice>
      ) : (
        <div className="grid gap-4 xl:grid-cols-5">
          <Card className="p-4 xl:col-span-3">
            <BarChart
              title="Aylık yeni üye"
              data={monthCounts(members.newByMonth)}
              empty="Son 12 ayda yeni üye yok"
            />
          </Card>
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Son katılanlar</CardTitle>
              <CardDescription>Kayıt tarihine göre</CardDescription>
            </CardHeader>
            <CardContent>
              {members.recentJoiners.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-xs">Henüz kimse yok</p>
              ) : (
                <ul className="divide-border-subtle flex flex-col divide-y">
                  {members.recentJoiners.map((person) => {
                    const name = `${person.firstName} ${person.lastName}`.trim() || 'Adsız üye';
                    return (
                      <li key={person.id}>
                        <Link
                          href={`/users/${encodeURIComponent(person.id)}`}
                          className="hover:bg-accent focus-visible:ring-ring flex items-center gap-3 rounded-md px-1 py-2 outline-hidden focus-visible:ring-2"
                        >
                          <Avatar name={name} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="text-foreground block truncate text-sm">{name}</span>
                            <span className="mt-0.5 flex flex-wrap gap-1">
                              {person.teams.map((team) => (
                                <Badge key={team} tone="neutral">
                                  {team}
                                </Badge>
                              ))}
                            </span>
                          </span>
                          <span className="text-2xs text-subtle-foreground shrink-0">
                            {fromNow(person.registeredAt)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
