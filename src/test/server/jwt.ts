function unsignedJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${header}.${body}.sig`;
}

function expiresIn(seconds: number): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

/** An admin's access JWT that expires `expiresInSeconds` from now (negative: already expired). */
export function accessToken(expiresInSeconds = 300): string {
  return unsignedJwt({ sub: 'admin-1', exp: expiresIn(expiresInSeconds) });
}

/** A live access JWT that names no user (no `sub`), so no session can be built from it. */
export function accessTokenWithoutUser(): string {
  return unsignedJwt({ exp: expiresIn(300) });
}
