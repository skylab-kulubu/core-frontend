export function extractGroupsFromClaims(payload: Record<string, unknown> | null): string[] {
  if (!payload) return [];
  const raw = payload.groups ?? payload.group;
  if (Array.isArray(raw)) {
    return raw.filter((g): g is string => typeof g === 'string' && g.length > 0);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(/[\s,]+/).filter(Boolean);
  }
  return [];
}

const LEADER_SUBGROUPS = ['LIDERLER', 'KOORDINATORLER'] as const;

export function isPrivileged(groups: readonly string[]): boolean {
  return groups.some((g) => /\/(ADMIN|YK|DK)(\/|$)/.test(g));
}

export function isLeader(groups: readonly string[]): boolean {
  return groups.some((g) => /\/(LIDERLER|KOORDINATORLER)(\/|$)/.test(g));
}

export function leaderOwnerTeams(groups: readonly string[]): string[] {
  const teams = new Set<string>();
  for (const g of groups) {
    const match = g.match(/\/([^/]+)\/(LIDERLER|KOORDINATORLER)(\/|$)/);
    if (match) teams.add(match[1]);
  }
  return [...teams];
}

export function ownerLevels(groups: readonly string[], owner: string): Array<'LEADER' | 'MEMBER'> {
  if (!owner) return [];
  let leader = false;
  let member = false;
  for (const g of groups) {
    for (const sub of LEADER_SUBGROUPS) {
      if (g.includes(`/${owner}/${sub}`)) leader = true;
    }
    if (g.endsWith(`/${owner}`) || g.includes(`/${owner}/`)) member = true;
  }
  const out: Array<'LEADER' | 'MEMBER'> = [];
  if (leader) out.push('LEADER');
  if (member) out.push('MEMBER');
  return out;
}

export type EventWriteAction = 'create' | 'update' | 'delete';

export function canWriteEvent(
  groups: readonly string[],
  ownerTeam: string,
  action: EventWriteAction,
): boolean {
  if (isPrivileged(groups)) return true;
  const levels = ownerLevels(groups, ownerTeam);
  const needed: Array<'LEADER' | 'MEMBER'> =
    ownerTeam === 'GECEKODU' && action !== 'delete' ? ['LEADER', 'MEMBER'] : ['LEADER'];
  return levels.some((level) => needed.includes(level));
}

export function canWriteSeason(groups: readonly string[]): boolean {
  return isPrivileged(groups);
}

export function canCheckInForTeam(groups: readonly string[], ownerTeam: string): boolean {
  if (isPrivileged(groups)) return true;
  return ownerLevels(groups, ownerTeam).includes('LEADER');
}

export function canManageCompetitors(groups: readonly string[], ownerTeam: string): boolean {
  if (isPrivileged(groups)) return true;
  return ownerLevels(groups, ownerTeam).includes('LEADER');
}

export function canSeeSchedulingNav(groups: readonly string[]): boolean {
  return isPrivileged(groups) || isLeader(groups);
}

export function extractResourceRoles(payload: Record<string, unknown> | null): string[] {
  if (!payload) return [];
  const ra = payload.resource_access;
  if (!ra || typeof ra !== 'object') return [];
  const clients = ra as Record<string, unknown>;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const client of ['core', 'skylapp'] as const) {
    const entry = clients[client];
    if (!entry || typeof entry !== 'object') continue;
    const raw = (entry as Record<string, unknown>).roles;
    if (!Array.isArray(raw)) continue;
    for (const role of raw) {
      if (typeof role !== 'string' || !role || seen.has(role)) continue;
      seen.add(role);
      out.push(role);
    }
  }
  return out;
}

export function canUseUrls(groups: readonly string[], roles: readonly string[]): boolean {
  if (isPrivileged(groups)) return true;
  return roles.some((role) => role.startsWith('url:') || role.startsWith('skylapp:'));
}

export function canModerateUrls(groups: readonly string[], roles: readonly string[]): boolean {
  if (isPrivileged(groups)) return true;
  return roles.includes('url:moderator') || roles.includes('skylapp:moderator');
}
