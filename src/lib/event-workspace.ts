/**
 * The Event workspace's tabs. Each is a route under /events/[id]; the overview
 * is the event's own path, so every link to /events/[id] still lands on it.
 */
export type EventTab =
  | 'overview'
  | 'participants'
  | 'program'
  | 'certificates'
  | 'content'
  | 'competition';

const TAB_SEGMENTS: Readonly<Record<Exclude<EventTab, 'overview'>, string>> = {
  participants: 'participants',
  program: 'program',
  certificates: 'certificates',
  content: 'content',
  competition: 'competition',
};

// The event page used to be one long page with in-page anchors (#program, …)
const LEGACY_ANCHORS: Readonly<Record<string, EventTab>> = {
  overview: 'overview',
  participants: 'participants',
  program: 'program',
  files: 'content',
  competitors: 'competition',
  certificates: 'certificates',
};

/** The door of an event: one address, a page of its own outside the tabs. */
export function eventDoorHref(eventId: string): string {
  return `/events/${encodeURIComponent(eventId)}/door`;
}

/** The editor of an event's own certificate template: a focus page, like the door. */
export function eventCertificateTemplateHref(eventId: string): string {
  return `/events/${encodeURIComponent(eventId)}/certificate-template`;
}

/**
 * Pages drawn without the sidebar: one task done start to finish (an event's
 * door), or one that wants the whole width (its certificate template's editor).
 */
export function isFocusPath(pathname: string): boolean {
  return /^\/events\/[^/]+\/(?:door|certificate-template)\/?$/.test(pathname);
}

export function eventTabHref(eventId: string, tab: EventTab = 'overview'): string {
  const base = `/events/${encodeURIComponent(eventId)}`;
  return tab === 'overview' ? base : `${base}/${TAB_SEGMENTS[tab]}`;
}

/** The event's create-and-edit page, outside the tabs. */
export function eventEditHref(eventId: string): string {
  return `/events/${encodeURIComponent(eventId)}/edit`;
}

/** A section of the edit page (#basvuru, #kapi-gorevlileri…): where a tab's settings live. */
export function eventEditSectionHref(eventId: string, section: string): string {
  return `${eventEditHref(eventId)}#${section}`;
}

/** The door staff list on the edit page (inside Bilet ve kapı). */
export const DOOR_STAFF_ANCHOR = 'kapi-gorevlileri';

/** Where an event's door staff are chosen: Program, Kapı and the overview link here. */
export function eventDoorStaffHref(eventId: string): string {
  return eventEditSectionHref(eventId, DOOR_STAFF_ANCHOR);
}

export function isEventEditPath(pathname: string): boolean {
  return /^\/events\/[^/]+\/edit\/?$/.test(pathname);
}

/** The tab a path under /events/[id] shows; null for pages outside the tabs (a ticket, a redirect). */
export function eventTabFromPath(pathname: string): EventTab | null {
  const match = pathname.match(/^\/events\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!match || match[1] === 'new') return null;
  const segment = match[2];
  if (!segment) return 'overview';
  const tab = (Object.keys(TAB_SEGMENTS) as Array<keyof typeof TAB_SEGMENTS>).find(
    (key) => TAB_SEGMENTS[key] === segment,
  );
  return tab ?? null;
}

export function eventTabFromAnchor(hash: string): EventTab | null {
  const anchor = hash.replace(/^#/, '');
  return Object.hasOwn(LEGACY_ANCHORS, anchor) ? LEGACY_ANCHORS[anchor] : null;
}

/** Where an old /events/[id]#anchor link now lives; null when it stays on the overview. */
export function legacyEventAnchorHref(eventId: string, hash: string): string | null {
  const tab = eventTabFromAnchor(hash);
  return tab && tab !== 'overview' ? eventTabHref(eventId, tab) : null;
}

/**
 * Yarışma shows to whoever manages the event's competitors, and to every reader
 * once it has some (the list was open to all on the one-page event view).
 */
export function showsCompetitionTab(
  canManageCompetitors: boolean,
  competitorCount: number,
): boolean {
  return canManageCompetitors || competitorCount > 0;
}
