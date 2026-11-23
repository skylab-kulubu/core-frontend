/**
 * What a failed sign-in says under its title ("Giriş yapılamadı"), by the code the callback
 * sends: why, then what to do. Fixed words only: the code and core's or Keycloak's own detail
 * are never shown. Keycloak's codes are OAuth 2.0's (RFC 6749 4.1.2.1) and OIDC's (Core 3.1.2.6).
 */
const LOGIN_ERRORS: Record<string, string> = {
  token_exchange_failed: 'Giriş doğrulanamadı. Yeniden dene.',
  no_code: 'Giriş sayfası yarıda kaldı. Yeniden dene.',
  invalid_state: 'Giriş isteğinin süresi doldu. Yeniden dene.',
  missing_code_verifier: 'Giriş isteğinin süresi doldu. Yeniden dene.',
  access_denied: 'Giriş iptal edildi.',
  config_missing: 'Giriş şu an açık değil.',
  stale_authentication: 'Panel en fazla 8 saat önceki bir girişi kabul eder. Yeniden giriş yap.',
  // Keycloak sends this when its login page waited too long (the login form's timeout)
  temporarily_unavailable: 'Giriş sayfası zaman aşımına uğradı. Yeniden dene.',
  server_error: 'Giriş hizmeti şu an yanıt vermiyor. Biraz sonra yeniden dene.',
  login_required: 'Oturumun kapanmış. Yeniden giriş yap.',
  interaction_required: 'Oturumun kapanmış. Yeniden giriş yap.',
};

/** Any code the page has no words for: the callback sends this one instead. */
export const UNKNOWN_LOGIN_ERROR = 'login_failed';

const UNKNOWN_MESSAGE = 'Beklenmeyen bir sorun çıktı. Yeniden dene.';

function known(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(LOGIN_ERRORS, code);
}

/** The code the callback may put in the address: one of the page's own, never Keycloak's text. */
export function loginErrorCode(code: string): string {
  return known(code) ? code : UNKNOWN_LOGIN_ERROR;
}

export function loginErrorMessage(code: string): string {
  return known(code) ? LOGIN_ERRORS[code] : UNKNOWN_MESSAGE;
}
