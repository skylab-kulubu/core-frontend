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
};

export const capabilitiesApi = {
  get: () => coreFetch<Capabilities>('/v1/users/me/capabilities'),
};
