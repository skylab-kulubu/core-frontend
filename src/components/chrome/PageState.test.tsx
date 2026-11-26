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
import { sceneAction, sceneTitle } from '@/test/error-scenes';

describe('page states', () => {
  it('says no access to a whole page with the 403 scene, its one h1, and leads to Özet', () => {
    render(<Forbidden pageTitle="Duyurular" />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: sceneTitle('forbidden') }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Duyurular' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: sceneAction('forbidden') })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('keeps the card for a forbidden tab inside an object page, with no h1 of its own', () => {
    render(<Forbidden />);
    expect(screen.getByText('Bu sayfaya erişimin yok')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Özete dön' })).toHaveAttribute('href', '/dashboard');
  });

  it('says a missing page with the 404 scene and opens the search', async () => {
    const pointer = userEvent.setup();
    const open = jest.fn();
    render(
      <SearchContext.Provider value={open}>
        <NotFoundState />
      </SearchContext.Provider>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: sceneTitle('notFound') }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: sceneAction('notFound') })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    await pointer.click(screen.getByRole('button', { name: 'Ara' }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('offers no search outside the chrome', () => {
    render(<NotFoundState />);
    expect(screen.queryByRole('button', { name: 'Ara' })).not.toBeInTheDocument();
  });

  it('retries a page that broke, with the 500 scene, or leads to Özet', async () => {
    const pointer = userEvent.setup();
    const retry = jest.fn();
    render(<RouteErrorState onRetry={retry} />);
    expect(
      screen.getByRole('heading', { level: 1, name: sceneTitle('error') }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Özete dön' })).toHaveAttribute('href', '/dashboard');
    await pointer.click(screen.getByRole('button', { name: sceneAction('error') }));
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
