import type { SideNavSection } from '@skylab-kulubu/skylcn-ui';
import type { Person, TeamAuditRecord, TeamLeader } from '@/lib/api/identity';
import type { ManagementTerm } from '@/lib/api/management-memberships';
import { isLeaderGroupPath, isPrivileged, isTeamGroupPath } from '@/lib/auth/groups';
import { ROLES_ROOT } from '@/lib/role-placement';

/** A Group page's own pages, as its menu names them (Entra's group: Overview, Members, Owners…). */
export type GroupSection = 'overview' | 'members' | 'leaders' | 'roles' | 'settings' | 'audit';

export const GROUP_SECTION_LABELS: Record<GroupSection, string> = {
  overview: 'Genel bakış',
  members: 'Üyeler',
  leaders: 'Liderler ve alt ekipler',
  roles: 'Uygulama rolleri',
  settings: 'Ayarlar',
  audit: 'Denetim kaydı',
};

const SEGMENTS: Record<Exclude<GroupSection, 'overview'>, string> = {
  members: 'members',
  leaders: 'leaders',
  roles: 'roles',
  settings: 'settings',
  audit: 'audit',
};

/** The address of one of a Group's pages, under Gruplar or Ekiplerim. */
export function groupSectionHref(base: string, id: string, section: GroupSection): string {
  const root = `${base}/${encodeURIComponent(id)}`;
  return section === 'overview' ? root : `${root}/${SEGMENTS[section]}`;
}

/** The page an address opens: the segment after the Group's id; the overview without one. */
export function groupSectionOf(pathname: string | null | undefined): GroupSection {
  const parts = (pathname ?? '').split('/').filter(Boolean);
  const segment = parts[2];
  const found = (Object.entries(SEGMENTS) as [GroupSection, string][]).find(
    ([, value]) => value === segment,
  );
  return found ? found[0] : 'overview';
}

/** What a Group is, read from its path the way core reads it. */
export type GroupKind = 'management' | 'team' | 'subteam' | 'leaders' | 'roles' | 'area';

export const GROUP_KIND_LABELS: Record<GroupKind, string> = {
  management: 'Yönetim',
  team: 'Ekip',
  subteam: 'Alt ekip',
  leaders: 'Lider grubu',
  roles: 'Rol grubu',
  area: 'Grup',
};

export function groupKind(path: string): GroupKind {
  if (isLeaderGroupPath(path)) return 'leaders';
  if (isPrivileged([path])) return 'management';
  if (path === ROLES_ROOT || path.startsWith(`${ROLES_ROOT}/`)) return 'roles';
  if (isTeamGroupPath(path)) return path.split('/').filter(Boolean).length > 3 ? 'subteam' : 'team';
  return 'area';
}

/** The name a Group is shown by: its Turkish display name, else its code. */
export function groupTitle(group: { name: string; attributes?: Record<string, string> }): string {
  return (
    group.attributes?.display_name_tr?.trim() || group.attributes?.displayName?.trim() || group.name
  );
}

/** What the reader may open beside the overview, and the counts written beside each page. */
export type GroupPages = {
  leaders: boolean;
  roles: boolean;
  audit: boolean;
  counts: Partial<Record<GroupSection, number>>;
};

/** The Group's menu: its overview, then its people, then how it is set up. */
export function groupMenuSections(base: string, id: string, pages: GroupPages): SideNavSection[] {
  const item = (section: GroupSection) => ({
    href: groupSectionHref(base, id, section),
    label: GROUP_SECTION_LABELS[section],
    badge: pages.counts[section],
  });
  return [
    { items: [item('overview')] },
    { label: 'Kişiler', items: [item('members'), ...(pages.leaders ? [item('leaders')] : [])] },
    {
      label: 'Yönetim',
      items: [
        ...(pages.roles ? [item('roles')] : []),
        item('settings'),
        ...(pages.audit ? [item('audit')] : []),
      ],
    },
  ];
}

/** A member's place in the Group: a Leader, a Coordinator or a member. */
export type MemberRole = 'leader' | 'coordinator' | 'member';

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  leader: 'Lider',
  coordinator: 'Koordinatör',
  member: 'Üye',
};

/**
 * A member's role: what core's Leader list says (LIDERLER before KOORDINATORLER),
 * else the Leader group they sit in, else a member.
 */
export function memberRole(
  member: Pick<Person, 'id' | 'sourceGroupPath'>,
  leaders: readonly Pick<TeamLeader, 'id' | 'kind'>[],
): MemberRole {
  const kinds = leaders.filter((leader) => leader.id === member.id).map((leader) => leader.kind);
  if (kinds.includes('LIDERLER')) return 'leader';
  if (kinds.includes('KOORDINATORLER')) return 'coordinator';
  const source = member.sourceGroupPath ?? '';
  if (source.endsWith('/LIDERLER')) return 'leader';
  if (source.endsWith('/KOORDINATORLER')) return 'coordinator';
  return 'member';
}

/** Leaders first, then Coordinators, then members; each by name. */
export function sortMembers<T extends Pick<Person, 'firstName' | 'lastName' | 'email'>>(
  rows: readonly T[],
  roleOf: (row: T) => MemberRole,
): T[] {
  const rank: Record<MemberRole, number> = { leader: 0, coordinator: 1, member: 2 };
  return [...rows].sort(
    (a, b) =>
      rank[roleOf(a)] - rank[roleOf(b)] ||
      personName(a).localeCompare(personName(b), 'tr', { sensitivity: 'base' }),
  );
}

export function personName(person: Pick<Person, 'firstName' | 'lastName' | 'email'>): string {
  return `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || person.email || 'Adsız';
}

/**
 * When each person was added, from the audit record: the newest successful
 * `member.add` or `leader.add` naming them (rows come newest first). People
 * added before the record began have none.
 */
export function addedDates(records: readonly TeamAuditRecord[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of records) {
    if (row.outcome !== 'ok') continue;
    if (row.action !== 'member.add' && row.action !== 'leader.add') continue;
    const id = row.target?.id;
    if (id && !out.has(id)) out.set(id, row.occurredAt);
  }
  return out;
}

/**
 * The open management terms of this Group's people (core's management
 * memberships): the terms of the Group itself and of the Groups under it the
 * members sit in, by person.
 */
export function termsByPerson(
  terms: readonly ManagementTerm[],
  groupId: string,
  members: readonly Pick<Person, 'id' | 'sourceGroupId'>[],
): Map<string, ManagementTerm> {
  const groups = new Set([groupId, ...members.map((m) => m.sourceGroupId).filter(Boolean)]);
  const out = new Map<string, ManagementTerm>();
  for (const term of terms) {
    if (!groups.has(term.groupId)) continue;
    const held = out.get(term.userId);
    // The term that ends first is the one to act on
    if (!held || (term.endsAt ?? '9999') < (held.endsAt ?? '9999')) out.set(term.userId, term);
  }
  return out;
}

/** The audit actions in the panel's words. */
const AUDIT_ACTIONS: Record<string, string> = {
  'member.add': 'Üye eklendi',
  'member.remove': 'Üye çıkarıldı',
  'leader.add': 'Lider atandı',
  'leader.remove': 'Liderlikten çıkarıldı',
  'team.create': 'Grup açıldı',
  'team.delete': 'Grup silindi',
  'team.code': 'Kod değişti',
  'team.move': 'Taşındı',
  'group.attributes': 'Ayarlar değişti',
  'group.roles': 'Roller değişti',
  'app.assign': 'Uygulama rolü verildi',
  'app.unassign': 'Uygulama rolü alındı',
  'membership.term.extend': 'Görev uzatıldı',
  'membership.term.handover': 'Görev devredildi',
  'membership.term.expired': 'Görev süresi doldu',
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTIONS[action] ?? action;
}

const AUDIT_OUTCOMES: Record<TeamAuditRecord['outcome'], string> = {
  ok: 'Tamam',
  pending: 'Sürüyor',
  failed: 'Olmadı',
  denied: 'Reddedildi',
};

export function auditOutcomeLabel(outcome: TeamAuditRecord['outcome']): string {
  return AUDIT_OUTCOMES[outcome] ?? outcome;
}

/** A Group as a row of the Groups tree: how deep it sits and whether Groups sit under it. */
export type GroupTreeRow<T extends { path: string }> = {
  group: T;
  depth: number;
  hasChildren: boolean;
};

/**
 * The Groups as a tree, each followed by the ones under it (path order), leaving
 * out the ones under a folded Group. A Group whose parent is not in the list
 * starts at the top.
 */
export function groupTreeRows<T extends { path: string }>(
  groups: readonly T[],
  folded: ReadonlySet<string> = new Set(),
): GroupTreeRow<T>[] {
  const sorted = [...groups].sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const paths = new Set(sorted.map((g) => g.path));
  const depthOf = new Map<string, number>();
  const out: GroupTreeRow<T>[] = [];
  for (const group of sorted) {
    const parent = group.path.slice(0, group.path.lastIndexOf('/'));
    const depth = parent && paths.has(parent) ? (depthOf.get(parent) ?? 0) + 1 : 0;
    depthOf.set(group.path, depth);
    const hidden = [...folded].some((path) => group.path.startsWith(`${path}/`));
    if (hidden) continue;
    out.push({
      group,
      depth,
      hasChildren: sorted.some((other) => other.path.startsWith(`${group.path}/`)),
    });
  }
  return out;
}
