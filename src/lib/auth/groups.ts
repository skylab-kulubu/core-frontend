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

export function isPrivileged(groups: readonly string[]): boolean {
  return groups.some((g) => /\/(ADMIN|YK|DK)(\/|$)/.test(g));
}
