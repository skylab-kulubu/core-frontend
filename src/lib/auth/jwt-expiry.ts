/**
 * Sunucuda access JWT'nin süresinin dolmuş sayılıp sayılmayacağını kontrol eder.
 * Süre alanı yoksa (opaque token vb.) süresiz kabul edilir.
 */
export function isJwtExpired(token: string, leewaySeconds = 15): boolean {
  try {
    const [, payloadBase64] = token.split('.');
    if (!payloadBase64) return true;
    const payloadJson = Buffer.from(
      payloadBase64.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8');
    const payload = JSON.parse(payloadJson) as { exp?: number };
    if (payload.exp == null) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return payload.exp <= nowSec + leewaySeconds;
  } catch {
    return true;
  }
}

/**
 * Seconds until the access JWT expires by this server's clock; `null` without a readable `exp`.
 * The token route sends it with the token, so the browser keeps the token for that long by its
 * own clock (a wrong browser clock cannot make it hold an expired token).
 */
export function jwtSecondsLeft(token: string): number | null {
  try {
    const [, payloadBase64] = token.split('.');
    if (!payloadBase64) return null;
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) as {
      exp?: unknown;
    };
    if (typeof payload.exp !== 'number') return null;
    return payload.exp - Math.floor(Date.now() / 1000);
  } catch {
    return null;
  }
}
