import { render, screen } from '@testing-library/react';
import { Pencil, Plus } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';

describe('ActionButton', () => {
  it('writes a primary action out beside its icon', () => {
    render(
      <ActionButton icon={Plus} variant="primary" label="Kullanıcı ekle" onClick={() => {}} />,
    );
    const button = screen.getByRole('button', { name: 'Kullanıcı ekle' });
    expect(button).toHaveTextContent('Kullanıcı ekle');
    expect(button).not.toHaveAttribute('aria-label');
  });

  it('writes a ghost action out when asked, as a link with href', () => {
    render(<ActionButton icon={Pencil} label="Düzenle" showLabel href="/events/e1/edit" />);
    const link = screen.getByRole('link', { name: 'Düzenle' });
    expect(link).toHaveTextContent('Düzenle');
    expect(link).toHaveAttribute('href', '/events/e1/edit');
  });

  it('keeps a row action an icon named for screen readers', () => {
    render(<ActionButton icon={Pencil} label="Oturumu düzenle" onClick={() => {}} />);
    const button = screen.getByRole('button', { name: 'Oturumu düzenle' });
    expect(button).toHaveAttribute('aria-label', 'Oturumu düzenle');
    expect(button).not.toHaveTextContent('Oturumu düzenle');
  });
});

describe('ActionButton on a phone', () => {
  it('keeps its name when the written label hides under 640px', () => {
    render(<ActionButton icon={Pencil} label="Düzenle" showLabel iconOnlyOnPhone href="/e/edit" />);
    const link = screen.getByRole('link', { name: 'Düzenle' });
    expect(link.querySelector('span.hidden.sm\\:inline')).toHaveTextContent('Düzenle');
  });
});
