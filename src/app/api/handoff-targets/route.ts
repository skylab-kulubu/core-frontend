import { serverAccessToken } from '@/lib/auth/server-access-token';
import { callHandoffAdmin } from '@/lib/handoff/keycloak-admin';
import { SESSION_EXPIRED_DETAIL } from '@/lib/handoff/messages';
import { problemResponse } from '@/lib/handoff/problem';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = await serverAccessToken();
  if (!token) return problemResponse(401, SESSION_EXPIRED_DETAIL);
  return callHandoffAdmin(token, '/targets');
}
