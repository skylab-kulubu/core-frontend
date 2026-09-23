import { handoffTargetErrors } from '@/lib/handoff/targets';

const FORMS_ROOT = 'https://forms.yildizskylab.com';

describe('handoffTargetErrors', () => {
  it.each([
    ['Forms', '/auth/signin', 'callbackUrl'],
    ['Account center', '/api/auth/login', 'returnTo'],
    ['a root entry', '/', 'next'],
    ['a trailing slash and unreserved characters', '/auth/sign-in_v2.~/', 'next'],
    ['a 128-character path', `/${'a'.repeat(127)}`, 'next'],
    ['a 32-character parameter', '/signin', `r${'x'.repeat(31)}`],
    ['an underscore parameter', '/signin', 'return_to'],
  ])('accepts %s', (_name, signInPath, returnParam) => {
    expect(handoffTargetErrors({ enabled: true, signInPath, returnParam }, FORMS_ROOT)).toEqual({});
  });

  it.each([
    ['a relative path', 'auth/signin'],
    ['a protocol-relative path', '//evil.example/signin'],
    ['a double slash inside', '/auth//signin'],
    ['a backslash', '/auth\\signin'],
    ['a parent segment', '/auth/../admin'],
    ['a query', '/auth/signin?prompt=none'],
    ['a fragment', '/auth/signin#top'],
    ['a dot segment', '/auth/./signin'],
    ['a space', '/auth/sign in'],
    ['a percent escape', '/auth/%2e%2e/signin'],
    ['a colon', '/auth:signin'],
    ['129 characters', `/${'a'.repeat(128)}`],
    ['nothing while enabled', ''],
  ])('refuses %s as the sign-in path', (_name, signInPath) => {
    const errors = handoffTargetErrors(
      { enabled: true, signInPath, returnParam: 'callbackUrl' },
      FORMS_ROOT,
    );
    expect(errors.signInPath).toEqual(expect.any(String));
    expect(errors.returnParam).toBeUndefined();
  });

  it.each([
    ['a leading digit', '1next'],
    ['a dash', 'return-to'],
    ['a leading underscore', '_next'],
    ['33 characters', `r${'x'.repeat(32)}`],
    ['nothing while enabled', ''],
  ])('refuses %s as the return parameter', (_name, returnParam) => {
    const errors = handoffTargetErrors(
      { enabled: true, signInPath: '/auth/signin', returnParam },
      FORMS_ROOT,
    );
    expect(errors.returnParam).toEqual(expect.any(String));
    expect(errors.signInPath).toBeUndefined();
  });

  it('lets a disabled target keep empty fields but still checks what is typed', () => {
    expect(handoffTargetErrors({ enabled: false, signInPath: '', returnParam: '' }, null)).toEqual(
      {},
    );
    expect(
      handoffTargetErrors({ enabled: false, signInPath: 'signin', returnParam: '' }, null)
        .signInPath,
    ).toEqual(expect.any(String));
  });

  it.each([
    ['another domain', 'https://evil.example'],
    ['a look-alike domain', 'https://yildizskylab.com.evil.example'],
    ['plain http', 'http://forms.yildizskylab.com'],
    ['a port', 'https://forms.yildizskylab.com:8443'],
    ['the default port spelled out', 'https://forms.yildizskylab.com:443'],
    ['a path', 'https://forms.yildizskylab.com/app'],
    ['an underscore host', 'https://sky_forms.yildizskylab.com'],
    ['userinfo', 'https://admin@forms.yildizskylab.com'],
    ['a query', 'https://forms.yildizskylab.com/?x=1'],
    ['a Keycloak placeholder', '${authBaseUrl}'],
    ['no root URL', null],
  ])('refuses to enable a client whose root URL has %s', (_name, rootUrl) => {
    const input = { enabled: true, signInPath: '/auth/signin', returnParam: 'callbackUrl' };
    expect(handoffTargetErrors(input, rootUrl).target).toEqual(expect.any(String));
    expect(handoffTargetErrors({ ...input, enabled: false }, rootUrl)).toEqual({});
  });

  it('accepts the apex domain and subdomains as root URLs', () => {
    const input = { enabled: true, signInPath: '/auth/signin', returnParam: 'callbackUrl' };
    expect(handoffTargetErrors(input, 'https://yildizskylab.com')).toEqual({});
    expect(handoffTargetErrors(input, 'https://my.yildizskylab.com/')).toEqual({});
  });
});
