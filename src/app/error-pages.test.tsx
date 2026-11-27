import { render, screen } from '@testing-library/react';
import NotFound from '@/app/not-found';
import AuthorizedNotFound from '@/app/(authorized)/not-found';
import { SearchContext } from '@/components/layout/search-context';
import { sceneAction, sceneTitle } from '@/test/error-scenes';

describe('error pages', () => {
  it('draws a missing page outside the chrome with the 404 scene, back to Özet', async () => {
    render(<NotFound />);
    expect(
      await screen.findByRole('heading', { level: 1, name: sceneTitle('notFound') }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: sceneAction('notFound') })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('draws a missing page inside the chrome without a landmark of its own, with the search', async () => {
    render(
      <SearchContext.Provider value={jest.fn()}>
        <AuthorizedNotFound />
      </SearchContext.Provider>,
    );
    expect(
      await screen.findByRole('heading', { name: sceneTitle('notFound') }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Ara' })).toBeInTheDocument();
  });
});
