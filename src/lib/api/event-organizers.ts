import { coreFetch } from './core';

/** Who of a Co-organizer team manages the Event: its Leaders alone, or every member. */
export type OrganizerManagement = 'leaders' | 'members';
/** Named outside the panel (site, Ticket, certificate check), or seen in the panel alone. */
export type OrganizerVisibility = 'co_organizer' | 'helper';

export type EventOrganizerTeam = {
  code: string;
  /** The team as shown outside the panel: "WEBLAB · Web Geliştirme". */
  name: string;
  management: OrganizerManagement;
  visibility: OrganizerVisibility;
};

export type EventOrganizerPerson = {
  id: string;
  name: string;
  /** Only to who may change the list. */
  email?: string;
  /** Their rights end 30 days after the Event; left out for an Event with no date. */
  expiresAt?: string;
};

/**
 * GET /v1/events/{id}/organizers (core docs/co-organizers.md): for who may
 * edit the Event. `canManage` is whether the caller may change the list
 * (the Owner team's Leaders and Privileged, while core's switch is on).
 */
export type EventOrganizers = {
  ownerTeam: string;
  /** What a new team row's `management` defaults to: the Owner team's own rule. */
  ownerRule: OrganizerManagement;
  teams: EventOrganizerTeam[];
  people: EventOrganizerPerson[];
  canManage: boolean;
};

/** PUT: the whole lists; a team's choices left out take core's defaults. */
export type EventOrganizersBody = {
  teams: { code: string; management?: OrganizerManagement; visibility?: OrganizerVisibility }[];
  people: string[];
};

const organizersPath = (eventId: string) => `/v1/events/${encodeURIComponent(eventId)}/organizers`;

export const eventOrganizersApi = {
  get: (eventId: string) => coreFetch<EventOrganizers>(organizersPath(eventId)),
  /**
   * 403 `co_organizers_disabled` while core's switch is off; 400
   * `event_organizers_invalid` names the row; 409 when the Owner team changed
   * meanwhile; 503 `audit_unavailable` when its record could not be opened.
   */
  put: (eventId: string, body: EventOrganizersBody) =>
    coreFetch<EventOrganizers>(organizersPath(eventId), {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};
