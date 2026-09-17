export function authCookieSecure(): boolean {
  const raw = process.env.AUTH_COOKIE_SECURE;
  if (raw != null && raw !== '') {
    return raw === 'true';
  }
  return process.env.NODE_ENV === 'production';
}
