import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProblemError } from '@/lib/api/core';
import { useConfirm, type ConfirmRequest } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

/** How long the dialog holds the reader before a request that has not answered can be left. */
const STALL_MS = 25_000;

function Remover({
  onConfirm,
  failure,
  destructive,
}: {
  onConfirm: () => void | Promise<void>;
  failure?: ConfirmRequest['failure'];
  destructive?: boolean;
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
            destructive,
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
    // Vazgeç cannot drop a running action, and says so: disabled, not silently inert
    const cancel = within(dialog).getByRole('button', { name: 'Vazgeç' });
    expect(cancel).toBeDisabled();
    await user.keyboard('{Escape}');
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

  it('runs the action once when two clicks land in the same batch', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn(() => new Promise<void>(() => {}));
    render(<Remover onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Sil' }));
    const action = within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'Oturumu sil',
    });
    act(() => {
      action.click();
      action.click();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('says a synchronous throw inside the dialog like a refused request', async () => {
    const user = userEvent.setup();
    render(
      <Remover
        onConfirm={() => {
          throw new Error('boom');
        }}
        failure="Oturum silinemedi"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Sil' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Oturumu sil' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Oturum silinemedi');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('takes the destructive tone unless the request turns it off', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Remover onConfirm={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Sil' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('button', { name: 'Oturumu sil' })).toHaveClass(
      'text-destructive',
    );
    unmount();

    render(<Remover onConfirm={jest.fn()} destructive={false} />);
    await user.click(screen.getByRole('button', { name: 'Sil' }));
    const plain = await screen.findByRole('alertdialog');
    expect(within(plain).getByRole('button', { name: 'Oturumu sil' })).not.toHaveClass(
      'text-destructive',
    );
  });

  it('puts the keyboard on Vazgeç once the action is refused', async () => {
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
    await within(dialog).findByRole('alert');
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Vazgeç' })).toHaveFocus(),
    );
  });

  it('gives focus back to the button that asked once the question closes', async () => {
    const user = userEvent.setup();
    render(<Remover onConfirm={jest.fn()} />);
    const asker = screen.getByRole('button', { name: 'Sil' });
    await user.click(asker);
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(asker).toHaveFocus());
  });

  describe('when core does not answer', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    async function askAndHang(onConfirm: () => Promise<void>) {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<Remover onConfirm={onConfirm} failure="Oturum silinemedi" />);
      await user.click(screen.getByRole('button', { name: 'Sil' }));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Oturumu sil' }));
      return { user, dialog };
    }

    it('holds the reader until the wait runs out, then says so and lets them leave', async () => {
      const { dialog } = await askAndHang(() => new Promise<void>(() => {}));

      await act(async () => {
        jest.advanceTimersByTime(STALL_MS - 1_000);
      });
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(within(dialog).queryByRole('status')).toBeNull();

      await act(async () => {
        jest.advanceTimersByTime(1_000);
      });
      // A state, not a refusal: said politely, while a refusal is an alert
      expect(within(dialog).getByRole('status')).toHaveTextContent(
        'Sunucu yanıt vermedi; sonucu listeden denetle.',
      );
      expect(within(dialog).queryByRole('alert')).toBeNull();
      const cancel = within(dialog).getByRole('button', { name: 'Vazgeç' });
      expect(cancel).toBeEnabled();
      // The keyboard lands on the way out
      expect(cancel).toHaveFocus();
      // The request still runs: the action cannot be sent a second time
      expect(within(dialog).getByRole('button', { name: 'Oturumu sil' })).toBeDisabled();

      fireEvent.keyDown(dialog, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    });

    it('says a late refusal as an error toast once the reader has left', async () => {
      let refuse: (err: unknown) => void = () => {};
      const { user, dialog } = await askAndHang(
        () =>
          new Promise<void>((_, reject) => {
            refuse = reject;
          }),
      );
      await act(async () => {
        jest.advanceTimersByTime(STALL_MS);
      });
      await user.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

      await act(async () => refuse(new ProblemError(403, 'Forbidden')));
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('İşlem tamamlanamadı');
      expect(alert).toHaveTextContent('Bu işlem için yetkin yok.');
    });

    it('still says a late refusal when another question has opened meanwhile', async () => {
      let refuse: (err: unknown) => void = () => {};
      const { user, dialog } = await askAndHang(
        () =>
          new Promise<void>((_, reject) => {
            refuse = reject;
          }),
      );
      await act(async () => {
        jest.advanceTimersByTime(STALL_MS);
      });
      await user.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: 'Sil' }));
      const next = await screen.findByRole('alertdialog');

      await act(async () => refuse(new ProblemError(403, 'Forbidden')));
      // Not in the new question, which is about something else, but as an error toast
      expect(within(next).queryByRole('alert')).toBeNull();
      const said = await screen.findAllByText('İşlem tamamlanamadı');
      expect(said.some((node) => node.closest('[data-slot="toast-viewport"]'))).toBe(true);
    });

    it('starts the next question clean after a late success for a left one', async () => {
      let finish: () => void = () => {};
      const { user, dialog } = await askAndHang(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      await act(async () => {
        jest.advanceTimersByTime(STALL_MS);
      });
      await user.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      await act(async () => finish());

      await user.click(screen.getByRole('button', { name: 'Sil' }));
      const next = await screen.findByRole('alertdialog');
      expect(within(next).getByRole('button', { name: 'Oturumu sil' })).toBeEnabled();
      expect(within(next).getByRole('button', { name: 'Vazgeç' })).toBeEnabled();
      expect(within(next).queryByRole('status')).toBeNull();
    });
  });
});
