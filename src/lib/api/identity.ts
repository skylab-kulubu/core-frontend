import type { ProfilePicture } from '@/lib/profile-picture';
import { coreFetch } from './core';

export type Group = {
  id: string;
  name: string;
  path: string;
  attributes?: Record<string, string>;
};

export type Person = ProfilePicture & {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  schoolEmail?: string;
  skyNumber?: string;
  linkedin?: string;
  university?: string;
  faculty?: string;
  department?: string;
  phone?: string;
  studentCardUid?: string;
  sourceGroupId?: string;
  sourceGroupPath?: string;
};

export type UserProfilePatch = {
  firstName?: string;
  lastName?: string;
  linkedin?: string;
  university?: string;
  faculty?: string;
  department?: string;
  phone?: string;
};

export type ClientRole = {
  clientId: string;
  role: string;
};

/**
 * What adding a person to a Group would warn of (GET
 * /v1/groups/{id}/member-check/{userId}). `privileged` says whether the Group
 * is a Privileged root or under one; the panel never guesses it from a name.
 */
export type MemberCheck = {
  privileged: boolean;
  ytuLinked: boolean;
  /** 'not_ytu_verified': the Group is Privileged and the person is not YTÜ-linked. */
  warnings: string[];
};

/**
 * A person the reader may add to a Group (GET
 * /v1/groups/{id}/member-candidates?q=): core's active accounts whose name
 * holds `q` (at least three characters), at most ten. The
 * address is masked (a***@example.com) unless `q` was that whole address.
 */
export type MemberCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePictureUrl?: string;
  /** The person is directly in the Group already. */
  alreadyMember: boolean;
  ytuLinked: boolean;
  /** As MemberCheck's: 'not_ytu_verified' only for a Privileged Group. */
  warnings: string[];
};

/**
 * A Team the reader manages, with the Teams below it (GET
 * /v1/users/me/managed-groups; core's team delegation, docs/team-delegation.md
 * "Managed tree"). `can` holds core's decisions for it: `group.read`,
 * `members.write`, `leaders.write`, `subteams.write`, `code.write`,
 * `team.delete`, `team.move` and `team.settings`.
 */
export type ManagedGroup = {
  id: string;
  code: string;
  path: string;
  displayName?: { tr?: string; en?: string };
  memberCount?: number;
  leaderCount?: number;
  protected?: boolean;
  can?: Record<string, boolean>;
  children?: ManagedGroup[];
};

/** A Team's own settings, kept as its Group's attributes (core docs/team-delegation.md). */
export type TeamSettings = {
  /** Whether the Team's members add and edit its Events' competitors; off keeps it to Leaders. */
  membersManageCompetitors: boolean;
  /** Who manages its Events' Competitions: the Leaders (default) or all its members too. */
  competitionManagers: 'leaders' | 'members';
};

/** A Team's Leader group: Leaders (`LIDERLER`) or Coordinators (`KOORDINATORLER`). */
export type LeaderKind = 'LIDERLER' | 'KOORDINATORLER';

/** One Leader or Coordinator of a Team (GET /v1/groups/{id}/leaders). */
export type TeamLeader = Person & { kind: string; groupId: string };

/**
 * What moving a Team would do (GET /v1/groups/{id}/move-preview): whether
 * core's rules allow it (`refusal` names the one it breaks), the paths, the
 * people in the Team and below it, the client roles the Groups above give it
 * after and before, and the new parent's Leaders.
 */
export type MovePreview = {
  allowed: boolean;
  refusal?: string;
  oldPath: string;
  newPath: string;
  members: number;
  rolesGained: string[];
  rolesLost: string[];
  newParentLeaders: number;
};

export type UserCard = Person & {
  groups?: Group[];
  inheritedRoles?: ClientRole[];
  extraRoles?: ClientRole[];
};

export const identityApi = {
  listGroups: () => coreFetch<Group[]>('/v1/groups'),
  getGroup: (id: string) => coreFetch<Group>(`/v1/groups/${encodeURIComponent(id)}`),
  updateGroup: (id: string, body: { name?: string; attributes?: Record<string, string> }) =>
    coreFetch<Group>(`/v1/groups/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteGroup: (id: string) =>
    coreFetch<void>(`/v1/groups/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  members: (id: string) => coreFetch<Person[]>(`/v1/groups/${encodeURIComponent(id)}/members`),
  /** `unverifiedAck`: the reader confirmed the not_ytu_verified warning; core never refuses the add. */
  addMember: (
    groupId: string,
    userId: string,
    { unverifiedAck }: { unverifiedAck?: boolean } = {},
  ) =>
    coreFetch<void>(`/v1/groups/${encodeURIComponent(groupId)}/members`, {
      method: 'POST',
      body: JSON.stringify(unverifiedAck ? { userId, unverifiedAck } : { userId }),
    }),
  memberCheck: (groupId: string, userId: string) =>
    coreFetch<MemberCheck>(
      `/v1/groups/${encodeURIComponent(groupId)}/member-check/${encodeURIComponent(userId)}`,
    ),
  memberCandidates: (groupId: string, q: string) =>
    coreFetch<MemberCandidate[]>(
      `/v1/groups/${encodeURIComponent(groupId)}/member-candidates?q=${encodeURIComponent(q.trim())}`,
    ),
  removeMember: (groupId: string, userId: string) =>
    coreFetch<void>(`/v1/groups/${encodeURIComponent(groupId)}/members/${userId}`, {
      method: 'DELETE',
    }),
  managedGroups: () => coreFetch<ManagedGroup[]>('/v1/users/me/managed-groups'),
  /** A Team's own settings (PUT /v1/groups/{id}/settings): its manager or Privileged. */
  /** A field left out keeps its value (core: at least one is given). */
  setTeamSettings: (id: string, settings: Partial<TeamSettings>) =>
    coreFetch<TeamSettings>(`/v1/groups/${encodeURIComponent(id)}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
  /** Opens a Sub-team under the Team `parentId` (core docs/team-delegation.md "Team structure"). */
  createSubTeam: (
    parentId: string,
    body: { code: string; displayNameTr: string; displayNameEn?: string },
  ) =>
    coreFetch<Group>(`/v1/groups/${encodeURIComponent(parentId)}/children`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  changeTeamCode: (id: string, code: string) =>
    coreFetch<Group>(`/v1/groups/${encodeURIComponent(id)}/code`, {
      method: 'PUT',
      body: JSON.stringify({ code }),
    }),
  teamLeaders: (id: string) =>
    coreFetch<TeamLeader[]>(`/v1/groups/${encodeURIComponent(id)}/leaders`),
  /** core opens the Leader group when the Team has none. */
  addTeamLeader: (id: string, userId: string, kind: LeaderKind) =>
    coreFetch<void>(`/v1/groups/${encodeURIComponent(id)}/leaders`, {
      method: 'POST',
      body: JSON.stringify({ userId, kind }),
    }),
  /** `lastLeader`: the Team has no Leader or Coordinator left. */
  removeTeamLeader: (id: string, userId: string) =>
    coreFetch<{ lastLeader: boolean }>(
      `/v1/groups/${encodeURIComponent(id)}/leaders/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    ),
  movePreview: (id: string, parentId: string) =>
    coreFetch<MovePreview>(
      `/v1/groups/${encodeURIComponent(id)}/move-preview?parentId=${encodeURIComponent(parentId)}`,
    ),
  moveTeam: (id: string, parentId: string) =>
    coreFetch<Group>(`/v1/groups/${encodeURIComponent(id)}/move`, {
      method: 'POST',
      body: JSON.stringify({ parentId }),
    }),
  groupRoles: (id: string) =>
    coreFetch<ClientRole[]>(`/v1/groups/${encodeURIComponent(id)}/client-roles`),
  setGroupRoles: (id: string, roles: ClientRole[]) =>
    coreFetch<void>(`/v1/groups/${encodeURIComponent(id)}/client-roles`, {
      method: 'PUT',
      body: JSON.stringify(roles),
    }),
  createGroup: (body: { name: string; parentId?: string }) =>
    coreFetch<Group>('/v1/groups', { method: 'POST', body: JSON.stringify(body) }),
  listUsers: (q?: string) => {
    const query = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    return coreFetch<Person[]>(`/v1/users${query}`);
  },
  listClientRoles: () => coreFetch<ClientRole[]>('/v1/client-roles'),
  getUser: (id: string) => coreFetch<UserCard>(`/v1/users/${id}`),
  updateUser: (id: string, body: UserProfilePatch) =>
    coreFetch<UserCard>(`/v1/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  createUser: (body: { email: string; firstName: string; lastName: string }) =>
    coreFetch<Person>('/v1/users', { method: 'POST', body: JSON.stringify(body) }),
  deleteUser: (id: string) => coreFetch<void>(`/v1/users/${id}`, { method: 'DELETE' }),
  logoutUser: (id: string) => coreFetch<void>(`/v1/users/${id}/logout`, { method: 'POST' }),
  removeExtraRole: (id: string, role: ClientRole) =>
    coreFetch<void>(
      `/v1/users/${id}/client-roles?clientId=${encodeURIComponent(role.clientId)}&role=${encodeURIComponent(role.role)}`,
      { method: 'DELETE' },
    ),
};
