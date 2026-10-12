import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useConfirm } from '@/lib/ui/use-confirm';

function Remover({ onConfirm }: { onConfirm: () => void }) {
  const [ask, dialog] = useConfirm();
  return (
    <>
      <button
        type="button"
        onClick={() =>
          ask({
            title: '"Açılış" oturumu silinsin mi?',
            description: 'Hemen ardından Geri al ile geri getirebilirsin.',
            actionLabel: 'Oturumu sil',
            onConfirm,
          })
        }
      >
        Sil
      </button>
      {dialog}
    </>
  );
}

describe('useConfirm', () => {
  it('names the action and its target, starts on the safe button and runs only when confirmed', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    render(<Remover onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Sil' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: '"Açılış" oturumu silinsin mi?',
    });
    expect(dialog).toHaveTextContent('Hemen ardından Geri al ile geri getirebilirsin.');
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Vazgeç' })).toHaveFocus(),
    );

    await user.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Sil' }));
    const again = await screen.findByRole('alertdialog');
    await user.click(within(again).getByRole('button', { name: 'Oturumu sil' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });
});
