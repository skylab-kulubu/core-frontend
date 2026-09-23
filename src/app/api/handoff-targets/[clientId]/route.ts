import type { NextRequest } from 'next/server';
import { serverAccessToken } from '@/lib/auth/server-access-token';
import { callHandoffAdmin } from '@/lib/handoff/keycloak-admin';
import { SESSION_EXPIRED_DETAIL } from '@/lib/handoff/messages';
import { problemResponse } from '@/lib/handoff/problem';
import { parseHandoffTargetInput } from '@/lib/handoff/targets';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  // JSON only: a cross-site form cannot send it without a CORS preflight.
  const contentType = request.headers.get('content-type') ?? '';
  if (!/^application\/json\b/i.test(contentType)) {
    return problemResponse(415, 'İstek JSON olarak gönderilmeli.');
  }
  let input;
  try {
    input = parseHandoffTargetInput(await request.json());
  } catch {
    input = null;
  }
  if (!input) {
    return problemResponse(400, 'Açık/kapalı, giriş kapısı yolu ve dönüş parametresi gerekli.');
  }

  const { clientId } = await params;
  if (!clientId.trim() || clientId === '.' || clientId === '..') {
    return problemResponse(400, 'Geçersiz istemci.');
  }

  const token = await serverAccessToken();
  if (!token) return problemResponse(401, SESSION_EXPIRED_DETAIL);
  return callHandoffAdmin(token, `/targets/${encodeURIComponent(clientId)}`, {
    method: 'PUT',
    body: input,
  });
}
