'use client';

import {
  DataListTitle,
  MenuItem,
  MenuLinkItem,
  type DataListColumn,
} from '@skylab-kulubu/skylcn-ui';
import { DataList } from '@/components/chrome/DataList';
import { UserMinus, UserPlus, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '@/components/chrome/Avatar';
import { ColumnPicker, useColumnChoice, type ColumnChoice } from '@/components/chrome/ColumnPicker';
import {
  ListPager,
  RowMenu,
  SelectionBar,
  selectionColumn,
  useRowSelection,
} from '@/components/chrome/ListPage';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { EmptyState } from '@/components/chrome/PageState';
import { PickerDrawer, type PickerOption } from '@/components/chrome/PickerDrawer';
import { StatusChip } from '@/components/chrome/StatusChip';
import { useGroupWorkspace } from '@/components/identity/group/GroupWorkspace';
import {
  UNVERIFIED_ADD_ACTION,
  UNVERIFIED_MARK,
  unverifiedAddText,
  unverifiedBatchText,
  warnsUnverified,
} from '@/components/identity/use-member-add';
import {
  MEMBER_CANDIDATE_HINT,
  MEMBER_CANDIDATE_MIN,
  usePickerSearch,
} from '@/components/identity/use-person-search';
import { identityApi, type Person } from '@/lib/api/identity';
import { isLeaderGroupPath } from '@/lib/auth/groups';
import { coreProblemMessage } from '@/lib/core-problems';
import { memberSourceLabel } from '@/lib/group-members';
import {
  MEMBER_ROLE_LABELS,
  addedDates,
  memberRole,
  personName,
  sortMembers,
  termsByPerson,
  type MemberRole,
} from '@/lib/group-page';
import { matchesQuery, paginateRows } from '@/lib/list-query';
import { endLabel, statusKind, statusLabel } from '@/lib/management-terms';
import { mapLimit } from '@/lib/map-limit';
import { profilePictureSrc } from '@/lib/profile-picture';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useListParams } from '@/lib/ui/use-list-params';
import { useNotify } from '@/lib/ui/use-notify';

/** core refused some of the confirmed adds; the message says who and why. */
class MembersRefused extends Error {}

/** No active account matched: the person signs up first (ticket 08; ticket 09's invite replaces it). */
const NO_CANDIDATE = "Kullanıcı yok. Kişinin önce my.yildizskylab.com'dan kaydolması gerekir.";

const REMOVE_TEXT =
  'Kişi bu grubun rollerini ve erişimlerini kaybeder. Bu ona e-postayla bildirilir. Yönetim gruplarındaki değişiklik ayrıca yöneticilere bildirilir.';

/** How many member checks (and address reads) run at once for a selection. */
const CHECKS_AT_ONCE = 3;

type MemberView = 'all' | 'leaders' | 'members';

const COLUMNS: readonly ColumnChoice[] = [
  { id: 'name', label: 'Ad', fixed: true },
  { id: 'role', label: 'Rol' },
  { id: 'from', label: 'Nereden' },
  { id: 'term', label: 'Görev sonu' },
  { id: 'added', label: 'Eklendi' },
  { id: 'actions', label: 'Eylemler', fixed: true },
];

/** An address member-candidates masked (a***@example.com): the query was no whole address. */
function masked(email: string): boolean {
  return email.includes('***');
}

function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  });
}

/**
 * The question before adding `people` when core warned of the ones in
 * `unverified` (id → the address to check). The description is left out when
 * none of them is unverified, as for a retry of a refused verified one.
 */
function unverifiedQuestion(
  people: readonly PickerOption[],
  unverified: ReadonlyMap<string, string>,
  groupName: string,
): { title: string; description: string | undefined } {
  const flagged = people.filter((person) => unverified.has(person.id));
  const title =
    people.length === 1
      ? `${people[0]!.title} ${groupName} grubuna eklensin mi?`
      : `${people.length} kişi ${groupName} grubuna eklensin mi?`;
  if (flagged.length === 0) return { title, description: undefined };
  if (people.length === 1)
    return { title, description: unverifiedAddText(unverified.get(people[0]!.id)!) };
  return {
    title,
    description: unverifiedBatchText(
      people.length,
      flagged.map((person) => ({ name: person.title, email: unverified.get(person.id)! })),
    ),
  };
}

/**
 * Üyeler: everyone in the Group and the Groups under it, with their role (Lider,
 * Koordinatör, Üye), where they sit, their term's end and when they were added
 * when core knows it. Whoever may change the members adds (the candidate search)
 * and removes them, one by one or chosen together.
 */
export function GroupMembers() {
  const {
    id,
    group,
    members,
    leaders,
    terms,
    canWrite,
    memberWrite,
    canReadUsers,
    canReadAudit,
    reload,
  } = useGroupWorkspace();
  const router = useRouter();
  const search = useSearchParams();
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  // The YTÜ question opens over the Üye ekle drawer, so it has its own dialog
  const [confirmMembers, membersDialog] = useConfirm();
  const [params, setParams] = useListParams({ view: 'all' });
  const view = (['all', 'leaders', 'members'] as const).includes(params.view as MemberView)
    ? (params.view as MemberView)
    : 'all';
  const columns = useColumnChoice('skylab.admin.columns.group-members', COLUMNS);

  const [memberOpen, setMemberOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<PickerOption[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const memberSubmit = useRef(false);
  const [addedMembers, setAddedMembers] = useState<{ groupId: string; ids: Set<string> }>({
    groupId: id,
    ids: new Set(),
  });
  const [added, setAdded] = useState<Map<string, string>>(new Map());

  // core's candidate search: names, or a whole address; masked addresses; YTÜ warnings
  const memberSearch = usePickerSearch(
    memberOpen,
    memberQuery,
    (query) => identityApi.memberCandidates(id, query),
    MEMBER_CANDIDATE_MIN,
  );

  // "Üye ekle" from the page's command bar opens the picker here
  const asked = search?.get('ekle') === '1';
  useEffect(() => {
    if (!asked || !memberWrite) return;
    setMemberQuery('');
    setSelectedMembers([]);
    setPickError(null);
    setMemberOpen(true);
    router.replace(window.location.pathname);
  }, [asked, memberWrite, router]);

  // When each one was added: the audit record's adds, for whoever reads it
  useEffect(() => {
    if (!canReadAudit) return;
    let live = true;
    identityApi
      .groupAudit(id, { actions: ['member.add', 'leader.add'], limit: 100 })
      .then((page) => live && setAdded(addedDates(page.items ?? [])))
      .catch(() => live && setAdded(new Map()));
    return () => {
      live = false;
    };
  }, [id, canReadAudit, members]);

  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);
  const roleOf = useMemo(() => {
    const roles = new Map(members.map((m) => [m.id, memberRole(m, leaders)]));
    return (m: Person): MemberRole => roles.get(m.id) ?? 'member';
  }, [members, leaders]);
  const termOf = useMemo(() => termsByPerson(terms, id, members), [terms, id, members]);
  const hasTerms = termOf.size > 0;
  const hasAdded = added.size > 0;
  const hasSources = members.some((m) => memberSourceLabel(group.path, m.sourceGroupPath));
  const sorted = useMemo(() => sortMembers(members, roleOf), [members, roleOf]);
  const inView = (which: MemberView) =>
    sorted.filter((m) =>
      which === 'all'
        ? true
        : which === 'leaders'
          ? roleOf(m) !== 'member'
          : roleOf(m) === 'member',
    );
  const rows = inView(view).filter((m) => matchesQuery(params.q, m.firstName, m.lastName, m.email));
  const paged = paginateRows(rows, params.page, params.size);
  const selection = useRowSelection(`${params.q}|${view}|${paged.page}`);
  const leaderRows = sorted.filter((m) => roleOf(m) !== 'member').length;

  /** A Leader removes members, not someone from a Leader group (that is the Leaders page). */
  const removable = (m: Person) =>
    canWrite || (memberWrite && !isLeaderGroupPath(m.sourceGroupPath));

  const memberOptions: PickerOption[] = memberSearch.people
    .filter(
      (person) =>
        !person.alreadyMember &&
        !memberIds.has(person.id) &&
        !(addedMembers.groupId === id && addedMembers.ids.has(person.id)),
    )
    .map((person) => ({
      id: person.id,
      title: `${person.firstName} ${person.lastName}`.trim() || person.email,
      subtitle: person.email,
      // Only core's warning marks a person: a Privileged Group and an account not verified with YTÜ
      marker: person.warnings.includes('not_ytu_verified') ? UNVERIFIED_MARK : undefined,
    }));

  /** Holds the picker while `work` runs: one submission at a time, and the drawer stays open. */
  async function submitting<T>(work: () => Promise<T>): Promise<T> {
    memberSubmit.current = true;
    setAddingMembers(true);
    setPickError(null);
    try {
      return await work();
    } finally {
      memberSubmit.current = false;
      setAddingMembers(false);
    }
  }

  /**
   * Adds the people in order, sending unverifiedAck for the ones in `acked`.
   * The ones core refuses stay selected; returns them with why, for the
   * caller to say in one place.
   */
  async function addMembers(
    people: PickerOption[],
    acked: ReadonlySet<string>,
  ): Promise<{ person: PickerOption; text: string }[]> {
    const failures: { person: PickerOption; text: string }[] = [];
    let count = 0;
    for (const person of people) {
      try {
        if (acked.has(person.id)) {
          await identityApi.addMember(id, person.id, { unverifiedAck: true });
        } else {
          await identityApi.addMember(id, person.id);
        }
        count += 1;
        setAddedMembers((current) => ({
          groupId: id,
          ids: new Set([...(current.groupId === id ? current.ids : []), person.id]),
        }));
        setSelectedMembers((current) => current.filter((row) => row.id !== person.id));
      } catch (err) {
        failures.push({
          person,
          text: `${person.title}: ${coreProblemMessage(err, 'Üye eklenemedi')}`,
        });
      }
    }
    if (count > 0) notify.success(count === 1 ? 'Üye eklendi' : `${count} üye eklendi`);
    if (failures.length === 0) setMemberOpen(false);
    await reload();
    return failures;
  }

  /**
   * Adds the selected people. When core warns that some are not verified
   * with YTÜ (a Privileged target, grup-yonetimi 07), it asks first and sends
   * the reader's confirmation as unverifiedAck; otherwise it adds at once.
   * The Group's Privileged state comes only from core's answer, never its
   * name, and a check that cannot be read only means no warning. Turning the
   * question down adds nobody and keeps the selection.
   *
   * The question names the address to check. The candidate search masks it
   * unless the reader typed it whole, so the person's card gives it then;
   * when the card cannot be read, the masked address stands.
   */
  async function addSelectedMembers() {
    if (memberSubmit.current || selectedMembers.length === 0) return;
    const people = selectedMembers;
    const unverified = await submitting(async () => {
      const warns = await mapLimit(people, CHECKS_AT_ONCE, (person) =>
        warnsUnverified(id, person.id),
      );
      const flagged = people.filter((_, index) => warns[index]);
      if (flagged.length === 0) {
        const failures = await addMembers(people, new Set());
        if (failures.length > 0) setPickError(failures.map((failure) => failure.text).join(' '));
        return new Map<string, string>();
      }
      const emails = await mapLimit(flagged, CHECKS_AT_ONCE, async (person) => {
        const shown = person.subtitle ?? '';
        if (!masked(shown)) return shown;
        return identityApi
          .getUser(person.id)
          .then((card) => card.email || shown)
          .catch(() => shown);
      });
      return new Map(flagged.map((person, index) => [person.id, emails[index]!]));
    });
    if (unverified.size === 0) return;
    const acked = new Set(unverified.keys());
    // A retry from the question adds, and names, only the ones core refused the last time
    let left = people;
    confirmMembers({
      ...unverifiedQuestion(people, unverified, group.name),
      actionLabel: UNVERIFIED_ADD_ACTION,
      destructive: false,
      onConfirm: async () => {
        const failures = await submitting(() => addMembers(left, acked));
        left = failures.map((failure) => failure.person);
        if (failures.length > 0) {
          throw new MembersRefused(failures.map((failure) => failure.text).join(' '));
        }
      },
      failure: (err) =>
        err instanceof MembersRefused ? err.message : coreProblemMessage(err, 'Üye eklenemedi'),
      afterFailure: () => unverifiedQuestion(left, unverified, group.name),
      closesDrawer: true,
    });
  }

  function forget(userIds: readonly string[]) {
    setAddedMembers((current) => {
      if (current.groupId !== id) return current;
      const remaining = new Set(current.ids);
      for (const userId of userIds) remaining.delete(userId);
      return { groupId: id, ids: remaining };
    });
  }

  function askRemove(m: Person) {
    confirm({
      title: `${personName(m)} ${group.name} grubundan çıkarılsın mı?`,
      description: REMOVE_TEXT,
      actionLabel: 'Gruptan çıkar',
      onConfirm: async () => {
        await identityApi.removeMember(id, m.id);
        forget([m.id]);
        notify.success('Üye çıkarıldı');
        await reload();
      },
      failure: 'Üye çıkarılamadı',
    });
  }

  /** Takes the chosen ones out in order; the ones core refuses stay chosen and are named. */
  function askRemoveChosen() {
    const chosen = paged.slice.filter((m) => selection.selected.has(m.id) && removable(m));
    if (!chosen.length) return;
    let left = chosen;
    confirm({
      title:
        chosen.length === 1
          ? `${personName(chosen[0]!)} ${group.name} grubundan çıkarılsın mı?`
          : `${chosen.length} kişi ${group.name} grubundan çıkarılsın mı?`,
      description: REMOVE_TEXT,
      actionLabel: 'Gruptan çıkar',
      onConfirm: async () => {
        const failures: string[] = [];
        const removed: string[] = [];
        for (const m of left) {
          try {
            await identityApi.removeMember(id, m.id);
            removed.push(m.id);
          } catch (err) {
            failures.push(`${personName(m)}: ${coreProblemMessage(err, 'Üye çıkarılamadı')}`);
          }
        }
        forget(removed);
        left = left.filter((m) => !removed.includes(m.id));
        if (removed.length) {
          notify.success(
            removed.length === 1 ? 'Üye çıkarıldı' : `${removed.length} üye çıkarıldı`,
          );
          selection.clear();
          await reload();
        }
        if (failures.length) throw new MembersRefused(failures.join(' '));
      },
      failure: (err) =>
        err instanceof MembersRefused ? err.message : coreProblemMessage(err, 'Üye çıkarılamadı'),
    });
  }

  function openPicker() {
    setMemberQuery('');
    setSelectedMembers([]);
    setPickError(null);
    setMemberOpen(true);
  }

  const personHref = (m: Person) =>
    canReadUsers ? `/users/${encodeURIComponent(m.id)}` : undefined;
  const chooses = memberWrite && paged.slice.some(removable);

  const listColumns: DataListColumn<Person>[] = [
    ...(chooses
      ? [
          selectionColumn<Person>({
            selection,
            pageIds: paged.slice.filter(removable).map((m) => m.id),
            idOf: (m) => m.id,
            nameOf: personName,
          }),
        ]
      : []),
    {
      id: 'name',
      width: 'minmax(0,1fr)',
      header: 'Ad',
      cell: (m) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={personName(m)} email={m.email} src={profilePictureSrc(m)} size="sm" />
          <DataListTitle
            title={personName(m)}
            subtitle={<span className={`${TEXT_SECONDARY} block truncate`}>{m.email}</span>}
          />
        </span>
      ),
    },
    ...(columns.isShown('role')
      ? [
          {
            id: 'role',
            width: '7.5rem',
            header: 'Rol',
            cell: (m: Person) => {
              const role = roleOf(m);
              return (
                <StatusChip
                  kind={role === 'member' ? 'neutral' : 'member'}
                  label={MEMBER_ROLE_LABELS[role]}
                />
              );
            },
          },
        ]
      : []),
    ...(hasSources && columns.isShown('from')
      ? [
          {
            id: 'from',
            width: '11rem',
            from: 'lg' as const,
            header: 'Nereden',
            cell: (m: Person) => (
              <span className={`text-secondary-foreground ${TEXT_SECONDARY} block truncate`}>
                {memberSourceLabel(group.path, m.sourceGroupPath) ?? 'Doğrudan'}
              </span>
            ),
          },
        ]
      : []),
    ...(hasTerms && columns.isShown('term')
      ? [
          {
            id: 'term',
            width: '9rem',
            from: 'md' as const,
            header: 'Görev sonu',
            cell: (m: Person) => {
              const term = termOf.get(m.id);
              if (!term) return <span className="text-subtle-foreground">—</span>;
              return term.status === 'active' ? (
                <span className={`text-secondary-foreground ${TEXT_SECONDARY}`}>
                  {endLabel(term.endsAt)}
                </span>
              ) : (
                <StatusChip kind={statusKind(term.status)} label={statusLabel(term.status)} />
              );
            },
          },
        ]
      : []),
    ...(hasAdded && columns.isShown('added')
      ? [
          {
            id: 'added',
            width: '7.5rem',
            from: 'md' as const,
            header: 'Eklendi',
            cell: (m: Person) => {
              const at = added.get(m.id);
              return at ? (
                <span className={`text-secondary-foreground ${TEXT_SECONDARY}`}>
                  {shortDay(at)}
                </span>
              ) : (
                <span className="text-subtle-foreground">—</span>
              );
            },
          },
        ]
      : []),
    {
      id: 'actions',
      width: '2.5rem',
      label: 'Eylemler',
      interactive: true,
      align: 'end',
      cell: (m: Person) =>
        personHref(m) || removable(m) ? (
          <RowMenu rowName={personName(m)}>
            {personHref(m) ? (
              <MenuLinkItem icon={UserRound} render={<Link href={personHref(m)!} />}>
                Kişi kartı
              </MenuLinkItem>
            ) : null}
            {removable(m) ? (
              <MenuItem icon={UserMinus} onClick={() => askRemove(m)}>
                Gruptan çıkar
              </MenuItem>
            ) : null}
          </RowMenu>
        ) : null,
    },
  ];

  const filtered = Boolean(params.q.trim()) || view !== 'all';
  const paging = {
    total: rows.length,
    page: paged.page,
    pageSize: params.size,
    onPage: (page: number) => setParams({ page }),
    onPageSize: (size: number) => setParams({ size }),
  };

  return (
    <div className="flex flex-col gap-3">
      {selection.count ? (
        <SelectionBar count={selection.count} onClear={selection.clear}>
          <Command icon={UserMinus} label="Gruptan çıkar" onClick={askRemoveChosen} />
        </SelectionBar>
      ) : memberWrite ? (
        <CommandBar label="Üye komutları">
          <Command primary icon={UserPlus} label="Üye ekle" onClick={openPicker} />
        </CommandBar>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <ListToolbar
            query={params.q}
            onQuery={(q) => setParams({ q })}
            commitDelay={250}
            placeholder="Ad veya e-posta"
            searchLabel="Üye ara"
            views={
              leaderRows > 0
                ? [
                    { value: 'all', label: 'Hepsi', count: sorted.length },
                    { value: 'leaders', label: 'Liderler', count: leaderRows },
                    { value: 'members', label: 'Üyeler', count: sorted.length - leaderRows },
                  ]
                : undefined
            }
            view={view}
            onView={(next) => setParams({ view: next })}
            columns={
              <ColumnPicker
                columns={COLUMNS.filter(
                  (column) =>
                    (column.id !== 'term' || hasTerms) &&
                    (column.id !== 'added' || hasAdded) &&
                    (column.id !== 'from' || hasSources),
                )}
                isShown={columns.isShown}
                onToggle={columns.toggle}
              />
            }
          />
        </div>
        <ListPager {...paging} placement="top" />
      </div>
      {rows.length === 0 ? (
        filtered ? (
          <EmptyState kind="no-results" onClear={() => setParams({ q: '', view: 'all' })} />
        ) : (
          <EmptyState kind="first-use" title="Henüz üye yok" />
        )
      ) : (
        <DataList
          columns={listColumns}
          rows={paged.slice}
          getRowId={(m) => m.id}
          rowHref={personHref}
          rowLabel={personName}
        />
      )}
      <ListPager {...paging} />
      {confirmDialog}
      <PickerDrawer
        open={memberOpen}
        onClose={() => {
          if (!memberSubmit.current) setMemberOpen(false);
        }}
        title="Üye ekle"
        query={memberQuery}
        onQuery={setMemberQuery}
        placeholder="Ad veya tam e-posta"
        loading={memberSearch.loading}
        failed={memberSearch.failed}
        options={memberOptions}
        emptyMessage={memberSearch.ready ? NO_CANDIDATE : MEMBER_CANDIDATE_HINT}
        error={pickError}
        selection={{
          items: selectedMembers,
          onChange: setSelectedMembers,
          onSubmit: addSelectedMembers,
          busy: addingMembers,
          submitLabel: 'Seçilenleri ekle',
        }}
      >
        {membersDialog}
      </PickerDrawer>
    </div>
  );
}
