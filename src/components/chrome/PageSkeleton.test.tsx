import { render, screen } from '@testing-library/react';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';

describe('PageSkeleton', () => {
  it.each(['list', 'workspace', 'detail'] as const)(
    'says "Yükleniyor" once to screen readers (%s)',
    (variant) => {
      render(<PageSkeleton variant={variant} />);
      expect(screen.getByRole('status')).toHaveTextContent(/^Yükleniyor$/);
    },
  );

  it('outlines an event as an object page: band, commands, menu and cards', () => {
    const { container } = render(<PageSkeleton variant="workspace" />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(8);
  });
});
