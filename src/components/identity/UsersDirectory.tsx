'use client';

import {
  Badge,
  Card,
  IconButton,
  SearchInput,
  Sparkline,
  Tab,
  Tabs,
  TabsList,
  TrendBadge,
} from '@skylab-kulubu/skylcn-ui';
import { ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { Avatar } from '@/components/chrome/Avatar';
import { Drawer } from '@/components/chrome/Drawer';
import { ListPanel } from '@/components/chrome/ListPanel';
import { BarChart } from '@/components/chrome/PanelChart';
import { Pagination } from '@/components/chrome/Pagination';
import { Select } from '@/components/chrome/Select';
import { StatusChip } from '@/components/chrome/StatusChip';
import { fromNow } from '@/components/dashboard/format';
import { dashboardApi, type DashboardSummary } from '@/lib/api/dashboard';
import { identityApi, type Group, type Person, type UserCard } from '@/lib/api/identity';
import { monthCounts } from '@/lib/dashboard/insights';
import { paginateRows } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';
import { profilePictureSrc } from '@/lib/profile-picture';
import type { DesignVariant } from '@/lib/ui/design-variant';
import { groupTrail, monthChange, rolesByApp, teamGroups } from '@/lib/user-directory';

/** One row of the directory: a person found, a team member or a recent joiner. */
type DirectoryRow = Person & { teams?: string[]; registeredAt?: string };
type Source = 'recent' | 'team' | 'search';

const PANEL_PARAM = 'kisi';

function fullName(person: Pick<Person, 'firstName' | 'lastName' | 'email'>) {
  return `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || person.email || 'Adsız';
}

function useWide(query: string) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    const update = () => setWide(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return wide;
}

/**
 * The Kullanıcılar page in a trial direction. The directory is never listed
 * whole (core has no paging on GET /v1/users): it opens on the latest
 * joiners, a team's members, or a search.
 */
export function UsersDirectory({
  variant,
  query,
  onQuery,
  results,
  searching,
  searchFailed,
  ready,
}: {
  variant: DesignVariant;
  query: string;
  onQuery: (value: string) => void;
  results: Person[];
  searching: boolean;
  searchFailed: boolean;
  /** The search has enough letters to run. */
  ready: boolean;
}) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryRead, setSummaryRead] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teamId, setTeamId] = useState('');
  const [teamMembers, setTeamMembers] = useState<Person[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamFailed, setTeamFailed] = useState(false);
  const [tab, setTab] = useState<Source>('recent');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const docked = useWide('(min-width: 1280px)') && variant === 'b';

  useEffect(() => {
    void dashboardApi
      .summary()
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setSummaryRead(true));
    void identityApi
      .listGroups()
      .then(setGroups)
      .catch(() => setGroups([]));
    setOpenId(new URLSearchParams(window.location.search).get(PANEL_PARAM));
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

  // Typing takes the list to the search; clearing it goes back where it was
  const source: Source = ready ? 'search' : teamId && tab !== 'recent' ? 'team' : tab;
  useEffect(() => setPage(1), [source, teamId, query]);

  const teams = useMemo(() => teamGroups(groups), [groups]);
  const members = summary?.members ?? null;
  const recent: DirectoryRow[] = (members?.recentJoiners ?? []).map((person) => ({
    ...person,
    email: '',
  }));
  const rows: DirectoryRow[] =
    source === 'search' ? results : source === 'team' ? teamMembers : recent;
  const paged = paginateRows(rows, page, 20);
  // The latest joiners come with the figures; the list waits for them rather than flashing a loader
  const loading = source === 'search' ? searching : source === 'team' ? teamLoading : false;
  const waiting = source === 'recent' && !summaryRead;
  const failed = source === 'search' ? searchFailed : source === 'team' ? teamFailed : false;
  const teamName = teams.find((team) => team.id === teamId)?.name;

  function show(id: string | null) {
    setOpenId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set(PANEL_PARAM, id);
    else url.searchParams.delete(PANEL_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
  }

  function open(id: string) {
    return (click: MouseEvent<HTMLAnchorElement>) => {
      if (variant !== 'b') return;
      if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey || click.button !== 0)
        return;
      click.preventDefault();
      show(id);
    };
  }

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

  const teamPicker = (
    <Select
      aria-label="Ekip"
      className="w-full sm:w-48"
      value={teamId}
      onChange={(change) => {
        setTeamId(change.target.value);
        setTab(change.target.value ? 'team' : 'recent');
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
  );

  const search = (
    <div className="max-w-sm min-w-[180px] flex-1">
      <SearchInput
        compact
        value={query}
        onValueChange={onQuery}
        placeholder="Ad, e-posta, okul maili"
        aria-label="Kullanıcı ara"
      />
    </div>
  );

  const listTitle =
    source === 'search'
      ? `Arama: ${query.trim()}`
      : source === 'team'
        ? `${teamName ?? 'Ekip'} üyeleri`
        : 'Son katılanlar';

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-2xs text-subtle-foreground tabular-nums">{rows.length} kişi</p>
      <Pagination current={paged.page} totalPages={paged.totalPages} onPageChange={setPage} />
    </div>
  );

  if (variant === 'a') {
    const trend = members ? monthChange(members.newByMonth) : null;
    return (
      <div className="flex flex-col gap-4">
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
                <span className="text-2xs text-subtle-foreground">
                  Son 12 ay: <span className="tabular-nums">{trend.year}</span>
                </span>
              </Tile>
            </div>
            <Card className="order-last p-4 lg:order-none">
              <BarChart
                title="Aylık yeni üye"
                data={monthCounts(members.newByMonth)}
                empty="Son 12 ayda yeni üye yok"
              />
            </Card>
          </div>
        ) : null}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {search}
            {teamPicker}
          </div>
          <h2 className="text-muted-foreground text-xs font-medium">{listTitle}</h2>
          {waiting ? null : (
            <ListPanel status={status}>
              <ul className="bg-border-subtle grid gap-px sm:grid-cols-2">
                {paged.slice.map((person) => (
                  <li key={person.id}>
                    <PersonCardRow person={person} />
                  </li>
                ))}
              </ul>
            </ListPanel>
          )}
          {footer}
        </section>
      </div>
    );
  }

  const trend = members ? monthChange(members.newByMonth) : null;
  const openRow = openId ? rows.find((row) => row.id === openId) : undefined;
  const table = (
    <ListPanel status={status}>
      <table className="w-full table-fixed border-collapse text-sm">
        <thead className="bg-background sticky top-0 z-10">
          <tr className="border-border border-b">
            <th
              scope="col"
              className="text-2xs text-subtle-foreground px-2 py-2 text-left font-medium"
            >
              Kişi
            </th>
            <th
              scope="col"
              className="text-2xs text-subtle-foreground hidden px-2 py-2 text-left font-medium md:table-cell"
            >
              {source === 'recent' ? 'Ekip' : 'E-posta'}
            </th>
            <th
              scope="col"
              className="text-2xs text-subtle-foreground hidden px-2 py-2 text-left font-medium lg:table-cell"
            >
              {source === 'recent' ? 'Katıldı' : 'Okul maili'}
            </th>
            <th
              scope="col"
              className="text-2xs text-subtle-foreground w-24 px-2 py-2 text-left font-medium"
            >
              Sky no
            </th>
            <th scope="col" className="w-8" />
          </tr>
        </thead>
        <tbody className="divide-border-subtle divide-y">
          {paged.slice.map((person) => {
            const name = fullName(person);
            const current = openId === person.id;
            return (
              <tr key={person.id} className={`hover:bg-card h-10 ${current ? 'bg-accent' : ''}`}>
                <td className="min-w-0 px-2">
                  <Link
                    href={`/users/${encodeURIComponent(person.id)}`}
                    onClick={open(person.id)}
                    aria-current={current ? 'true' : undefined}
                    className="text-foreground-strong flex min-w-0 items-center gap-2 font-medium hover:underline"
                  >
                    <Avatar
                      name={name}
                      email={person.email}
                      src={profilePictureSrc(person)}
                      size="sm"
                    />
                    <span className="truncate">{name}</span>
                  </Link>
                </td>
                <td className="text-muted-foreground hidden truncate px-2 text-xs md:table-cell">
                  {source === 'recent' ? (person.teams ?? []).join(', ') || '—' : person.email}
                </td>
                <td className="text-muted-foreground hidden truncate px-2 text-xs lg:table-cell">
                  {source === 'recent'
                    ? person.registeredAt
                      ? fromNow(person.registeredAt)
                      : '—'
                    : person.schoolEmail || '—'}
                </td>
                <td className="text-secondary-foreground px-2 font-mono text-xs tabular-nums">
                  {person.skyNumber || '—'}
                </td>
                <td className="px-1">
                  <ChevronRight className="text-muted-foreground size-4" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ListPanel>
  );

  return (
    <div className="space-y-3">
      {members && trend ? (
        <div className="border-border-subtle flex flex-wrap items-center gap-x-6 gap-y-2 border-b pb-3">
          <Figure label="Aktif üye" value={members.active}>
            <Sparkline
              values={members.newByMonth.map((month) => month.count)}
              className="h-5 w-24"
            />
          </Figure>
          <Figure label="Bu ay yeni" value={trend.current}>
            <TrendBadge value={trend.change} />
          </Figure>
          <Figure label="Son 12 ay" value={trend.year} />
          <p className="text-3xs text-subtle-foreground ml-auto">
            {fromNow(members.asOf)} güncellendi
          </p>
        </div>
      ) : null}
      <Tabs
        value={source === 'search' ? 'search' : tab}
        onValueChange={(next) => {
          if (next === 'search') return;
          onQuery('');
          setTab(next as Source);
        }}
      >
        <TabsList aria-label="Görünüm">
          <Tab value="recent">
            Son katılanlar
            <span className="text-3xs text-subtle-foreground ml-1.5 tabular-nums">
              {recent.length}
            </span>
          </Tab>
          <Tab value="team" disabled={!teamId}>
            {teamName ? `${teamName}` : 'Ekip'}
            {teamId ? (
              <span className="text-3xs text-subtle-foreground ml-1.5 tabular-nums">
                {teamMembers.length}
              </span>
            ) : null}
          </Tab>
          {ready ? (
            <Tab value="search">
              Arama
              <span className="text-3xs text-subtle-foreground ml-1.5 tabular-nums">
                {results.length}
              </span>
            </Tab>
          ) : null}
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-2">
        {search}
        {teamPicker}
      </div>
      <div className={docked && openId ? 'grid grid-cols-[minmax(0,1fr)_360px] gap-4' : ''}>
        <div className="min-w-0 space-y-3">
          {waiting ? null : table}
          {footer}
        </div>
        {docked && openId ? (
          <aside
            aria-label="Kişi"
            className="border-border-subtle bg-card sticky top-4 self-start rounded-lg border p-4"
          >
            <div className="mb-2 flex justify-end">
              <IconButton
                icon={X}
                size="icon-sm"
                variant="ghost"
                label="Kapat"
                onClick={() => show(null)}
              />
            </div>
            <PersonPeek id={openId} fallback={openRow} />
          </aside>
        ) : null}
      </div>
      {docked ? null : (
        <Drawer
          open={openId !== null}
          onClose={() => show(null)}
          title={openRow ? fullName(openRow) : 'Kişi'}
        >
          {openId ? <PersonPeek id={openId} fallback={openRow} /> : null}
        </Drawer>
      )}
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
      <span className="text-2xs text-subtle-foreground font-medium">{label}</span>
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

function Figure({
  label,
  value,
  children,
}: {
  label: string;
  value: number;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div>
        <p className="text-3xs text-subtle-foreground">{label}</p>
        <p className="text-foreground-strong text-lg leading-tight font-semibold tabular-nums">
          {value}
        </p>
      </div>
      {children}
    </div>
  );
}

/** Direction A's row: a person at a glance, two lines, teams or school beside. */
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
          <span className="text-2xs text-subtle-foreground block truncate">{second}</span>
        ) : null}
        {person.teams && person.teams.length ? (
          <span className="flex flex-wrap items-center gap-1">
            {person.teams.map((team) => (
              <Badge key={team} tone="neutral">
                {team}
              </Badge>
            ))}
            {person.registeredAt ? (
              <span className="text-3xs text-subtle-foreground">
                {fromNow(person.registeredAt)}
              </span>
            ) : null}
          </span>
        ) : third ? (
          <span className="text-3xs text-muted-foreground block truncate">{third}</span>
        ) : null}
      </span>
      {person.skyNumber ? <StatusChip kind="member" label={person.skyNumber} /> : null}
      <ChevronRight className="text-muted-foreground group-hover/row:text-skylab-300 size-4 shrink-0" />
    </Link>
  );
}

/** Direction B's quick look: who, where they belong, what they may do; the card for more. */
function PersonPeek({ id, fallback }: { id: string; fallback?: DirectoryRow }) {
  const [card, setCard] = useState<UserCard | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setCard(null);
    setFailed(false);
    identityApi
      .getUser(id)
      .then((next) => live && setCard(next))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [id]);
  const person = card ?? fallback;
  if (!person) {
    return (
      <p className="text-muted-foreground text-sm">{failed ? 'Kişi yüklenemedi' : 'Yükleniyor…'}</p>
    );
  }
  const name = fullName(person);
  const roles = rolesByApp([...(card?.inheritedRoles ?? []), ...(card?.extraRoles ?? [])]);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar name={name} email={person.email} src={profilePictureSrc(person)} size="lg" />
        <div className="min-w-0">
          <p className="text-foreground-strong truncate text-base font-semibold">{name}</p>
          <p className="text-muted-foreground truncate text-sm">{person.email}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {person.skyNumber ? <StatusChip kind="member" label={person.skyNumber} /> : null}
            {person.schoolEmail ? <StatusChip kind="neutral" label={person.schoolEmail} /> : null}
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Bölüm</dt>
        <dd className="text-secondary-foreground truncate">{person.department || '—'}</dd>
        <dt className="text-muted-foreground">Üniversite</dt>
        <dd className="text-secondary-foreground truncate">{person.university || '—'}</dd>
      </dl>
      <section className="space-y-2">
        <h3 className="text-foreground text-sm font-semibold">
          Gruplar{' '}
          <span className="text-subtle-foreground font-normal">{card?.groups?.length ?? ''}</span>
        </h3>
        <ul className="space-y-1">
          {(card?.groups ?? []).map((group) => (
            <li key={group.id}>
              <Link
                href={`/groups/${encodeURIComponent(group.id)}`}
                className="text-secondary-foreground hover:text-foreground text-xs"
              >
                {groupTrail(group.path).join(' › ')}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <h3 className="text-foreground text-sm font-semibold">Yetkiler</h3>
        {roles.length ? (
          <ul className="space-y-1.5">
            {roles.map((entry) => (
              <li key={entry.app} className="flex flex-wrap items-center gap-1">
                <span className="text-muted-foreground w-20 shrink-0 text-xs">{entry.app}</span>
                {entry.roles.map((role) => (
                  <Badge key={role} tone="neutral">
                    {role}
                  </Badge>
                ))}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-subtle-foreground text-xs">{card ? 'Rol yok' : '…'}</p>
        )}
      </section>
      <Link
        href={`/users/${encodeURIComponent(id)}`}
        className="text-skylab-300 inline-block text-sm hover:underline"
      >
        Kişi kartını aç
      </Link>
    </div>
  );
}
