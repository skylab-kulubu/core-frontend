'use client';

import { Notice } from '@skylab-kulubu/skylcn-ui';
import { Hourglass, RefreshCw, Settings, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { ObjectPage, ObjectPageHeader } from '@/components/chrome/object-page/ObjectPage';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { EmptyState } from '@/components/chrome/PageState';
import { StatusChip } from '@/components/chrome/StatusChip';
import { useChromeCrumbName } from '@/components/layout/chrome-crumb-names';
import { useAuth } from '@/context/AuthContext';
import { ProblemError } from '@/lib/api/core';
import {
  identityApi,
  type ClientRole,
  type Group,
  type ManagedGroup,
  type Person,
  type TeamLeader,
} from '@/lib/api/identity';
import { managementMembershipsApi, type ManagementTerm } from '@/lib/api/management-memberships';
import { isPrivileged, isTeamGroupPath } from '@/lib/auth/groups';
import { useCapabilities } from '@/lib/capabilities-context';
import { coreProblemMessage } from '@/lib/core-problems';
import {
  GROUP_KIND_LABELS,
  GROUP_SECTION_LABELS,
  groupKind,
  groupMenuSections,
  groupSectionHref,
  groupSectionOf,
  groupTitle,
  type GroupSection,
} from '@/lib/group-page';
import { findManagedGroup, useManagedGroups, type ManagedGroupsState } from '@/lib/managed-groups';
import { showsManagementTerms } from '@/lib/management-terms';
import { useAppCan } from '@/lib/use-app-can';

export type GroupWorkspaceValue = {
  id: string;
  /** Gruplar or Ekiplerim: the trail and the menu stay where the reader came from. */
  base: string;
  group: Group;
  members: Person[];
  /** The Team's Leaders and Coordinators, when core lets the reader read them; else none. */
  leaders: TeamLeader[];
  roles: ClientRole[];
  /** A Team's Leader reads no role mappings (core: Privileged's). */
  rolesReadable: boolean;
  /** The open management terms of the Group's people (core's management memberships). */
  terms: ManagementTerm[];
  managedGroups: ManagedGroupsState & { reload: () => void };
  /** This Group in core's managed tree: core's decisions on it (`can`), its Sub-teams. */
  managed: ManagedGroup | undefined;
  isTeam: boolean;
  /** core's group.write: Privileged writers (ADMIN, YK). */
  canWrite: boolean;
  /** Adds and removes members: group.write, or a Leader core lets (members.write). */
  memberWrite: boolean;
  /** Opens a person's card (core's user.read). */
  canReadUsers: boolean;
  /** Reads the Team audit record (core's audit.read). */
  canReadAudit: boolean;
  /** Reads everything again; the page stays on screen meanwhile. */
  reload: () => Promise<void>;
};

const GroupWorkspaceContext = createContext<GroupWorkspaceValue | null>(null);

export function useGroupWorkspace(): GroupWorkspaceValue {
  const value = useContext(GroupWorkspaceContext);
  if (!value) throw new Error('useGroupWorkspace outside GroupWorkspace');
  return value;
}

/**
 * One Group as an object page (Entra's group: Overview, Members, Owners, Properties,
 * Audit logs): its band and commands, its own menu on the left, the open page beside it.
 * It reads the Group once for all its pages; a page's change reads it again.
 */
export function GroupWorkspace({ children }: { children: ReactNode }) {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const pathname = usePathname();
  // Ekiplerim opens this page under /my-teams (ticket 08): its trail stays there
  const base = pathname?.startsWith('/my-teams/') ? '/my-teams' : '/groups';
  const section = groupSectionOf(pathname);
  const { user } = useAuth();
  const capabilities = useCapabilities();
  // core's group.write decides every change here (a DK member reads only); the
  // group rule stands in only when the capabilities cannot be read
  const can = useAppCan(isPrivileged(user?.groups ?? []));
  const canWrite = can('group.write');
  const canReadUsers = can('user.read');
  const canReadAudit = useAppCan(false)('audit.read');
  const termsVisible = showsManagementTerms(capabilities);

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Person[]>([]);
  const [leaders, setLeaders] = useState<TeamLeader[]>([]);
  const [roles, setRoles] = useState<ClientRole[]>([]);
  const [rolesReadable, setRolesReadable] = useState(true);
  const [terms, setTerms] = useState<ManagementTerm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isTeam = !!group && isTeamGroupPath(group.path);
  // A Leader adds and removes members of a Team they manage: core's managed
  // tree says which (members.write). A Privileged reader reads it on a Team
  // too: core's decisions on its Leaders and Sub-teams (ticket 11)
  const managedGroups = useManagedGroups({
    privileged: isTeam && (canWrite || can('group.read')),
  });
  const managed =
    managedGroups.status === 'ready' ? findManagedGroup(managedGroups.groups, id) : undefined;
  const memberWrite = canWrite || managed?.can?.['members.write'] === true;

  const load = useCallback(async () => {
    try {
      const [g, mem, mapped] = await Promise.all([
        identityApi.getGroup(id),
        identityApi.members(id),
        identityApi.groupRoles(id).catch((err: unknown) => {
          if (err instanceof ProblemError && err.status === 403) return null;
          throw err;
        }),
      ]);
      setGroup(g);
      setMembers(mem);
      setRoles(mapped ?? []);
      setRolesReadable(mapped !== null);
      setError(null);
    } catch (err) {
      setError(coreProblemMessage(err, 'Grup yüklenemedi'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // A Team's Leaders give the members their role; core answers them to whoever manages it
  const leadersReadable = isTeam && Boolean(managed);
  const readLeaders = useCallback(async () => {
    if (!leadersReadable) {
      setLeaders([]);
      return;
    }
    // Without them every row reads as a member, as before the Leaders existed
    setLeaders(await identityApi.teamLeaders(id).catch(() => []));
  }, [id, leadersReadable]);

  useEffect(() => {
    void readLeaders();
  }, [readLeaders]);

  // Terms are an extra column: off (core 404), unread or refused, the column stays away
  useEffect(() => {
    if (!termsVisible) return;
    let live = true;
    managementMembershipsApi
      .list()
      .then((rows) => live && setTerms(rows ?? []))
      .catch(() => live && setTerms([]));
    return () => {
      live = false;
    };
  }, [termsVisible, id]);

  const reload = useCallback(async () => {
    await Promise.all([load(), readLeaders()]);
  }, [load, readLeaders]);

  const title = group ? groupTitle(group) : id;
  useChromeCrumbName(`${base}/${id}`, group ? title : null);

  const value = useMemo<GroupWorkspaceValue | null>(
    () =>
      group
        ? {
            id,
            base,
            group,
            members,
            leaders,
            roles,
            rolesReadable,
            terms,
            managedGroups,
            managed,
            isTeam,
            canWrite,
            memberWrite,
            canReadUsers,
            canReadAudit,
            reload,
          }
        : null,
    [
      id,
      base,
      group,
      members,
      leaders,
      roles,
      rolesReadable,
      terms,
      managedGroups,
      managed,
      isTeam,
      canWrite,
      memberWrite,
      canReadUsers,
      canReadAudit,
      reload,
    ],
  );

  if (!group) {
    if (loading) return <PageSkeleton variant="workspace" />;
    return (
      <EmptyState
        kind="failed"
        title={error ?? 'Grup yüklenemedi'}
        onRetry={() => {
          setLoading(true);
          void load();
        }}
      />
    );
  }

  const kind = groupKind(group.path);
  const leaderCount = managed?.leaderCount ?? leaders.length;
  const pages = {
    leaders: isTeam && Boolean(managed),
    roles: rolesReadable,
    audit: canReadAudit,
    counts: {
      members: members.length,
      ...(managed ? { leaders: leaderCount + (managed.children?.length ?? 0) } : {}),
      ...(rolesReadable ? { roles: roles.length } : {}),
    },
  };
  // A Team without a Leader is run only from above: say it where it is fixed
  const leaderless = isTeam && Boolean(managed) && leaderCount === 0;
  const teamTerms = terms.some(
    (term) => term.groupId === group.id || members.some((m) => m.sourceGroupId === term.groupId),
  );

  return (
    <GroupWorkspaceContext.Provider value={value}>
      <ObjectPage
        header={
          <ObjectPageHeader
            eyebrow={GROUP_KIND_LABELS[kind]}
            title={title}
            section={section !== 'overview' ? GROUP_SECTION_LABELS[section] : undefined}
            badges={
              <>
                <StatusChip kind="neutral" label={`${members.length} üye`} />
                {isTeam && managed ? (
                  <StatusChip kind="neutral" label={`${leaderCount} lider`} />
                ) : null}
              </>
            }
            meta={<span className="break-all">{group.path}</span>}
          />
        }
        commands={
          <CommandBar label="Grup komutları">
            {memberWrite && section !== 'members' ? (
              <Command
                primary
                icon={UserPlus}
                label="Üye ekle"
                href={`${groupSectionHref(base, id, 'members')}?ekle=1`}
              />
            ) : null}
            {termsVisible && teamTerms ? (
              <Command
                icon={Hourglass}
                label="Dönem devri"
                href={`/management-memberships?q=${encodeURIComponent(group.name)}`}
              />
            ) : null}
            {section !== 'settings' ? (
              <Command
                icon={Settings}
                label="Ayarlar"
                href={groupSectionHref(base, id, 'settings')}
              />
            ) : null}
            <Command icon={RefreshCw} label="Yenile" onClick={() => void reload()} />
          </CommandBar>
        }
        notices={
          <>
            {error ? (
              <EmptyState kind="failed" title={error} onRetry={() => void reload()} />
            ) : null}
            {leaderless && section !== 'leaders' ? (
              <Notice
                tone="warning"
                title="Ekibin lideri yok"
                action={
                  <Link
                    href={groupSectionHref(base, id, 'leaders')}
                    className="text-skylab-300 hover:underline"
                  >
                    Liderler
                  </Link>
                }
              />
            ) : null}
          </>
        }
        menu={{
          label: 'Grup',
          sections: groupMenuSections(base, id, pages),
          activeHref: groupSectionHref(base, id, section),
        }}
      >
        {children}
      </ObjectPage>
    </GroupWorkspaceContext.Provider>
  );
}
