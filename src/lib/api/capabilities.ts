import { coreFetch } from './core';

/** A site whose CMS the person may edit: its Keycloak client, name and address (no trailing slash). */
export type EditableSite = {
  clientId: string;
  name: string;
  url: string;
};

/**
 * The part of core's "yeteneklerim" answer (GET /v1/users/me/capabilities)
 * the panel reads today. The admin BFF's useCapabilities (F7) takes this over.
 */
export type Capabilities = {
  editableSites?: EditableSite[];
  /**
   * core's decisions that name no Owner team (`user.write`, `user.readFull`,
   * `group.write`, …). A Privileged reader (DK) reads everything and gets
   * every write `false`.
   */
  can?: Record<string, boolean>;
  /** Decisions for a record of an Owner team the caller is in (`event.update`, `certificate.issue`, …). */
  teams?: Array<{ team: string; levels?: string[]; can?: Record<string, boolean> }>;
  /** Decisions for a record of an Owner team the caller is in no Group of. */
  otherTeams?: { can?: Record<string, boolean> };
  /** Decisions for a record without an Owner team. */
  noOwnerTeam?: { can?: Record<string, boolean> };
  /**
   * The Teams the person is a Leader of, read from Keycloak's current
   * membership; `[]` while core's team delegation is off. A hint for the
   * "Ekiplerim" menu: core decides every Group request.
   */
  managedTeams?: Array<{
    id: string;
    path: string;
    code: string;
    displayName?: { tr?: string; en?: string };
  }>;
};

export const capabilitiesApi = {
  get: () => coreFetch<Capabilities>('/v1/users/me/capabilities'),
};
