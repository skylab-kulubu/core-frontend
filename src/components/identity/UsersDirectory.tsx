'use client';

import {
  Badge,
  Button,
  Card,
  SearchInput,
  Skeleton,
  Sparkline,
  TrendBadge,
} from '@skylab-kulubu/skylcn-ui';
import { ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Avatar } from '@/components/chrome/Avatar';
import { LoadError } from '@/components/chrome/LoadError';
import { ListPanel } from '@/components/chrome/ListPanel';
import { BarChart } from '@/components/chrome/PanelChart';
import { Pagination } from '@/components/chrome/Pagination';
import { Select } from '@/components/chrome/Select';
import { StatusChip } from '@/components/chrome/StatusChip';
import { fromNow } from '@/components/dashboard/format';
import { dashboardApi, type DashboardSummary } from '@/lib/api/dashboard';
import { identityApi, type Group, type Person } from '@/lib/api/identity';
import { monthLabel } from '@/lib/dashboard/charts';
import { paginateRows } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';
import { profilePictureSrc } from '@/lib/profile-picture';
import { monthChange, teamGroups } from '@/lib/user-directory';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';

/** One row of the directory: a person found, a team member or a recent joiner. */
type DirectoryRow = Person & { teams?: string[]; registeredAt?: string };
type Source = 'recent' | 'team' | 'search';

function fullName(person: Pick<Person, 'firstName' | 'lastName' | 'email'>) {
  return `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || person.email || 'Adsız';
}

/**
 * The Kullanıcılar page: member figures and new members by month over the
 * directory. The directory is never listed whole (core has no paging on
 * GET /v1/users): it opens on the latest joiners, a team's members, or a search.
 */
export function UsersDirectory({
  query,
  onQuery,
  results,
  searching,
  searchFailed,
  ready,
  onClearSearch,
}: {
  query: string;
  onQuery: (value: string) => void;
  results: Person[];
  searching: boolean;
  searchFailed: boolean;
  /** The search has enough letters to run. */
  ready: boolean;
  onClearSearch: () => void;
}) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryRead, setSummaryRead] = useState(false);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teamId, setTeamId] = useState('');
  const [teamMembers, setTeamMembers] = useState<Person[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamFailed, setTeamFailed] = useState(false);
  const [page, setPage] = useState(1);

  /** The member figures and the latest joiners; a reader core keeps them from gets none. */
  async function readSummary() {
    setSummaryFailed(false);
    try {
      const next = await dashboardApi.summary();
      setSummary(next);
      setSummaryFailed(Boolean(next.membersUnavailable));
    } catch {
      setSummary(null);
      setSummaryFailed(true);
    } finally {
      setSummaryRead(true);
    }
  }

  useEffect(() => {
    void readSummary();
    void identityApi
      .listGroups()
      .then(setGroups)
      .catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    if (!teamId) {
      setTeamMembers([]);
      return;
    }
    let live = true;
    setTeamLoading(true);
    identityApi
      .members(teamId)
      .then((rows) => {
        if (!live) return;
        setTeamMembers(rows);
        setTeamFailed(false);
      })
      .catch(() => live && setTeamFailed(true))
      .finally(() => live && setTeamLoading(false));
    return () => {
      live = false;
    };
  }, [teamId]);

  // Typing takes the list to the search; clearing it goes back to the team or the joiners
  const source: Source = ready ? 'search' : teamId ? 'team' : 'recent';
  useEffect(() => setPage(1), [source, teamId, query]);

  const teams = useMemo(() => teamGroups(groups), [groups]);
  const members = summary?.members ?? null;
  const trend = members ? monthChange(members.newByMonth) : null;
  const recent: DirectoryRow[] = (members?.recentJoiners ?? []).map((person) => ({
    ...person,
    email: '',
  }));
  const rows: DirectoryRow[] =
    source === 'search' ? results : source === 'team' ? teamMembers : recent;
  const paged = paginateRows(rows, page, 20);
  // The latest joiners come with the figures: their list waits for them instead of a loader
  const waiting = source === 'recent' && !summaryRead;
  const loading = source === 'search' ? searching : source === 'team' && teamLoading;
  const failed = source === 'search' ? searchFailed : source === 'team' && teamFailed;
  const teamName = teams.find((team) => team.id === teamId);

  const status = listStatus({
    loading,
    failed,
    rowCount: rows.length,
    emptyMessage:
      source === 'search'
        ? 'Eşleşen kullanıcı yok'
        : source === 'team'
          ? 'Bu ekipte kimse yok'
          : 'Henüz yeni üye yok',
  });

  const listTitle =
    source === 'search'
      ? `Arama: ${query.trim()}`
      : source === 'team'
        ? `${teamName?.attributes?.displayName || teamName?.name || 'Ekip'} üyeleri`
        : 'Son katılanlar';

  return (
    <div className="flex flex-col gap-4">
      {summaryRead ? null : (
        <div aria-hidden className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
          <Skeleton className="h-52 rounded-lg" />
        </div>
      )}
      {summaryFailed && source === 'recent' ? null : summaryFailed ? (
        <LoadError title="Üye özeti yüklenemedi" onRetry={readSummary} />
      ) : null}
      {members && trend ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Tile label="Aktif üye" value={members.active}>
              <Sparkline
                values={members.newByMonth.map((month) => month.count)}
                className="h-6 w-full"
              />
            </Tile>
            <Tile
              label="Bu ay yeni"
              value={trend.current}
              hint={<TrendBadge value={trend.change} />}
            >
              <span className="text-subtle-foreground text-[13px]/5">
                Son 12 ay: <span className="tabular-nums">{trend.year}</span>
              </span>
            </Tile>
          </div>
          <Card className="order-last p-4 lg:order-none">
            <BarChart
              title="Aylık yeni üye"
              data={members.newByMonth.map((row) => ({
                label: monthLabel(row.month),
                count: row.count,
              }))}
              empty="Son 12 ayda yeni üye yok"
            />
          </Card>
        </div>
      ) : null}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="max-w-sm min-w-[180px] flex-1">
            <SearchInput
              compact
              value={query}
              onValueChange={onQuery}
              placeholder="Ad, e-posta, okul maili"
              aria-label="Kullanıcı ara"
            />
          </div>
          <Select
            aria-label="Ekip"
            className="w-full sm:w-48"
            value={teamId}
            onChange={(change) => {
              setTeamId(change.target.value);
              if (change.target.value) onQuery('');
            }}
          >
            <option value="">Ekip: hepsi</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.attributes?.displayName || team.name}
              </option>
            ))}
          </Select>
        </div>
        <h2 className="text-muted-foreground text-[13px]/5 font-medium">{listTitle}</h2>
        {/* A new panel for each state: a panel that turns from loading to ready can
            keep its loader on screen (skylcn-ui Swap), so none ever turns */}
        {waiting ? (
          <div aria-hidden className="grid gap-px sm:grid-cols-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-16" />
            ))}
          </div>
        ) : source === 'recent' && summaryFailed ? (
          <LoadError title="Son katılanlar yüklenemedi" onRetry={readSummary} />
        ) : status.kind === 'loading' ? (
          <ListPanel key="loading" status={status} />
        ) : (
          <ListPanel key={`${source}-${status.kind}`} status={status}>
            <ul className="bg-border-subtle grid gap-px sm:grid-cols-2">
              {paged.slice.map((person) => (
                <li key={person.id}>
                  <PersonCardRow person={person} />
                </li>
              ))}
            </ul>
          </ListPanel>
        )}
        {source === 'search' && !loading && rows.length === 0 ? (
          <div className="flex justify-center">
            <Button className={BUTTON_TEXT} size="sm" variant="outline" onClick={onClearSearch}>
              <X className="size-4" />
              Aramayı temizle
            </Button>
          </div>
        ) : null}
        {rows.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-subtle-foreground text-xs tabular-nums">{rows.length} kişi</p>
            <Pagination current={paged.page} totalPages={paged.totalPages} onPageChange={setPage} />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: number;
  hint?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="bg-card border-border-subtle flex flex-col gap-1.5 rounded-lg border p-3 sm:p-4">
      <span className="text-subtle-foreground text-[13px]/5 font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-foreground-strong text-2xl leading-none font-semibold tabular-nums">
          {value}
        </span>
        {hint}
      </span>
      {children ? <span className="mt-auto block">{children}</span> : null}
    </div>
  );
}

/** A person at a glance: two lines, teams or school beside. */
function PersonCardRow({ person }: { person: DirectoryRow }) {
  const name = fullName(person);
  const second = person.email || person.schoolEmail || '';
  const third =
    person.teams && person.teams.length
      ? null
      : [person.department, person.schoolEmail && person.email ? person.schoolEmail : '']
          .filter(Boolean)
          .join(' · ');
  return (
    <Link
      href={`/users/${encodeURIComponent(person.id)}`}
      className="bg-background hover:bg-card group/row flex items-center gap-3 px-3 py-3 transition-colors"
    >
      <Avatar name={name} email={person.email} src={profilePictureSrc(person)} size="lg" />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="text-foreground-strong block truncate text-sm font-medium">{name}</span>
        {second ? (
          <span className="text-subtle-foreground block truncate text-[13px]/5">{second}</span>
        ) : null}
        {person.teams && person.teams.length ? (
          <span className="flex flex-wrap items-center gap-1">
            {person.teams.map((team) => (
              <Badge key={team} tone="neutral" className="text-xs">
                {team}
              </Badge>
            ))}
            {person.registeredAt ? (
              <span className="text-subtle-foreground text-xs">{fromNow(person.registeredAt)}</span>
            ) : null}
          </span>
        ) : third ? (
          <span className="text-muted-foreground block truncate text-[13px]/5">{third}</span>
        ) : null}
      </span>
      {person.skyNumber ? <StatusChip kind="member" label={person.skyNumber} /> : null}
      <ChevronRight className="text-muted-foreground group-hover/row:text-skylab-300 size-4 shrink-0" />
    </Link>
  );
}
