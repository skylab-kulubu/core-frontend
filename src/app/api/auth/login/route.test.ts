/** @jest-environment node */

import { GET } from '@/app/api/auth/login/route';
import { getOAuth2AuthUrl } from '@/lib/auth/oauth2';

jest.mock('@/lib/auth/oauth2', () => ({
  getOAuth2AuthUrl: jest.fn(),
}));

describe('OAuth login route', () => {
  it('turns the local configuration error path into an absolute redirect', async () => {
    (getOAuth2AuthUrl as jest.Mock).mockReturnValue('/login?error=config_missing');
    const response = await GET(new Request('http://localhost:3000/api/auth/login'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?error=config_missing',
    );
  });
});
