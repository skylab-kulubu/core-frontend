import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProblemError } from '@/lib/api/core';
import { useConfirm, type ConfirmRequest } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

function Remover({
  onConfirm,
  failure,
}: {
  onConfirm: () => void | Promise<void>;
  failure?: ConfirmRequest['failure'];
}) {
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
            failure,
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

  it('stays open with its button pending until the action finishes, then closes', async () => {
    const user = userEvent.setup();
    let finish: () => void = () => {};
    const onConfirm = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<Remover onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Sil' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Oturumu sil' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const action = within(dialog).getByRole('button', { name: 'Oturumu sil' });
    expect(action).toBeDisabled();
    // skylcn-ui's pending look: aria-busy once the wait is long enough to show
    await waitFor(() => expect(action).toHaveAttribute('aria-busy', 'true'));
    // Vazgeç does not drop a running action
    await user.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    finish();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('says a refusal inside the dialog in Turkish, never core’s English, and stays open', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn().mockRejectedValue(
      new ProblemError(409, 'Conflict', {
        detail: 'session is referenced by 3 check-ins and cannot be deleted',
      }),
    );
    render(<Remover onConfirm={onConfirm} failure="Oturum silinemedi" />);

    await user.click(screen.getByRole('button', { name: 'Sil' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Oturumu sil' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Kayıt şu anki durumunda buna uygun değil');
    expect(dialog).not.toHaveTextContent('Conflict');
    expect(dialog).not.toHaveTextContent('referenced');
    expect(within(dialog).getByRole('button', { name: 'Oturumu sil' })).toBeEnabled();
    // Not a toast: the only alert on the page is the dialog's
    expect(screen.getAllByRole('alert')).toHaveLength(1);

    // Asked again, the dialog starts clean
    await user.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Sil' }));
    expect(within(await screen.findByRole('alertdialog')).queryByRole('alert')).toBeNull();
  });

  it('uses the request’s fallback when the failure is not core’s', async () => {
    const user = userEvent.setup();
    render(
      <Remover
        onConfirm={jest.fn().mockRejectedValue(new Error('boom'))}
        failure="Oturum silinemedi"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Sil' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Oturumu sil' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Oturum silinemedi');
    expect(dialog).not.toHaveTextContent('boom');
  });

  it('closes on success and then shows the toast the action raised', async () => {
    const user = userEvent.setup();
    function Saver() {
      const notify = useNotify();
      return <Remover onConfirm={async () => notify.success('Oturum silindi')} />;
    }
    render(<Saver />);
    await user.click(screen.getByRole('button', { name: 'Sil' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Oturumu sil' }),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Oturum silindi')).toBeInTheDocument();
  });
});
