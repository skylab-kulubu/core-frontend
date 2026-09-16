import { extractGroupsFromClaims, extractResourceRoles } from './groups';

function decodePayloadRecord(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(normalized, 'base64').toString('utf8');
    const obj = JSON.parse(json);
    return obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function sessionUserFromAccessToken(token: string | null | undefined): {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  roles: string[];
  groups: string[];
} | null {
  if (!token?.trim()) return null;
  const p = decodePayloadRecord(token.trim());
  if (!p) return null;
  const sub = typeof p.sub === 'string' ? p.sub : '';
  if (!sub) return null;
  const given = typeof p.given_name === 'string' ? p.given_name : '';
  const family = typeof p.family_name === 'string' ? p.family_name : '';
  const email = typeof p.email === 'string' ? p.email : '';
  const preferred = typeof p.preferred_username === 'string' ? p.preferred_username : email;
  return {
    id: sub,
    email,
    firstName: given,
    lastName: family,
    username: preferred,
    roles: extractResourceRoles(p),
    groups: extractGroupsFromClaims(p),
  };
}

export { isPrivileged, extractGroupsFromClaims } from './groups';
