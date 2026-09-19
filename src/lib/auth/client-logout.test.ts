import { performClientLogout } from '@/lib/auth/client-logout';

describe('performClientLogout', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('clears client state and lands on the signed-out login screen', async () => {
    window.localStorage.setItem('auth_token', 'access');
    window.localStorage.setItem('user', 'cached-user');
    window.sessionStorage.setItem('auth_user', 'session-user');
    const request = jest.fn().mockResolvedValue({ ok: true } as Response);
    const navigate = jest.fn();

    await performClientLogout({ request, navigate });

    expect(request).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    expect(window.localStorage.getItem('auth_token')).toBeNull();
    expect(window.localStorage.getItem('user')).toBeNull();
    expect(window.sessionStorage.getItem('auth_user')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login?logout=1');
  });
});
