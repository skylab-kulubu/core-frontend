import { coreFetch } from './core';

/**
 * core's app assignments (docs/app-assignments.md; Microsoft Entra's
 * Enterprise apps → "Users and groups"). The routes exist only with core's
 * APP_ASSIGNMENTS on; capabilities `apps.read` and `apps.assign` say whether
 * the reader may read and change them.
 */
export type AppSummary = {
  clientId: string;
  name: string;
  /** Entra's "Assignment required?": shown only; the app enforces it, code changes it. */
  assignmentRequired: boolean;
  /** The app roles the panel assigns. */
  roles: string[];
  /** The roles the add drawer selects first (SkyMail's "send for approval" pair). */
  suggestedRoles: string[];
  /** How many Groups and people one of the roles is mapped to directly. */
  groups: number;
  users: number;
};

export type AppActor = { id: string; name: string };

export type AppTargetType = 'group' | 'user';

export type AppAssignment = {
  type: AppTargetType;
  id: string;
  role: string;
  /** `code`: a Privileged root, /ROLLER or a service account; the panel cannot change it. */
  area: 'panel' | 'code';
  reason?: string;
  path?: string;
  name: string;
  email?: string;
  /** How many Groups below this one inherit the role (Keycloak hands it down). */
  inheritsTo: number;
  /** Enabled people the assignment reaches (a person: 1). */
  members: number;
  /** null: no audit row (made before the panel or in Keycloak's console), or the reader lacks audit:read. */
  assignedBy: AppActor | null;
  assignedAt: string | null;
};

export type AppAssignments = {
  app: AppSummary;
  /** Whether assignedBy/assignedAt say anything (the reader holds audit:read). */
  auditVisible: boolean;
  assignments: AppAssignment[];
};

export type AppAuditEntry = {
  id: string;
  occurredAt: string;
  action: 'app.assign' | 'app.unassign';
  outcome: 'pending' | 'ok' | 'failed' | 'denied';
  errorCode?: string;
  actor: AppActor;
  type: AppTargetType;
  targetId: string;
  path?: string;
  name?: string;
  role: string;
  note?: string;
};

export type AppTarget = {
  type: AppTargetType;
  id: string;
  path?: string;
  name: string;
  /** Masked (a***@example.com) unless the query was the whole address. */
  email?: string;
  inheritsTo: number;
  members: number;
  /** The app's roles the target holds directly already. */
  assignedRoles: string[];
};

export type AppAssignmentInput = {
  type: AppTargetType;
  id: string;
  role: string;
  note?: string;
};

function app(clientId: string): string {
  return `/v1/apps/${encodeURIComponent(clientId)}`;
}

export const appsApi = {
  list: () => coreFetch<AppSummary[]>('/v1/apps'),
  assignments: (clientId: string) => coreFetch<AppAssignments>(`${app(clientId)}/assignments`),
  assign: (clientId: string, input: AppAssignmentInput) =>
    coreFetch<AppAssignment>(`${app(clientId)}/assignments`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  unassign: (clientId: string, input: AppAssignmentInput) =>
    coreFetch<void>(`${app(clientId)}/assignments`, {
      method: 'DELETE',
      body: JSON.stringify(input),
    }),
  audit: (clientId: string) => coreFetch<AppAuditEntry[]>(`${app(clientId)}/audit`),
  targets: (clientId: string, type: AppTargetType, q: string) =>
    coreFetch<AppTarget[]>(
      `${app(clientId)}/targets?type=${type}&q=${encodeURIComponent(q.trim())}`,
    ),
};
