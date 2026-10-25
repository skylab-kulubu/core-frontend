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
  '/qr': 'Kapı',
  '/urls': 'Kısa URL',
  '/certificates': 'Sertifikalar',
  '/certificates/templates': 'Şablonlar',
  '/certificates/templates/new': 'Yeni şablon',
  '/certificates/defaults': 'Varsayılanlar',
  '/handoff-targets': "SkyApp'ten geçiş",
};

export type ChromeCrumb = Readonly<{ href: string; label: string }>;

function formatSegment(part: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(part) || /^[0-9a-f-]{8,}$/i.test(part)) {
    return 'Kayıt';
  }
  if (/^\d+$/.test(part)) return 'Kayıt';
  const known: Record<string, string> = {
    new: 'Yeni',
    edit: 'Düzenle',
    days: 'Günler',
    delete: 'Sil',
    tickets: 'Başvuranlar',
    participants: 'Katılımcılar',
    certificates: 'Sertifikalar',
    content: 'İçerik',
    competition: 'Yarışma',
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

export function chromeCrumbs(pathname: string, names: ChromeCrumbNames = {}): ChromeCrumb[] {
  const parts = (pathname || '/').split('/').filter(Boolean);
  if (parts.length === 0) return [{ href: '/dashboard', label: 'Özet' }];
  const crumbs: ChromeCrumb[] = [];
  let acc = '';
  for (const part of parts) {
    acc += `/${part}`;
    crumbs.push({
      href: acc,
      label: names[chromeCrumbKey(acc)] ?? CHROME_CRUMB_LABELS[acc] ?? formatSegment(part),
    });
  }
  return crumbs;
}
