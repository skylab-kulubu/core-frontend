import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {
  EmptyState,
  Forbidden,
  NotFoundState,
  RouteErrorState,
} from '@/components/chrome/PageState';
import { SearchContext } from '@/components/layout/search-context';

describe('page states', () => {
  it('says no access in one way, under the page title, and leads to Özet', () => {
    render(<Forbidden pageTitle="Duyurular" />);
    expect(screen.getByRole('heading', { name: 'Duyurular' })).toBeInTheDocument();
    expect(screen.getByText('Bu sayfaya erişimin yok')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Özete dön' })).toHaveAttribute('href', '/dashboard');
  });

  it('says a missing page in Turkish and opens the search', async () => {
    const pointer = userEvent.setup();
    const open = jest.fn();
    render(
      <SearchContext.Provider value={open}>
        <NotFoundState />
      </SearchContext.Provider>,
    );
    expect(screen.getByText('Sayfa bulunamadı')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Özete dön' })).toHaveAttribute('href', '/dashboard');
    await pointer.click(screen.getByRole('button', { name: 'Ara' }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('offers no search outside the chrome', () => {
    render(<NotFoundState />);
    expect(screen.queryByRole('button', { name: 'Ara' })).not.toBeInTheDocument();
  });

  it('retries a page that broke', async () => {
    const pointer = userEvent.setup();
    const retry = jest.fn();
    render(<RouteErrorState onRetry={retry} />);
    await pointer.click(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('gives each empty list its one way on', async () => {
    const pointer = userEvent.setup();
    const clear = jest.fn();
    const retry = jest.fn();
    const { rerender } = render(<EmptyState kind="no-results" onClear={clear} />);
    expect(screen.getByText('Bu süzgeçte sonuç yok')).toBeInTheDocument();
    await pointer.click(screen.getByRole('button', { name: 'Süzgeci temizle' }));
    expect(clear).toHaveBeenCalledTimes(1);

    rerender(<EmptyState kind="failed" onRetry={retry} />);
    expect(screen.getByText('Liste yüklenemedi')).toBeInTheDocument();
    await pointer.click(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(retry).toHaveBeenCalledTimes(1);

    rerender(
      <EmptyState
        kind="first-use"
        title="Henüz duyuru yok"
        action={<button>Duyuru ekle</button>}
      />,
    );
    expect(screen.getByText('Henüz duyuru yok')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duyuru ekle' })).toBeInTheDocument();
  });
});
