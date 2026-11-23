import { render, screen } from '@testing-library/react';
import LoginPage from '@/app/login/page';
import { loginErrorMessage } from '@/app/login/login-errors';

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

    expect(await screen.findByText('Giriş tamamlanamadı.')).toBeInTheDocument();
    expect(screen.queryByText(/invalid_grant/)).not.toBeInTheDocument();
    expect(screen.queryByText(/token_exchange_failed/)).not.toBeInTheDocument();
  });

  it('says a code it does not know in the same plain words', () => {
    expect(loginErrorMessage('access_denied')).toBe('Giriş iptal edildi.');
    expect(loginErrorMessage('<script>')).toBe('Giriş tamamlanamadı.');
    expect(loginErrorMessage('toString')).toBe('Giriş tamamlanamadı.');
  });

  it('offers to sign in again after signing out', async () => {
    mockSearchParams = new URLSearchParams({ logout: '1' });
    render(<LoginPage />);
    expect(await screen.findByRole('heading', { name: 'Çıkış yapıldı' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Giriş yap' })).toBeInTheDocument();
  });
});
