import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNotify } from '@/lib/ui/use-notify';

function Saver() {
  const notify = useNotify();
  return (
    <button type="button" onClick={() => notify.success('Sezon kaydedildi')}>
      Kaydet
    </button>
  );
}

describe('useNotify', () => {
  it('says a write went through in a polite live region', async () => {
    const user = userEvent.setup();
    render(<Saver />);

    await user.click(screen.getByRole('button', { name: 'Kaydet' }));

    const note = await screen.findByText('Sezon kaydedildi');
    expect(note.closest('[aria-live="polite"]')).not.toBeNull();
  });
});
