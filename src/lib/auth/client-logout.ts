/**
 * Oturumu sunucuda sonlandırmaya çalışır; istemci oturum verisini temizler ve
 * giriş sayfasına yönlendirir (ağ hatasında da çıkışı tamamlar).
 */
type LogoutClientOptions = {
  request?: typeof fetch;
  navigate?: (target: string) => void;
};

export async function performClientLogout(options: LogoutClientOptions = {}): Promise<void> {
  const request = options.request ?? fetch;
  try {
    await request('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('auth_user');
    const navigate = options.navigate ?? ((target: string) => (window.location.href = target));
    navigate('/login?logout=1');
  }
}
