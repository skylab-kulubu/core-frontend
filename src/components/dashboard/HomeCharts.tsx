'use client';

import { Card, ProportionBar, StatCard } from '@skylab-kulubu/skylcn-ui';
import { BarChart, LineChart } from '@skylab-kulubu/skylcn-ui/charts';
import { useMemo } from 'react';
import type { DashboardHome, DashboardSummary } from '@/lib/api/dashboard';
import {
  clubTeamRows,
  dailyComparison,
  eventConversion,
  kpis,
  monthLabel,
  teamRows,
} from '@/lib/dashboard/charts';
import { seasonWheel } from '@/lib/dashboard/season';
import { GithubActivitySection } from './GithubActivitySection';
import { MembersSection } from './MembersSection';
import { SeasonWheelCard } from './SeasonWheelCard';

/*
 * One palette for every chart: series take skylcn's categorical colours in a
 * fixed order (1 applications, 2 attendance), the period before is the muted
 * ink, and no colour stands for a category or a status. The categorical pair
 * passes the dataviz validator on both chart surfaces (light: ΔE 17.5 CVD).
 */
const CURRENT = 'var(--chart-categorical-1)';
const SECOND = 'var(--chart-categorical-2)';
const PREVIOUS = 'var(--muted-foreground)';

const fmt = (n: number) => n.toLocaleString('tr-TR');

/**
 * The graphic summary under the strip: figures against the 30 days before,
 * then the charts. Loaded on its own (next/dynamic) so the strip shows first.
 */
export default function HomeCharts({
  summary,
  home,
  privileged,
  now,
}: {
  summary: DashboardSummary;
  home: DashboardHome;
  privileged: boolean;
  now: Date;
}) {
  const covered = summary.ownerTeams.length > 0;
  const figures = kpis(summary, summary.home);
  const applications = dailyComparison(summary, summary.home, 'applications');
  const attendees = dailyComparison(summary, summary.home, 'attendees');
  const conversion = eventConversion(summary.eventStats, now);
  const teams = teamRows(summary.home);
  const clubTeams = clubTeamRows(summary.home);
  const wheel = useMemo(
    () => (home.season ? seasonWheel(home.season, home.season.events, now) : null),
    [home.season, now],
  );
  const monthly = home.monthly.map((m) => ({
    month: monthLabel(m.month),
    applications: m.applications,
    attendees: m.attendees,
  }));
  const clubMonths = home.club.eventsByMonth.map((m) => ({
    month: monthLabel(m.month),
    count: m.count,
  }));
  const totals = summary.applications;
  const hasPrevious = applications.some((row) => row.previous !== null);
  // All zero draws a flat line; the chart's empty state says it instead
  const anyValue = (rows: ReadonlyArray<{ current: number; previous: number | null }>) =>
    rows.some((row) => row.current > 0 || (row.previous ?? 0) > 0);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {figures.length ? (
        <section
          aria-label="Son 30 gün"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
        >
          {figures.map((kpi) => (
            <StatCard
              key={kpi.key}
              label={kpi.label}
              value={fmt(kpi.value)}
              delta={kpi.delta}
              deltaTone="neutral"
              hint={kpi.hint}
              trend={kpi.trend && kpi.trend.some((n) => n > 0) ? kpi.trend : undefined}
              href={kpi.href}
            />
          ))}
        </section>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        {covered ? (
          <LineChart
            className="min-w-0 lg:col-span-2"
            title="Başvurular"
            description={hasPrevious ? 'Günlük; gri çizgi önceki 30 gün' : 'Günlük, son 30 gün'}
            data={anyValue(applications) ? applications : []}
            x="day"
            xLabel="Gün"
            series={{
              current: { label: 'Son 30 gün', color: CURRENT },
              ...(hasPrevious ? { previous: { label: 'Önceki 30 gün', color: PREVIOUS } } : {}),
            }}
            formatValue={fmt}
            emptyMessage="Bu dönemde başvuru yok"
          />
        ) : null}

        {home.season && wheel ? (
          <SeasonWheelCard className="min-w-0" season={home.season} wheel={wheel} />
        ) : null}

        {covered && attendees.length ? (
          <LineChart
            className="min-w-0 lg:col-span-2"
            title="Katılım"
            description="Günlük kapıdan giren; gri çizgi önceki 30 gün"
            data={anyValue(attendees) ? attendees : []}
            x="day"
            xLabel="Gün"
            series={{
              current: { label: 'Son 30 gün', color: CURRENT },
              previous: { label: 'Önceki 30 gün', color: PREVIOUS },
            }}
            formatValue={fmt}
            emptyMessage="Bu dönemde giriş yok"
          />
        ) : null}

        {covered && totals.total > 0 ? (
          <Card className="flex min-w-0 flex-col gap-5 p-4">
            <div>
              <h3 className="text-foreground text-sm font-semibold">Başvuranlar</h3>
              <p className="text-muted-foreground text-xs">Bütün başvurular: {fmt(totals.total)}</p>
            </div>
            <ProportionBar
              segments={[
                { key: 'members', label: 'Üye', value: totals.members, color: CURRENT },
                { key: 'guests', label: 'Misafir', value: totals.guests, color: SECOND },
              ]}
            />
            <ProportionBar
              segments={[
                { key: 'came', label: 'Kapıdan giren', value: totals.checkedIn, color: CURRENT },
                {
                  key: 'not-yet',
                  label: 'Girmeyen',
                  value: Math.max(0, totals.total - totals.checkedIn),
                  color: PREVIOUS,
                },
              ]}
            />
          </Card>
        ) : null}

        {monthly.some((m) => m.applications || m.attendees) ? (
          <BarChart
            className="min-w-0 lg:col-span-2"
            title="Aylık başvuru ve katılım"
            description="Son 12 ay; katılım günlük girişlerin toplamı"
            data={monthly}
            x="month"
            xLabel="Ay"
            series={{
              applications: { label: 'Başvuru', color: CURRENT },
              attendees: { label: 'Katılım', color: SECOND },
            }}
            formatValue={fmt}
          />
        ) : null}

        {teams.length ? (
          <BarChart
            className="min-w-0"
            title="Ekiplere göre"
            description="Son 12 ay"
            orientation="horizontal"
            height={Math.max(200, teams.length * 44)}
            data={teams}
            x="label"
            xLabel="Ekip"
            series={{
              applications: { label: 'Başvuru', color: CURRENT },
              attendees: { label: 'Katılım', color: SECOND },
            }}
            formatValue={fmt}
          />
        ) : clubTeams.length ? (
          <BarChart
            className="min-w-0"
            title="Ekiplere göre etkinlik"
            description="Kulüpte son 12 ay"
            orientation="horizontal"
            height={Math.max(200, clubTeams.length * 36)}
            data={clubTeams}
            x="label"
            xLabel="Ekip"
            series={{ count: { label: 'Etkinlik', color: CURRENT } }}
            formatValue={fmt}
          />
        ) : null}

        {conversion.length ? (
          <BarChart
            className="min-w-0 lg:col-span-3"
            title="Etkinliklerde başvuru ve katılım"
            description="Başlamış etkinlikler; adın yanında katılım oranı"
            orientation="horizontal"
            height={Math.max(200, conversion.length * 52)}
            data={conversion}
            x="label"
            xLabel="Etkinlik"
            series={{
              applications: { label: 'Başvuru', color: CURRENT },
              attendees: { label: 'Katılım', color: SECOND },
            }}
            formatValue={fmt}
          />
        ) : null}

        {!covered && clubMonths.some((m) => m.count > 0) ? (
          <BarChart
            className="min-w-0 lg:col-span-3"
            title="Aylık etkinlik"
            description="Kulüpte son 12 ay"
            data={clubMonths}
            x="month"
            xLabel="Ay"
            series={{ count: { label: 'Etkinlik', color: CURRENT } }}
            formatValue={fmt}
          />
        ) : null}
      </div>

      <MembersSection members={summary.members} unavailable={summary.membersUnavailable} />

      {privileged ? <GithubActivitySection /> : null}
    </div>
  );
}
