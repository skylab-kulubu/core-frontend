/**
 * What a failed sign-in says, by the code the callback sends. Fixed words only: the code
 * and core's or Keycloak's own detail are never shown.
 */
const LOGIN_ERRORS: Record<string, string> = {
  token_exchange_failed: 'Giriş tamamlanamadı.',
  no_code: 'Giriş tamamlanamadı.',
  invalid_state: 'Giriş isteğinin süresi doldu.',
  missing_code_verifier: 'Giriş isteğinin süresi doldu.',
  access_denied: 'Giriş iptal edildi.',
  config_missing: 'Giriş şu an açık değil.',
  stale_authentication: 'Panel en fazla 8 saat önceki bir girişi kabul eder. Yeniden giriş yap.',
};

export function loginErrorMessage(code: string): string {
  return Object.prototype.hasOwnProperty.call(LOGIN_ERRORS, code)
    ? LOGIN_ERRORS[code]
    : 'Giriş tamamlanamadı.';
}
