import { sessionUserFromAccessToken } from './session-user';

function unsignedJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.x`;
}

describe('sessionUserFromAccessToken', () => {
  it('reads groups from JWT claims, not a DataResult envelope', () => {
    const token = unsignedJwt({
      sub: '11111111-1111-1111-1111-111111111111',
      email: 'yk@example.com',
      given_name: 'Y',
      family_name: 'K',
      preferred_username: 'yk',
      groups: ['/UYELER/YK'],
    });
    expect(sessionUserFromAccessToken(token)).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'yk@example.com',
      firstName: 'Y',
      lastName: 'K',
      username: 'yk',
      roles: [],
      groups: ['/UYELER/YK'],
    });
  });

  it('reads authorization roles only from the core resource server', () => {
    const token = unsignedJwt({
      sub: '11111111-1111-1111-1111-111111111111',
      email: 'yk@example.com',
      given_name: 'Y',
      family_name: 'K',
      preferred_username: 'yk',
      groups: ['/UYELER/YK'],
      resource_access: {
        core: { roles: ['url:create'] },
        skylapp: { roles: ['skylapp:access', 'url:create'] },
      },
    });
    expect(sessionUserFromAccessToken(token)?.roles).toEqual(['url:create']);
  });

  it('returns null without sub', () => {
    expect(sessionUserFromAccessToken(unsignedJwt({ email: 'x@y.z' }))).toBeNull();
  });
});
