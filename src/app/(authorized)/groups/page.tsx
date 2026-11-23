'use client';

import { DataList, DataListTitle, type DataListColumn } from '@skylab-kulubu/skylcn-ui';
import { CalendarDays, ChevronDown, ChevronRight, Plus, RefreshCw, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListFooter, ListPage, SummaryStrip } from '@/components/chrome/ListPage';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { ObjectEssentials } from '@/components/chrome/object-page/ObjectPage';
import { EmptyState } from '@/components/chrome/PageState';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { SaveButton } from '@/components/chrome/SaveButton';
import { SidePanel, panelNeighbours } from '@/components/chrome/SidePanel';
import { StatusChip } from '@/components/chrome/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { identityApi, type Group, type ManagedGroup } from '@/lib/api/identity';
import { isPrivileged } from '@/lib/auth/groups';
import { coreProblemMessage, groupWriteProblemMessage } from '@/lib/core-problems';
import {
  GROUP_KIND_LABELS,
  groupKind,
  groupSectionHref,
  groupTitle,
  groupTreeRows,
  type GroupKind,
} from '@/lib/group-page';
import { flattenManagedGroups, useManagedGroups } from '@/lib/managed-groups';
import { pickerMatch } from '@/lib/picker';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { useDirtySince } from '@/lib/ui/use-unsaved-changes';
import { useListParams } from '@/lib/ui/use-list-params';
import { useNotify } from '@/lib/ui/use-notify';
import { useAppCan } from '@/lib/use-app-can';

type GroupView = 'all' | 'management' | 'teams' | 'leaderless';

const VIEW_LABELS: Record<Exclude<GroupView, 'leaderless'>, string> = {
  all: 'Hepsi',
  management: 'Yönetim',
  teams: 'Ekipler',
};

const TEAM_KINDS: readonly GroupKind[] = ['team', 'subteam'];

/**
 * Gruplar (Entra "All groups"): the club's Groups as a tree, with their kind and,
 * for a Team, its members and Leaders from core's managed tree. The Ekipler view
 * is the former Ekipler page. A row opens its facts beside the list.
 */
export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const [params, setParams] = useListParams({ view: 'all' });
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [parentOpen, setParentOpen] = useState(false);
  const createDirty = useDirtySince(creating, { name, parentId });
  const [parentQuery, setParentQuery] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const notify = useNotify();
  const { user } = useAuth();
  // core's group.write (a DK member reads only); the group rule stands in only when it cannot be read
  const can = useAppCan(isPrivileged(user?.groups ?? []));
  const canWrite = can('group.write');
  // core answers its managed tree to a Group reader: every Team with its counts
  const managed = useManagedGroups({ privileged: canWrite || can('group.read') });
  const teams = useMemo(() => {
    const byId = new Map<string, ManagedGroup>();
    if (managed.status === 'ready') {
      for (const row of flattenManagedGroups(managed.groups)) byId.set(row.group.id, row.group);
    }
    return byId;
  }, [managed]);

  function load() {
    setLoading(true);
    identityApi
      .listGroups()
      .then((rows) => {
        setGroups(rows);
        setError(null);
      })
      .catch((err) => setError(coreProblemMessage(err, 'Gruplar yüklenemedi')))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const view: GroupView = (['all', 'management', 'teams', 'leaderless'] as const).includes(
    params.view as GroupView,
  )
    ? (params.view as GroupView)
    : 'all';
  const kindOf = useMemo(() => new Map(groups.map((g) => [g.id, groupKind(g.path)])), [groups]);
  const inView = (which: GroupView, g: Group) => {
    const kind = kindOf.get(g.id) ?? 'area';
    if (which === 'management') return kind === 'management';
    if (which === 'teams') return TEAM_KINDS.includes(kind);
    if (which === 'leaderless')
      return TEAM_KINDS.includes(kind) && teams.get(g.id)?.leaderCount === 0;
    return true;
  };
  const count = (which: GroupView) => groups.filter((g) => inView(which, g)).length;
  const query = params.q.trim();
  const shown = groups.filter(
    (g) => inView(view, g) && (!query || pickerMatch(query, g.name, g.path, groupTitle(g))),
  );
  // A search or a narrow view lists its rows flat; the whole list is the tree
  const tree = view === 'all' && !query;
  const rows = tree
    ? groupTreeRows(shown, folded)
    : groupTreeRows(shown).map((row) => ({ ...row, depth: 0, hasChildren: false }));
  const open = panelNeighbours(rows, params.panel, (row) => row.group.id);
  const openGroup = open.row?.group;
  const parent = groups.find((g) => g.id === parentId);
  const teamRows = groups.filter((g) => TEAM_KINDS.includes(kindOf.get(g.id) ?? 'area'));
  const teamMembers = [...teams.values()]
    .filter((team) => team.path.split('/').filter(Boolean).length === 3)
    .reduce((sum, team) => sum + (team.memberCount ?? 0), 0);
  const leaderless = count('leaderless');

  function toggle(path: string) {
    setFolded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  const columns: DataListColumn<(typeof rows)[number]>[] = [
    {
      id: 'name',
      width: 'minmax(0,1fr)',
      header: 'Ad',
      interactive: true,
      cell: ({ group, depth, hasChildren }) => (
        <span
          className="flex min-w-0 items-center gap-1"
          style={{ paddingInlineStart: `${depth * 1.25}rem` }}
        >
          {tree && hasChildren ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground -ms-1 rounded p-0.5"
              aria-expanded={!folded.has(group.path)}
              aria-label={`${group.name}: ${folded.has(group.path) ? 'aç' : 'kapat'}`}
              onClick={() => toggle(group.path)}
            >
              {folded.has(group.path) ? (
                <ChevronRight className="size-4" aria-hidden />
              ) : (
                <ChevronDown className="size-4" aria-hidden />
              )}
            </button>
          ) : (
            <span className="w-5 shrink-0" aria-hidden />
          )}
          {/* The row's own button names it; this one only takes the click inside the cell */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="min-w-0 text-left"
            onClick={() => setParams({ panel: group.id })}
          >
            <DataListTitle
              title={groupTitle(group)}
              subtitle={
                <span className={`${TEXT_SECONDARY} break-all`}>
                  {tree ? group.name : group.path}
                </span>
              }
            />
          </button>
        </span>
      ),
    },
    {
      id: 'kind',
      width: '7rem',
      from: 'sm',
      header: 'Tür',
      cell: ({ group }) => (
        <StatusChip kind="neutral" label={GROUP_KIND_LABELS[kindOf.get(group.id) ?? 'area']} />
      ),
    },
    {
      id: 'members',
      width: '5rem',
      align: 'end',
      header: 'Üye',
      cell: ({ group }) => (
        <span className={`text-secondary-foreground tabular-nums ${TEXT_SECONDARY}`}>
          {teams.get(group.id)?.memberCount ?? '—'}
        </span>
      ),
    },
    {
      id: 'leaders',
      width: '5rem',
      from: 'md',
      align: 'end',
      header: 'Lider',
      cell: ({ group }) => {
        const team = teams.get(group.id);
        if (!team) return <span className="text-subtle-foreground">—</span>;
        return team.leaderCount === 0 ? (
          <StatusChip kind="pending" label="Yok" />
        ) : (
          <span className={`text-secondary-foreground tabular-nums ${TEXT_SECONDARY}`}>
            {team.leaderCount}
          </span>
        );
      },
    },
  ];

  const openTeam = openGroup ? teams.get(openGroup.id) : undefined;

  return (
    <ListPage
      title="Gruplar"
      commands={
        <CommandBar label="Grup komutları">
          {canWrite ? (
            <Command
              primary
              icon={Plus}
              label="Grup ekle"
              onClick={() => {
                setCreateError(null);
                setCreating(true);
              }}
            />
          ) : null}
          <Command icon={RefreshCw} label="Yenile" onClick={load} />
        </CommandBar>
      }
      summary={
        teams.size ? (
          <SummaryStrip
            items={[
              {
                key: 'teams',
                label: 'Ekip',
                value: teamRows.length,
                active: view === 'teams',
                onSelect: () => setParams({ view: 'teams' }),
              },
              { key: 'members', label: 'Ekiplerde üye', value: teamMembers },
              {
                key: 'leaderless',
                label: 'Lidersiz ekip',
                value: leaderless,
                active: view === 'leaderless',
                onSelect: leaderless ? () => setParams({ view: 'leaderless' }) : undefined,
              },
            ]}
          />
        ) : null
      }
      toolbar={
        <ListToolbar
          query={params.q}
          onQuery={(q) => setParams({ q })}
          commitDelay={250}
          placeholder="Ad veya yol"
          searchLabel="Grup ara"
          views={(Object.keys(VIEW_LABELS) as Exclude<GroupView, 'leaderless'>[]).map((value) => ({
            value,
            label: VIEW_LABELS[value],
            count: count(value),
          }))}
          view={view === 'leaderless' ? undefined : view}
          onView={(next) => setParams({ view: next })}
        />
      }
      footer={
        <ListFooter total={rows.length} page={1} totalPages={1} noun="grup" onPage={() => {}} />
      }
    >
      {!loading && (error || rows.length === 0) ? (
        error ? (
          <EmptyState kind="failed" title={error} onRetry={load} />
        ) : query || view !== 'all' ? (
          <EmptyState kind="no-results" onClear={() => setParams({ q: '', view: 'all' })} />
        ) : (
          <EmptyState kind="first-use" title="Henüz grup yok" />
        )
      ) : (
        <DataList
          columns={columns}
          rows={rows}
          getRowId={(row) => row.group.id}
          onRowSelect={(row) => setParams({ panel: row.group.id })}
          rowLabel={(row) => groupTitle(row.group)}
          loading={loading}
          skeletonRows={8}
        />
      )}
      <SidePanel
        open={Boolean(openGroup)}
        title={openGroup ? groupTitle(openGroup) : ''}
        href={openGroup ? groupSectionHref('/groups', openGroup.id, 'overview') : undefined}
        onPrev={open.prev ? () => setParams({ panel: open.prev }) : undefined}
        onNext={open.next ? () => setParams({ panel: open.next }) : undefined}
        onClose={() => setParams({ panel: null })}
      >
        {openGroup ? (
          <>
            <CommandBar label="Grup komutları">
              <Command
                icon={Users}
                label="Üyeler"
                href={groupSectionHref('/groups', openGroup.id, 'members')}
              />
              {openTeam ? (
                <Command
                  icon={CalendarDays}
                  label="Etkinlikler"
                  href={`/events?ownerTeam=${encodeURIComponent(openGroup.name)}`}
                />
              ) : null}
            </CommandBar>
            <ObjectEssentials
              columns={1}
              items={[
                { label: 'Kod', value: openGroup.name },
                { label: 'Tür', value: GROUP_KIND_LABELS[kindOf.get(openGroup.id) ?? 'area'] },
                { label: 'Yol', value: <span className="break-all">{openGroup.path}</span> },
                ...(openTeam
                  ? [
                      { label: 'Üye', value: String(openTeam.memberCount ?? 0) },
                      {
                        label: 'Lider',
                        value: openTeam.leaderCount ? String(openTeam.leaderCount) : 'Yok',
                      },
                      { label: 'Alt ekip', value: String(openTeam.children?.length ?? 0) },
                    ]
                  : []),
              ]}
            />
          </>
        ) : null}
      </SidePanel>
      <Drawer
        open={creating}
        onClose={() => {
          // Closed without adding (or after "Değişiklikleri sil"): the next one starts empty
          setCreating(false);
          setName('');
          setParentId('');
        }}
        title="Grup ekle"
        dirty={createDirty}
      >
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setCreateError(null);
            try {
              const created = await identityApi.createGroup({
                name: name.trim(),
                parentId: parentId || undefined,
              });
              setGroups((prev) => [...prev, created]);
              setName('');
              setParentId('');
              setCreating(false);
              notify.success('Grup oluşturuldu');
            } catch (err) {
              setCreateError(groupWriteProblemMessage(err, 'create', 'Oluşturulamadı'));
            }
          }}
        >
          <label className="block space-y-1">
            <FieldLabel>Ad</FieldLabel>
            <Field value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Üst grup</FieldLabel>
            <button
              type="button"
              className="focus:border-skylab-400/50 border-border bg-card text-foreground h-9 w-full rounded-lg border px-2.5 text-left text-sm pointer-coarse:h-11 pointer-coarse:text-base"
              onClick={() => {
                setParentQuery('');
                setParentOpen(true);
              }}
            >
              {parent ? parent.path : 'Kök'}
            </button>
          </label>
          {createError ? (
            <p role="alert" className="text-destructive text-sm">
              {createError}
            </p>
          ) : null}
          <SaveButton>Oluştur</SaveButton>
        </form>
      </Drawer>
      <PickerDrawer
        open={parentOpen}
        onClose={() => setParentOpen(false)}
        title="Üst grup"
        query={parentQuery}
        onQuery={setParentQuery}
        placeholder="Grup yolu veya adı"
        loading={false}
        options={[
          { id: '', title: 'Kök' },
          ...groups
            .filter((g) => pickerMatch(parentQuery, g.path, g.name))
            .map((g) => ({ id: g.id, title: g.path, subtitle: g.name })),
        ]}
        emptyMessage="Grup yok"
        onPick={(picked) => {
          setParentId(picked);
          setParentOpen(false);
        }}
      />
    </ListPage>
  );
}
