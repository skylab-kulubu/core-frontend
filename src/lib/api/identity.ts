import { coreFetch } from './core';

export type Group = {
  id: string;
  name: string;
  path: string;
  attributes?: Record<string, string>;
};

export type Person = {
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

export type UserCard = Person & {
  groups: Group[];
  inheritedRoles: ClientRole[];
  extraRoles: ClientRole[];
};

export const identityApi = {
  listGroups: () => coreFetch<Group[]>('/v1/groups'),
  getGroup: (id: string) => coreFetch<Group>(`/v1/groups/${encodeURIComponent(id)}`),
  updateGroup: (id: string, body: { name?: string; attributes?: Record<string, string> }) =>
    coreFetch<Group>(`/v1/groups/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  members: (id: string) => coreFetch<Person[]>(`/v1/groups/${encodeURIComponent(id)}/members`),
  addMember: (groupId: string, userId: string) =>
    coreFetch<void>(`/v1/groups/${encodeURIComponent(groupId)}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
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
  addExtraRole: (id: string, role: ClientRole) =>
    coreFetch<void>(`/v1/users/${id}/client-roles`, {
      method: 'POST',
      body: JSON.stringify(role),
    }),
  removeExtraRole: (id: string, role: ClientRole) =>
    coreFetch<void>(
      `/v1/users/${id}/client-roles?clientId=${encodeURIComponent(role.clientId)}&role=${encodeURIComponent(role.role)}`,
      { method: 'DELETE' },
    ),
};
