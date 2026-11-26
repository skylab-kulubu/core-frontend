/**
 * The Event workspace's pages. Each is a route under /events/[id]; the overview
 * is the event's own path, so every link to /events/[id] still lands on it.
 * A tab keeps its own settings beside its work (Katılımcılar › Kayıt ayarları,
 * Kapı, Postalar); only the event's own name, time, team and look sit in the
 * "Etkinlik ayarları" group at the bottom of the menu.
 */
export type EventTab =
  | 'overview'
  | 'participants'
  | 'program'
  | 'checkin'
  | 'competition'
  | 'emails'
  | 'certificates'
  | 'content';

const TAB_SEGMENTS: Readonly<Record<Exclude<EventTab, 'overview'>, string>> = {
  participants: 'participants',
  program: 'program',
  checkin: 'checkin',
  competition: 'competition',
  emails: 'emails',
  certificates: 'certificates',
  content: 'content',
};

/** The pages of the "Etkinlik ayarları" group, in menu order, with their names. */
export const EVENT_SETTINGS_PAGES = [
  { key: 'general', label: 'Genel' },
  { key: 'schedule', label: 'Zaman ve yer' },
  { key: 'team', label: 'Ekip' },
  { key: 'appearance', label: 'Görünüm' },
  { key: 'visibility', label: 'Görünürlük ve yayın' },
] as const;

export type EventSettingsPage = (typeof EVENT_SETTINGS_PAGES)[number]['key'];

/** The open page of the workspace: a tab (Katılımcılar maybe on its Kayıt ayarları), or a setting. */
export type EventPage =
  | { kind: 'tab'; tab: EventTab; registrationSettings?: boolean }
  | { kind: 'settings'; page: EventSettingsPage };

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

/** A page of the "Etkinlik ayarları" group (Genel when none is named). */
export function eventSettingsHref(eventId: string, page: EventSettingsPage = 'general'): string {
  return `/events/${encodeURIComponent(eventId)}/settings/${page}`;
}

/** Katılımcılar › Kayıt ayarları: the form, the capacity and the ticket, beside the list. */
export function eventRegistrationSettingsHref(eventId: string): string {
  return `${eventTabHref(eventId, 'participants')}/settings`;
}

/** A card on a page (#kapi-gorevlileri on Kapı), for a link that lands on it. */
export function withCard(href: string, card?: string): string {
  return card ? `${href}#${card}` : href;
}

/** The cards other pages link to by their anchor. */
export const EVENT_CARDS = {
  registrationForm: 'kayit-formu',
  capacity: 'kontenjan',
  ticket: 'bilet',
  doorStaff: 'kapi-gorevlileri',
  entryMode: 'kapi-duzeni',
  feedback: 'geri-bildirim',
} as const;

/** Where an event's door staff are chosen: its Kapı page. Program, the door and the overview link here. */
export function eventDoorStaffHref(eventId: string): string {
  return withCard(eventTabHref(eventId, 'checkin'), EVENT_CARDS.doorStaff);
}

/** The open page from a path under /events/[id]; null for pages outside the workspace (a ticket). */
export function eventPageFromPath(pathname: string): EventPage | null {
  const match = pathname.match(/^\/events\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?\/?$/);
  if (!match || match[1] === 'new') return null;
  const [, , segment, sub] = match;
  if (!segment) return { kind: 'tab', tab: 'overview' };
  if (segment === 'settings') {
    const page = EVENT_SETTINGS_PAGES.find((row) => row.key === sub);
    return page ? { kind: 'settings', page: page.key } : null;
  }
  const tab = (Object.keys(TAB_SEGMENTS) as Array<keyof typeof TAB_SEGMENTS>).find(
    (key) => TAB_SEGMENTS[key] === segment,
  );
  if (!tab) return null;
  if (!sub) return { kind: 'tab', tab };
  return tab === 'participants' && sub === 'settings'
    ? { kind: 'tab', tab, registrationSettings: true }
    : null;
}

/** The tab a path under /events/[id] shows; null for a setting or a page outside the tabs. */
export function eventTabFromPath(pathname: string): EventTab | null {
  const page = eventPageFromPath(pathname);
  return page?.kind === 'tab' && !page.registrationSettings ? page.tab : null;
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
 * Where a link to the old Düzenle page (/events/[id]/edit, its sections as #anchors) now lands:
 * each section's settings went to the page they belong to. Without a known section, Genel.
 */
export function legacyEditHref(eventId: string, hash = ''): string {
  const section = hash.replace(/^#/, '');
  switch (section) {
    case 'duzenleyenler':
      return eventSettingsHref(eventId, 'team');
    case 'zaman':
      return eventSettingsHref(eventId, 'schedule');
    case 'basvuru':
      return withCard(eventRegistrationSettingsHref(eventId), EVENT_CARDS.registrationForm);
    case 'bilet':
      return withCard(eventRegistrationSettingsHref(eventId), EVENT_CARDS.capacity);
    case 'kapi-gorevlileri':
      return eventDoorStaffHref(eventId);
    case 'gorunum':
      return eventSettingsHref(eventId, 'appearance');
    case 'sertifika':
      return eventTabHref(eventId, 'certificates');
    case 'yayin':
      return eventSettingsHref(eventId, 'visibility');
    default:
      return eventSettingsHref(eventId, 'general');
  }
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
