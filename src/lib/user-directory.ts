import type { MonthCount } from '@/lib/api/dashboard';
import type { ClientRole, Group } from '@/lib/api/identity';

/** The club's teams: groups two levels under /UYELER, such as /UYELER/ARGE/WEBLAB. */
export function teamGroups(groups: readonly Group[]): Group[] {
  return groups
    .filter((group) => {
      const parts = group.path.split('/').filter(Boolean);
      return parts.length === 3 && parts[0] === 'UYELER';
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

/** A group's path as its names, root first: "UYELER › ARGE › WEBLAB". */
export function groupTrail(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/** Roles by the application that gives them, applications in name order. */
export function rolesByApp(roles: readonly ClientRole[]): { app: string; roles: string[] }[] {
  const byApp = new Map<string, string[]>();
  for (const role of roles) {
    const list = byApp.get(role.clientId) ?? [];
    if (!list.includes(role.role)) list.push(role.role);
    byApp.set(role.clientId, list);
  }
  return [...byApp.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'tr'))
    .map(([app, list]) => ({ app, roles: list.sort((a, b) => a.localeCompare(b, 'tr')) }));
}

/** This month's new members against last month's, in percent; null when last month had none. */
export function monthChange(months: readonly MonthCount[]): {
  current: number;
  previous: number;
  change: number | null;
  year: number;
} {
  const current = months.at(-1)?.count ?? 0;
  const previous = months.at(-2)?.count ?? 0;
  return {
    current,
    previous,
    change: previous ? Math.round(((current - previous) / previous) * 100) : null,
    year: months.reduce((sum, month) => sum + month.count, 0),
  };
}
