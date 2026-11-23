import { render, screen } from '@testing-library/react';
import LoginPage from '@/app/login/page';
import { loginErrorCode, loginErrorMessage, UNKNOWN_LOGIN_ERROR } from '@/app/login/login-errors';

let mockSearchParams = new URLSearchParams({ error: 'stale_authentication' });

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));

describe('Giriş sayfası', () => {
  it('says why a sign-in older than 8 hours was refused, and offers a new one', async () => {
    mockSearchParams = new URLSearchParams({ error: 'stale_authentication' });
    render(<LoginPage />);

    expect(
      await screen.findByText(
        'Panel en fazla 8 saat önceki bir girişi kabul eder. Yeniden giriş yap.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tekrar giriş yap' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hesap merkezi' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\//),
    );
    expect(screen.getByText(/SKY LAB/)).toBeInTheDocument();
  });

  it('never shows the error code or the detail the callback passed along', async () => {
    mockSearchParams = new URLSearchParams({
      error: 'token_exchange_failed',
      details: 'invalid_grant: Code not valid',
    });
    render(<LoginPage />);

    expect(await screen.findByText('Giriş doğrulanamadı. Yeniden dene.')).toBeInTheDocument();
    expect(screen.queryByText(/invalid_grant/)).not.toBeInTheDocument();
    expect(screen.queryByText(/token_exchange_failed/)).not.toBeInTheDocument();
  });

  it('says a code it does not know in the same plain words', () => {
    expect(loginErrorMessage('access_denied')).toBe('Giriş iptal edildi.');
    expect(loginErrorMessage('<script>')).toBe('Beklenmeyen bir sorun çıktı. Yeniden dene.');
    expect(loginErrorMessage('toString')).toBe('Beklenmeyen bir sorun çıktı. Yeniden dene.');
    expect(loginErrorMessage(UNKNOWN_LOGIN_ERROR)).toBe(
      'Beklenmeyen bir sorun çıktı. Yeniden dene.',
    );
  });

  it("says Keycloak's common refusals in their own words", () => {
    expect(loginErrorMessage('temporarily_unavailable')).toBe(
      'Giriş sayfası zaman aşımına uğradı. Yeniden dene.',
    );
    expect(loginErrorMessage('server_error')).toBe(
      'Giriş hizmeti şu an yanıt vermiyor. Biraz sonra yeniden dene.',
    );
    expect(loginErrorMessage('login_required')).toBe('Oturumun kapanmış. Yeniden giriş yap.');
  });

  it('never repeats the title in the line under it', async () => {
    for (const code of ['token_exchange_failed', 'no_code', 'server_error', 'whatever']) {
      mockSearchParams = new URLSearchParams({ error: code });
      const { unmount } = render(<LoginPage />);
      const title = await screen.findByRole('heading', { name: 'Giriş yapılamadı' });
      const line = title.nextElementSibling?.textContent ?? '';
      expect(line).not.toMatch(/^Giriş (yapılamadı|tamamlanamadı)/);
      unmount();
    }
  });

  it('keeps only its own codes for the address', () => {
    expect(loginErrorCode('temporarily_unavailable')).toBe('temporarily_unavailable');
    expect(loginErrorCode('invalid_grant: Code not valid')).toBe(UNKNOWN_LOGIN_ERROR);
    expect(loginErrorCode('__proto__')).toBe(UNKNOWN_LOGIN_ERROR);
  });

  it('offers to sign in again after signing out', async () => {
    mockSearchParams = new URLSearchParams({ logout: '1' });
    render(<LoginPage />);
    expect(await screen.findByRole('heading', { name: 'Çıkış yapıldı' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Giriş yap' })).toBeInTheDocument();
  });
});
