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
  removeMember: (groupId: string, userId: string) =>
    coreFetch<void>(`/v1/groups/${encodeURIComponent(groupId)}/members/${userId}`, {
      method: 'DELETE',
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
