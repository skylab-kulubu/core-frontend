import { coreFetch } from './core';

/** A person's addresses (ADR-0044): the primary, which of the two it is, the school and the personal one. */
export type AccountEmail = {
  primary?: string;
  primaryVerified: boolean;
  primaryKind: 'school' | 'personal' | 'none';
  school?: string;
  personal?: string;
  personalVerified: boolean;
};

export type AccountCredential = { id: string; type: string; label?: string; createdAt?: string };
export type LinkedIdentity = { provider: string; userName?: string; ytu: boolean };
export type AccountSession = { start: string; lastAccess: string; clients: string[] };
export type LoginEvent = { type: string; time: string; client?: string; error?: string };

/**
 * A person's Keycloak account (GET /v1/users/{id}/account, core docs/user-accounts.md).
 * `can.manage` says whether the reader may change it here; `can.reason` why not
 * (`own_account`, `privileged_target`, `service_account`, `account_not_active`, `forbidden`).
 * `logins` is null when core cannot read the sign-in events.
 */
export type UserAccount = {
  id: string;
  status: 'active' | 'deletion_pending' | 'deleted';
  username?: string;
  enabled: boolean;
  createdAt?: string;
  email?: AccountEmail;
  ytuVerified: boolean;
  requiredActions: string[];
  credentials: AccountCredential[];
  identityProviders: LinkedIdentity[];
  sessions: AccountSession[];
  lockout: { locked: boolean; failures: number; lastFailure?: string };
  logins: { last?: string; events: LoginEvent[] } | null;
  can: { manage: boolean; reason?: string };
};

/** A temporary password core set: the one it made up comes back once. */
export type PasswordResult = {
  generated: boolean;
  password?: string;
  temporary: boolean;
  sessionsClosed: boolean;
};

/** The required actions the panel sets; others the account carries stay. */
export const REQUIRED_ACTIONS = [
  'UPDATE_PASSWORD',
  'CONFIGURE_TOTP',
  'webauthn-register-passwordless',
  'VERIFY_EMAIL',
] as const;

const path = (id: string, rest = '') => `/v1/users/${encodeURIComponent(id)}${rest}`;

export const userAccountApi = {
  get: (id: string) => coreFetch<UserAccount>(path(id, '/account')),
  setEnabled: (id: string, enabled: boolean) =>
    coreFetch<void>(path(id, '/enabled'), { method: 'PUT', body: JSON.stringify({ enabled }) }),
  /** No password: core makes one up and answers it once. */
  setPassword: (id: string, password?: string) =>
    coreFetch<PasswordResult>(path(id, '/password'), {
      method: 'POST',
      body: JSON.stringify(password ? { password } : {}),
    }),
  sendPasswordMail: (id: string) =>
    coreFetch<void>(path(id, '/password-reset-mail'), { method: 'POST' }),
  changeEmail: (id: string, body: { address: string; verified: boolean; primary: boolean }) =>
    coreFetch<void>(path(id, '/email'), { method: 'PUT', body: JSON.stringify(body) }),
  verifyEmail: (id: string) => coreFetch<void>(path(id, '/email/verify'), { method: 'POST' }),
  sendVerificationMail: (id: string) =>
    coreFetch<void>(path(id, '/email/verification-mail'), { method: 'POST' }),
  setPrimary: (id: string, kind: 'school' | 'personal') =>
    coreFetch<void>(path(id, '/email/primary'), { method: 'PUT', body: JSON.stringify({ kind }) }),
  setRequiredActions: (id: string, actions: string[]) =>
    coreFetch<void>(path(id, '/required-actions'), {
      method: 'PUT',
      body: JSON.stringify({ actions }),
    }),
  deleteCredential: (id: string, credentialId: string) =>
    coreFetch<void>(path(id, `/credentials/${encodeURIComponent(credentialId)}`), {
      method: 'DELETE',
    }),
  unlinkIdentity: (id: string, provider: string) =>
    coreFetch<void>(path(id, `/identity-providers/${encodeURIComponent(provider)}`), {
      method: 'DELETE',
    }),
  clearLockout: (id: string) => coreFetch<void>(path(id, '/lockout'), { method: 'DELETE' }),
};
