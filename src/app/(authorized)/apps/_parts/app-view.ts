import type { AppAssignment, AppSummary } from '@/lib/api/apps';
import { formatInstant } from '@/lib/app-assignments';

/** Entra's "Assignment required?" in the club's words. */
export function accessLabel(app: Pick<AppSummary, 'assignmentRequired'>): string {
  return app.assignmentRequired ? 'Yalnız atananlar' : 'Herkese açık';
}

/** "4 grup · 2 kişi", or "Atama yok". */
export function assignmentCount(app: Pick<AppSummary, 'groups' | 'users'>): string {
  if (!app.groups && !app.users) return 'Atama yok';
  return `${app.groups} grup · ${app.users} kişi`;
}

/** Two letters for the app's mark: "SkyMail" → "SM", "Hesap merkezi" → "HM". */
export function appInitials(name: string): string {
  const words = name
    .trim()
    .split(/[\s:·-]+/)
    .filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toLocaleUpperCase('tr-TR');
  const word = words[0] ?? '?';
  const capitals = word.match(/\p{Lu}/gu) ?? [];
  if (capitals.length >= 2) return capitals.slice(0, 2).join('');
  return word.slice(0, 2).toLocaleUpperCase('tr-TR');
}

/** The app's sections, kept in the address as `?bolum=`. */
export type AppSection = 'genel' | 'atamalar' | 'denetim';

export function appSection(raw: string | null): AppSection {
  return raw === 'atamalar' || raw === 'denetim' ? raw : 'genel';
}

export function appHref(clientId: string, section: AppSection = 'genel'): string {
  const base = `/apps/${encodeURIComponent(clientId)}`;
  return section === 'genel' ? base : `${base}?bolum=${section}`;
}

/** The assignments view chips: all, Groups, people (Entra's "Yalnız kişiler"). */
export type AssignmentView = 'all' | 'group' | 'user';

export function assignmentView(raw: string): AssignmentView {
  return raw === 'group' || raw === 'user' ? raw : 'all';
}

/** Who made the assignment and when; '' when nobody knows (made before the panel). */
export function assignedBy(row: AppAssignment): { name: string; when: string } | null {
  if (!row.assignedBy || !row.assignedAt) return null;
  return {
    name: row.assignedBy.name || 'Bilinmeyen kişi',
    when: formatInstant(row.assignedAt),
  };
}

/** The row's own line under its name: the Group's path or the person's address. */
export function assignmentWhere(row: AppAssignment): string {
  return (row.type === 'group' ? row.path : row.email) ?? '';
}
