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

export function eventTabHref(eventId: string, tab: EventTab = 'overview'): string {
  const base = `/events/${encodeURIComponent(eventId)}`;
  return tab === 'overview' ? base : `${base}/${TAB_SEGMENTS[tab]}`;
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
