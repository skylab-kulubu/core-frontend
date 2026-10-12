import { render, screen } from '@testing-library/react';
import LoginPage from '@/app/login/page';

const mockSearchParams = new URLSearchParams({ error: 'stale_authentication' });

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));

describe('Giriş sayfası', () => {
  it('says why a sign-in older than 8 hours was refused, and offers a new one', async () => {
    render(<LoginPage />);

    expect(
      await screen.findByText(
        'Panel en fazla 8 saat önceki bir girişi kabul eder. Yeniden giriş yap.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tekrar dene' })).toBeInTheDocument();
  });
});
