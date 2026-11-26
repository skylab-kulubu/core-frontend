import { EVENT_SETTINGS_PAGES } from '@/lib/event-workspace';

export const CHROME_CRUMB_LABELS: Readonly<Record<string, string>> = {
  '/dashboard': 'Özet',
  '/users': 'Kullanıcılar',
  '/groups': 'Gruplar',
  '/apps': 'Uygulamalar',
  '/announcements': 'Duyurular',
  '/announcements/new': 'Yeni duyuru',
  '/events': 'Etkinlikler',
  '/events/new': 'Yeni etkinlik',
  '/seasons': 'Sezonlar',
  '/sessions': 'Oturumlar',
  '/teams': 'Ekipler',
  '/my-teams': 'Ekibim',
  '/management-memberships': 'Dönem devri',
  '/subject-requests': 'KVKK başvuruları',
  '/qr': 'Kapı',
  '/urls': 'Kısa link',
  '/certificates': 'Sertifikalar',
  '/certificates/templates': 'Şablonlar',
  '/certificates/templates/new': 'Yeni şablon',
  '/certificates/defaults': 'Varsayılanlar',
  '/certificates/fonts': 'Yazı tipleri',
  '/handoff-targets': "SkyApp'ten geçiş",
  '/map-regions': 'Harita bölgeleri',
};

export type ChromeCrumb = Readonly<{ href: string; label: string }>;

/** A record's address part before its page names it: an id reads as a pause, not a word. */
const UNNAMED = '…';

function isRecordId(part: string): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(part) || /^[0-9a-f-]{8,}$/i.test(part) || /^\d+$/.test(part)
  );
}

function formatSegment(part: string): string {
  if (isRecordId(part)) return UNNAMED;
  const known: Record<string, string> = {
    new: 'Yeni',
    edit: 'Düzenle',
    days: 'Günler',
    delete: 'Sil',
    participants: 'Katılımcılar',
    certificates: 'Sertifikalar',
    content: 'Dosyalar',
    competition: 'Yarışma',
    door: 'Kapı',
    checkin: 'Kapı',
    emails: 'Postalar',
    members: 'Üyeler',
    leaders: 'Liderler ve alt ekipler',
    roles: 'Uygulama rolleri',
    settings: 'Ayarlar',
    audit: 'Denetim kaydı',
  };
  if (known[part]) return known[part];
  return part.replace(/[-_]/g, ' ').replace(/^\S/u, (ch) => ch.toLocaleUpperCase('tr-TR'));
}

/** Pages hand their record's name by address; the key ignores percent-encoding. */
export type ChromeCrumbNames = Readonly<Record<string, string>>;

export function chromeCrumbKey(href: string): string {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}

type TrailCrumb = ChromeCrumb & {
  /** A record named by its page ("Yıldız Hackathon"), not a fixed page name. */
  named: boolean;
  /** An id still waiting for its page's name. */
  unnamed: boolean;
};

// Records whose page has no name to give: the kind stands in, after the list it sits in
const RECORD_KINDS: Readonly<Record<string, string>> = {
  competition: 'Yarışmacı',
  templates: 'Şablon',
};

// A ticket's address sits under /events/[id]/tickets, which is the Katılımcılar tab
const TICKETS = /^\/events\/([^/]+)\/tickets$/;

// An event's settings: the group's own name (not the panel's Ayarlar), its pages, and a tab's own
const EVENT_SETTINGS = /^\/events\/[^/]+\/settings$/;
const EVENT_SETTINGS_PAGE = /^\/events\/[^/]+\/settings\/([^/]+)$/;
const REGISTRATION_SETTINGS = /^\/events\/[^/]+\/participants\/settings$/;

function eventCrumbLabel(path: string): string | undefined {
  if (EVENT_SETTINGS.test(path)) return 'Etkinlik ayarları';
  if (REGISTRATION_SETTINGS.test(path)) return 'Kayıt ayarları';
  const page = path.match(EVENT_SETTINGS_PAGE)?.[1];
  return EVENT_SETTINGS_PAGES.find((row) => row.key === page)?.label;
}

function trail(pathname: string, names: ChromeCrumbNames): TrailCrumb[] {
  const parts = (pathname || '/').split('/').filter(Boolean);
  if (parts.length === 0) {
    return [{ href: '/dashboard', label: 'Özet', named: false, unnamed: false }];
  }
  const crumbs: TrailCrumb[] = [];
  let acc = '';
  for (const [index, part] of parts.entries()) {
    acc += `/${part}`;
    const tickets = acc.match(TICKETS);
    if (tickets) {
      crumbs.push({
        href: `/events/${tickets[1]}/participants`,
        label: 'Katılımcılar',
        named: false,
        unnamed: false,
      });
      continue;
    }
    const name = names[chromeCrumbKey(acc)];
    const kind = part === 'new' ? undefined : RECORD_KINDS[parts[index - 1]];
    const label =
      name ?? CHROME_CRUMB_LABELS[acc] ?? eventCrumbLabel(acc) ?? kind ?? formatSegment(part);
    crumbs.push({ href: acc, label, named: Boolean(name), unnamed: !name && label === UNNAMED });
  }
  return crumbs;
}

export function chromeCrumbs(pathname: string, names: ChromeCrumbNames = {}): ChromeCrumb[] {
  return trail(pathname, names).map(({ href, label }) => ({ href, label }));
}

/**
 * The browser tab's title: the page's place from its first named record on
 * ("Yıldız Hackathon · Katılımcılar"), or the whole trail on a page without
 * one ("Sertifikalar · Şablonlar"), then the club. Ids not yet named are left out.
 */
export function chromeDocumentTitle(pathname: string, names: ChromeCrumbNames = {}): string {
  const crumbs = trail(pathname, names);
  const firstNamed = crumbs.findIndex((crumb) => crumb.named);
  const parts = (firstNamed >= 0 ? crumbs.slice(firstNamed) : crumbs)
    .filter((crumb) => !crumb.unnamed)
    .map((crumb) => crumb.label);
  return [...parts, 'SKY LAB'].join(' · ');
}
