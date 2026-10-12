import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProblemError } from '@/lib/api/core';
import { useNotify } from '@/lib/ui/use-notify';

function Deleter({ undo }: { undo: () => Promise<unknown> }) {
  const notify = useNotify();
  return (
    <button
      type="button"
      onClick={() => notify.undoable('Oturum silindi', undo, 'Oturum geri alındı')}
    >
      Sil
    </button>
  );
}

describe('useNotify undoable', () => {
  it('offers Geri al and says when the undo went through', async () => {
    const user = userEvent.setup();
    const undo = jest.fn().mockResolvedValue(undefined);
    render(<Deleter undo={undo} />);

    await user.click(screen.getByRole('button', { name: 'Sil' }));
    expect(await screen.findByText('Oturum silindi')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Geri al' }));

    expect(undo).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Oturum geri alındı')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Oturum silindi')).not.toBeInTheDocument());
  });

  it('says why an undo failed', async () => {
    const user = userEvent.setup();
    const undo = jest.fn().mockRejectedValue(new ProblemError(409, 'Etkinlik arşivlenmiş'));
    render(<Deleter undo={undo} />);

    await user.click(screen.getByRole('button', { name: 'Sil' }));
    await user.click(await screen.findByRole('button', { name: 'Geri al' }));

    expect(await screen.findByText('Geri alınamadı')).toBeInTheDocument();
    expect(screen.getByText('Etkinlik arşivlenmiş')).toBeInTheDocument();
  });
});
