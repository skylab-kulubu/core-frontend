import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const OAUTH_STATE_COOKIE = 'oauth_state';
export const OAUTH_CODE_VERIFIER_COOKIE = 'oauth_code_verifier';
export const OAUTH_TRANSACTION_MAX_AGE_SECONDS = 10 * 60;

export function createOAuthTransaction(): {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
} {
  const state = randomBytes(32).toString('base64url');
  const codeVerifier = randomBytes(64).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  return { state, codeVerifier, codeChallenge };
}

export function oauthStateMatches(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected) return false;

  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
