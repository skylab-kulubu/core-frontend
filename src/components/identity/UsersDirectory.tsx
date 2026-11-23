'use client';

import {
  Card,
  DataListTitle,
  MenuLinkItem,
  Sparkline,
  TrendBadge,
  type DataListColumn,
} from '@skylab-kulubu/skylcn-ui';
import { DataList } from '@/components/chrome/DataList';
import { Plus, RefreshCw, UserRound, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Avatar } from '@/components/chrome/Avatar';
import {
  ListPage,
  RowMenu,
  SelectionBar,
  SummaryStrip,
  selectionColumn,
  useRowSelection,
} from '@/components/chrome/ListPage';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { ObjectCard, ObjectEssentials } from '@/components/chrome/object-page/ObjectPage';
import { EmptyState } from '@/components/chrome/PageState';
import { BarChart } from '@/components/chrome/PanelChart';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { Select } from '@/components/chrome/Select';
import { SidePanel, panelNeighbours } from '@/components/chrome/SidePanel';
import { StatusChip } from '@/components/chrome/StatusChip';
import { fromNow } from '@/components/dashboard/format';
import { personSearchReady } from '@/components/identity/use-person-search';
import {
  UNVERIFIED_ADD_ACTION,
  unverifiedBatchText,
  warnsUnverified,
} from '@/components/identity/use-member-add';
import { ProblemError } from '@/lib/api/core';
import { dashboardApi, type DashboardSummary } from '@/lib/api/dashboard';
import {
  identityApi,
  type DirectoryFilter,
  type DirectoryPerson,
  type Group,
  type UserCard,
} from '@/lib/api/identity';
import { coreProblemMessage } from '@/lib/core-problems';
import { monthLabel } from '@/lib/dashboard/charts';
import { groupTitle, personName } from '@/lib/group-page';
import { paginateRows } from '@/lib/list-query';
import { mapLimit } from '@/lib/map-limit';
import { pickerMatch } from '@/lib/picker';
import { profilePictureSrc } from '@/lib/profile-picture';
import { monthChange, teamGroups } from '@/lib/user-directory';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useListParams } from '@/lib/ui/use-list-params';
import { useNotify } from '@/lib/ui/use-notify';

/** One row: a person of the directory, a team member or a recent joiner. */
type Row = DirectoryPerson & { teams?: string[]; registeredAt?: string };

type UserView = 'all' | 'new' | 'no_school_email';

const VIEW_FILTER: Record<UserView, DirectoryFilter> = {
  all: '',
  new: 'new',
  no_school_email: 'no_school_email',
};

/** core refused some of the adds; the message says who and why. */
class AddsRefused extends Error {}

/**
 * Where the rows come from: core's directory, a page at a time; or, with an older
 * core that has none, the latest joiners, a team or the search (as before).
 */
type Source = 'directory' | 'recent' | 'team' | 'search';

function joinedAt(row: Row): string | undefined {
  return row.createdAt ?? row.registeredAt;
}

/**
 * Kullanıcılar (Entra "All users", M365 "Active users"): member figures over the
 * list of people, a page of fifty at a time, with a search, views and a team
 * filter. A row opens the person beside the list; chosen rows go into a Group
 * together.
 */
export function UsersDirectory({
  canCreate,
  onCreate,
  canAddToGroup,
  canFilter = true,
  reloadKey = 0,
}: {
  canCreate: boolean;
  onCreate: () => void;
  /** core's group.write: the chosen people can be put in a Group. */
  canAddToGroup: boolean;
  /** core's user.readFull: the directory's views (core refuses a filter to anyone else). */
  canFilter?: boolean;
  /** Bumped after a person is added, to read the list again. */
  reloadKey?: number;
}) {
  const [params, setParams] = useListParams({ view: 'all' });
  const view: UserView = (['all', 'new', 'no_school_email'] as const).includes(
    params.view as UserView,
  )
    ? (params.view as UserView)
    : 'all';
  const [teamId, setTeamId] = useState('');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryRead, setSummaryRead] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  // null until core answered whether it has the directory
  const [hasDirectory, setHasDirectory] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const latest = useRef(0);
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  const [groupPick, setGroupPick] = useState(false);
  const [groupQuery, setGroupQuery] = useState('');
  const [card, setCard] = useState<UserCard | null>(null);

  const query = params.q.trim();
  const searching = personSearchReady(params.q);
  const source: Source =
    teamId !== '' ? 'team' : hasDirectory ? 'directory' : searching ? 'search' : 'recent';

  useEffect(() => {
    let live = true;
    dashboardApi
      .summary()
      .then((next) => live && setSummary(next))
      .catch(() => live && setSummary(null))
      .finally(() => live && setSummaryRead(true));
    identityApi
      .listGroups()
      .then((next) => live && setGroups(next))
      .catch(() => live && setGroups([]));
    return () => {
      live = false;
    };
  }, []);

  // Whether core has the directory, as read: kept apart from the state so finding
  // out does not read the list a second time
  const directory = useRef<boolean | null>(null);
  const read = useCallback(async () => {
    const run = ++latest.current;
    setLoading(true);
    try {
      if (teamId) {
        const members = await identityApi.members(teamId);
        if (run !== latest.current) return;
        const matching = members.filter((m) =>
          pickerMatch(query, m.firstName, m.lastName, m.email),
        );
        setRows(matching);
        setTotal(matching.length);
        setFailed(null);
        return;
      }
      if (directory.current !== false) {
        try {
          const page = await identityApi.userDirectory({
            page: params.page,
            size: params.size,
            q: query,
            filter: canFilter ? VIEW_FILTER[view] : '',
          });
          if (run !== latest.current) return;
          directory.current = true;
          setHasDirectory(true);
          setRows(page.items ?? []);
          setTotal(page.total ?? 0);
          setFailed(null);
          return;
        } catch (err) {
          // An older core: the directory is not there; read as before
          if (!(err instanceof ProblemError && (err.status === 404 || err.status === 405))) {
            throw err;
          }
          directory.current = false;
          if (run === latest.current) setHasDirectory(false);
        }
      }
      if (searching) {
        const found = await identityApi.listUsers(query);
        if (run !== latest.current) return;
        setRows(found);
        setTotal(found.length);
      } else {
        // The latest joiners come with the figures
        setRows([]);
        setTotal(0);
      }
      if (run === latest.current) setFailed(null);
    } catch (err) {
      if (run === latest.current) setFailed(coreProblemMessage(err, 'Kullanıcılar yüklenemedi'));
    } finally {
      if (run === latest.current) setLoading(false);
    }
  }, [teamId, params.page, params.size, query, view, searching, canFilter]);

  useEffect(() => {
    // The search waits a moment; the rest reads at once
    const handle = window.setTimeout(() => void read(), 0);
    return () => window.clearTimeout(handle);
  }, [read, reloadKey, round]);

  const members = summary?.members ?? null;
  const trend = members ? monthChange(members.newByMonth) : null;
  const recent: Row[] = useMemo(
    () => (members?.recentJoiners ?? []).map((person) => ({ ...person, email: '' })),
    [members],
  );
  const shownRows = source === 'recent' ? recent : rows;
  // core pages the directory; the other sources are read whole and paged here
  const paged =
    source === 'directory'
      ? {
          slice: shownRows,
          page: params.page,
          totalPages: Math.max(1, Math.ceil(total / params.size)),
        }
      : paginateRows(shownRows, params.page, params.size);
  const count = source === 'directory' ? total : shownRows.length;
  const selection = useRowSelection(`${params.q}|${view}|${paged.page}|${teamId}`);
  const open = panelNeighbours(paged.slice, params.panel, (row) => row.id);
  const teams = useMemo(() => teamGroups(groups), [groups]);
  const waiting = source === 'recent' ? !summaryRead : loading;

  // The open person's card: their Groups beside the list
  useEffect(() => {
    if (!open.row) {
      setCard(null);
      return;
    }
    let live = true;
    identityApi
      .getUser(open.row.id)
      .then((next) => live && setCard(next))
      .catch(() => live && setCard(null));
    return () => {
      live = false;
    };
  }, [open.row?.id]);

  async function addChosenTo(group: Group) {
    setGroupPick(false);
    const chosen = paged.slice.filter((row) => selection.selected.has(row.id));
    if (!chosen.length) return;
    const warns = await mapLimit(chosen, 3, (row) => warnsUnverified(group.id, row.id));
    const flagged = chosen.filter((_, at) => warns[at]);
    let left = chosen;
    confirm({
      title:
        chosen.length === 1
          ? `${personName(chosen[0]!)} ${group.name} grubuna eklensin mi?`
          : `${chosen.length} kişi ${group.name} grubuna eklensin mi?`,
      description: flagged.length
        ? unverifiedBatchText(
            chosen.length,
            flagged.map((row) => ({ name: personName(row), email: row.email })),
          )
        : undefined,
      actionLabel: UNVERIFIED_ADD_ACTION,
      destructive: false,
      onConfirm: async () => {
        const failures: string[] = [];
        const done: string[] = [];
        for (const row of left) {
          try {
            if (flagged.includes(row)) {
              await identityApi.addMember(group.id, row.id, { unverifiedAck: true });
            } else {
              await identityApi.addMember(group.id, row.id);
            }
            done.push(row.id);
          } catch (err) {
            failures.push(`${personName(row)}: ${coreProblemMessage(err, 'Eklenemedi')}`);
          }
        }
        left = left.filter((row) => !done.includes(row.id));
        if (done.length) {
          notify.success(
            done.length === 1 ? `${group.name} grubuna eklendi` : `${done.length} kişi eklendi`,
          );
          selection.clear();
        }
        if (failures.length) throw new AddsRefused(failures.join(' '));
      },
      failure: (err) =>
        err instanceof AddsRefused ? err.message : coreProblemMessage(err, 'Eklenemedi'),
    });
  }

  const chooses = canAddToGroup && paged.slice.length > 0 && source !== 'recent';
  const columns: DataListColumn<Row>[] = [
    ...(chooses
      ? [
          selectionColumn<Row>({
            selection,
            pageIds: paged.slice.map((row) => row.id),
            idOf: (row) => row.id,
            nameOf: personName,
          }),
        ]
      : []),
    {
      id: 'name',
      width: 'minmax(0,1fr)',
      header: 'Ad',
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={personName(row)} email={row.email} src={profilePictureSrc(row)} size="sm" />
          <DataListTitle
            title={personName(row)}
            subtitle={
              <span className={`${TEXT_SECONDARY} block truncate`}>
                {row.email || row.teams?.join(' · ') || ''}
              </span>
            }
          />
        </span>
      ),
    },
    {
      id: 'school',
      width: '13rem',
      from: 'lg',
      header: 'Okul e-postası',
      cell: (row) =>
        row.schoolEmail ? (
          <span className={`text-secondary-foreground ${TEXT_SECONDARY} block truncate`}>
            {row.schoolEmail}
          </span>
        ) : source === 'recent' ? null : (
          <StatusChip kind="pending" label="Yok" />
        ),
    },
    {
      id: 'sky',
      width: '7rem',
      from: 'md',
      header: 'Sky no',
      cell: (row) =>
        row.skyNumber ? (
          <span className={`text-secondary-foreground tabular-nums ${TEXT_SECONDARY}`}>
            {row.skyNumber}
          </span>
        ) : null,
    },
    {
      id: 'joined',
      width: '7rem',
      from: 'sm',
      header: 'Katıldı',
      cell: (row) => {
        const at = joinedAt(row);
        return at ? (
          <span className={`text-secondary-foreground ${TEXT_SECONDARY}`}>{fromNow(at)}</span>
        ) : null;
      },
    },
    {
      id: 'actions',
      width: '2.5rem',
      label: 'Eylemler',
      interactive: true,
      align: 'end',
      cell: (row) => (
        <RowMenu rowName={personName(row)}>
          <MenuLinkItem
            icon={UserRound}
            render={<Link href={`/users/${encodeURIComponent(row.id)}`} />}
          >
            Kişi kartı
          </MenuLinkItem>
        </RowMenu>
      ),
    },
  ];

  const listTitle =
    source === 'team'
      ? `${(() => {
          const team = teams.find((t) => t.id === teamId);
          return team ? groupTitle(team) : 'Ekip';
        })()} üyeleri`
      : source === 'recent'
        ? 'Son katılanlar'
        : null;

  const empty = failed ? (
    <EmptyState kind="failed" title={failed} onRetry={() => setRound((n) => n + 1)} />
  ) : query || view !== 'all' || teamId ? (
    <EmptyState
      kind="no-results"
      onClear={() => {
        setTeamId('');
        setParams({ q: '', view: 'all' });
      }}
    />
  ) : (
    <EmptyState
      kind="first-use"
      title="Henüz kullanıcı yok"
      action={
        canCreate ? (
          <Command primary icon={Plus} label="Kullanıcı ekle" onClick={onCreate} />
        ) : undefined
      }
    />
  );

  return (
    <ListPage
      title="Kullanıcılar"
      commands={
        selection.count ? (
          <SelectionBar count={selection.count} onClear={selection.clear}>
            <Command
              icon={UsersRound}
              label="Gruba ekle"
              onClick={() => {
                setGroupQuery('');
                setGroupPick(true);
              }}
            />
          </SelectionBar>
        ) : (
          <CommandBar label="Kullanıcı komutları">
            {canCreate ? (
              <Command primary icon={Plus} label="Kullanıcı ekle" onClick={onCreate} />
            ) : null}
            <Command icon={RefreshCw} label="Yenile" onClick={() => setRound((n) => n + 1)} />
          </CommandBar>
        )
      }
      summary={
        members && trend ? (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <SummaryStrip
              items={[
                {
                  key: 'active',
                  label: 'Aktif üye',
                  value: members.active,
                  active: view === 'all' && !teamId,
                  onSelect: () => {
                    setTeamId('');
                    setParams({ view: 'all' });
                  },
                  hint: (
                    <Sparkline
                      values={members.newByMonth.map((month) => month.count)}
                      className="h-6 w-full"
                    />
                  ),
                },
                {
                  key: 'new',
                  label: 'Bu ay yeni',
                  value: trend.current,
                  active: view === 'new',
                  onSelect:
                    hasDirectory && canFilter
                      ? () => {
                          setTeamId('');
                          setParams({ view: 'new' });
                        }
                      : undefined,
                  hint: <TrendBadge value={trend.change} />,
                },
              ]}
            />
            <Card className="p-4">
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
        ) : null
      }
      toolbar={
        <ListToolbar
          query={params.q}
          onQuery={(q) => setParams({ q })}
          commitDelay={250}
          placeholder="Ad, e-posta, okul maili"
          searchLabel="Kullanıcı ara"
          views={
            hasDirectory && canFilter && !teamId
              ? [
                  { value: 'all', label: 'Hepsi' },
                  { value: 'new', label: 'Bu ay yeni' },
                  { value: 'no_school_email', label: 'Okul e-postası yok' },
                ]
              : undefined
          }
          view={view}
          onView={(next) => setParams({ view: next })}
        >
          <Select
            aria-label="Ekip"
            className="w-full sm:w-48"
            value={teamId}
            onChange={(change) => {
              setTeamId(change.target.value);
              setParams({ page: 1, panel: null });
            }}
          >
            <option value="">Ekip: hepsi</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {groupTitle(team)}
              </option>
            ))}
          </Select>
        </ListToolbar>
      }
      paging={{
        total: count,
        page: paged.page,
        pageSize: params.size,
        onPage: (page) => setParams({ page }),
        onPageSize: (size) => setParams({ size }),
      }}
    >
      {listTitle ? (
        <h2 className={`text-muted-foreground font-medium ${TEXT_SECONDARY}`}>{listTitle}</h2>
      ) : null}
      {!waiting && (failed || paged.slice.length === 0) ? (
        empty
      ) : (
        <DataList
          columns={columns}
          rows={paged.slice}
          getRowId={(row) => row.id}
          onRowSelect={(row) => setParams({ panel: row.id })}
          rowLabel={personName}
          loading={waiting}
          skeletonRows={8}
        />
      )}
      {confirmDialog}
      <SidePanel
        open={Boolean(open.row)}
        title={open.row ? personName(open.row) : ''}
        href={open.row ? `/users/${encodeURIComponent(open.row.id)}` : undefined}
        onPrev={open.prev ? () => setParams({ panel: open.prev }) : undefined}
        onNext={open.next ? () => setParams({ panel: open.next }) : undefined}
        onClose={() => setParams({ panel: null })}
      >
        {open.row ? <PersonPanel row={open.row} card={card} /> : null}
      </SidePanel>
      <PickerDrawer
        open={groupPick}
        onClose={() => setGroupPick(false)}
        title="Gruba ekle"
        query={groupQuery}
        onQuery={setGroupQuery}
        placeholder="Grup adı veya yolu"
        loading={false}
        options={groups
          .filter((g) => pickerMatch(groupQuery, g.name, g.path, groupTitle(g)))
          .map((g) => ({ id: g.id, title: groupTitle(g), subtitle: g.path }))}
        emptyMessage="Grup yok"
        onPick={(picked) => {
          const group = groups.find((g) => g.id === picked);
          if (group) void addChosenTo(group);
        }}
      />
    </ListPage>
  );
}

/** One person beside the list: their facts and their Groups. */
function PersonPanel({ row, card }: { row: Row; card: UserCard | null }) {
  const at = joinedAt(row);
  const items: { label: string; value: ReactNode }[] = [
    ...(row.email
      ? [{ label: 'E-posta', value: <span className="break-all">{row.email}</span> }]
      : []),
    {
      label: 'Okul e-postası',
      value:
        (card?.schoolEmail ?? row.schoolEmail) ? (
          <span className="break-all">{card?.schoolEmail ?? row.schoolEmail}</span>
        ) : (
          'Yok'
        ),
    },
    ...((card?.skyNumber ?? row.skyNumber)
      ? [{ label: 'Sky no', value: card?.skyNumber ?? row.skyNumber }]
      : []),
    ...(card?.department ? [{ label: 'Bölüm', value: card.department }] : []),
    ...(at ? [{ label: 'Katıldı', value: fromNow(at) }] : []),
  ];
  return (
    <>
      <ObjectEssentials columns={1} items={items} />
      {card?.groups?.length ? (
        <ObjectCard title="Gruplar">
          <ul className="flex flex-wrap gap-1.5">
            {card.groups.map((group) => (
              <li key={group.id}>
                <Link href={`/groups/${encodeURIComponent(group.id)}`}>
                  <StatusChip kind="neutral" label={group.path} />
                </Link>
              </li>
            ))}
          </ul>
        </ObjectCard>
      ) : null}
    </>
  );
}
