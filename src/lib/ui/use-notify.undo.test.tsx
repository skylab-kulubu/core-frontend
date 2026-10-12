import { act, render, screen, waitFor } from '@testing-library/react';
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

  it('says why an undo failed, in Turkish, assertively, until it is closed', async () => {
    jest.useFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const undo = jest.fn().mockRejectedValue(new ProblemError(409, 'Conflict'));
      render(<Deleter undo={undo} />);

      await user.click(screen.getByRole('button', { name: 'Sil' }));
      await user.click(await screen.findByRole('button', { name: 'Geri al' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Geri alınamadı');
      expect(alert).toHaveTextContent('Bu kayıt artık geri alınamıyor');
      expect(alert).not.toHaveTextContent('Conflict');

      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      expect(screen.getAllByText('Geri alınamadı').length).toBeGreaterThan(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([
    [new ProblemError(403, 'Forbidden'), 'Bunu geri almaya yetkin yok.'],
    [new ProblemError(404, 'Not Found'), 'Kayıt bulunamadı'],
    [
      new ProblemError(409, 'Conflict', {
        detail: 'Etkinlik aktif değil, yarışmacı geri alınamaz.',
      }),
      'Etkinlik aktif değil, yarışmacı geri alınamaz.',
    ],
    [new TypeError('Failed to fetch'), 'Sunucuya ulaşılamadı'],
  ])('gives a Turkish reason for %p', async (error, reason) => {
    const user = userEvent.setup();
    render(<Deleter undo={jest.fn().mockRejectedValue(error)} />);
    await user.click(screen.getByRole('button', { name: 'Sil' }));
    await user.click(await screen.findByRole('button', { name: 'Geri al' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(reason);
  });
});
