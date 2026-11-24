import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AttendeeImportDrawer } from '@/components/scheduling/roster/AttendeeImportDrawer';
import { ticketsApi, type ImportReport } from '@/lib/api/tickets';
import { ProblemError } from '@/lib/api/core';

jest.mock('@/lib/api/tickets', () => ({
  ticketsApi: { previewImport: jest.fn(), importAttendees: jest.fn() },
}));

const report = (imported: boolean): ImportReport => ({
  imported,
  columns: {
    header: true,
    delimiter: 'semicolon',
    firstName: 'Ad',
    lastName: 'Soyad',
    email: 'E-posta',
  },
  summary: {
    rows: 3,
    active: 1,
    waitlisted: 0,
    full: 0,
    existing: 1,
    duplicates: 0,
    invalid: 1,
    overCapacity: 0,
    members: 1,
    guests: 0,
    unknownSessions: 0,
  },
  capacity: { capacity: 0, active: 4, free: -1, waitlistEnabled: true },
  mail: 'queued',
  rows: [
    {
      line: 2,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      outcome: 'active',
      account: true,
    },
    {
      line: 3,
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      outcome: 'existing',
      account: false,
      ticketStatus: 'active',
    },
    {
      line: 4,
      firstName: 'Alan',
      lastName: '',
      email: 'alan@example.com',
      outcome: 'invalid',
      problem: 'missing_last_name',
      account: false,
    },
  ],
});

// jsdom has no PointerEvent; base-ui's Switch sends one on a click
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
  }
});

const LIST = 'Ad;Soyad;E-posta\nAda;Lovelace;ada@example.com';

describe('AttendeeImportDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ticketsApi.previewImport as jest.Mock).mockResolvedValue(report(false));
    (ticketsApi.importAttendees as jest.Mock).mockResolvedValue(report(true));
  });

  it('previews the pasted list, then imports it with the mail on', async () => {
    const user = userEvent.setup();
    const onImported = jest.fn();
    render(<AttendeeImportDrawer open onClose={jest.fn()} eventId="e1" onImported={onImported} />);
    expect(screen.getByRole('button', { name: 'Önizle' })).toBeDisabled();
    await user.click(screen.getByLabelText('Liste'));
    await user.paste(LIST);
    await user.click(screen.getByRole('button', { name: 'Önizle' }));
    await waitFor(() =>
      expect(ticketsApi.previewImport).toHaveBeenCalledWith('e1', {
        text: LIST,
        sendMail: true,
        pastCapacity: false,
      }),
    );
    expect(await screen.findByText('Önizleme')).toBeInTheDocument();
    expect(screen.getByTestId('import-report-top')).toHaveFocus();
    expect(screen.getByText('ada@example.com')).toHaveAttribute('title', 'ada@example.com');
    expect(screen.getByText('Bilet yazılacak')).toBeInTheDocument();
    expect(screen.getByText('Soyad yok')).toBeInTheDocument();
    expect(screen.getByText('Zaten kayıtlı')).toBeInTheDocument();
    expect(ticketsApi.importAttendees).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'İçe aktar (1)' }));
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(ticketsApi.importAttendees).toHaveBeenCalledWith('e1', {
      text: LIST,
      sendMail: true,
      pastCapacity: false,
    });
    expect(await screen.findByText('1 bilet yazıldı')).toBeInTheDocument();
    expect(screen.getByTestId('import-report-top')).toHaveFocus();
  });

  it('sends the mail off and past the capacity when asked', async () => {
    const user = userEvent.setup();
    render(
      <AttendeeImportDrawer
        open
        onClose={jest.fn()}
        eventId="e1"
        capacity={10}
        onImported={jest.fn()}
      />,
    );
    await user.click(screen.getByLabelText('Liste'));
    await user.paste(LIST);
    await user.click(screen.getByRole('switch', { name: /Bilet postası gönder/ }));
    await user.click(screen.getByRole('switch', { name: /Kontenjanı aşabilir/ }));
    await user.click(screen.getByRole('button', { name: 'Önizle' }));
    await waitFor(() =>
      expect(ticketsApi.previewImport).toHaveBeenCalledWith('e1', {
        text: LIST,
        sendMail: false,
        pastCapacity: true,
      }),
    );
  });

  it("says core's refusal and stays on the list", async () => {
    const user = userEvent.setup();
    (ticketsApi.previewImport as jest.Mock).mockRejectedValue(
      new ProblemError(400, 'Bad Request', { code: 'import_no_email_column' }),
    );
    render(<AttendeeImportDrawer open onClose={jest.fn()} eventId="e1" onImported={jest.fn()} />);
    await user.click(screen.getByLabelText('Liste'));
    await user.paste('Ad;Soyad\nAda;Lovelace');
    await user.click(screen.getByRole('button', { name: 'Önizle' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('e-posta sütunu');
    expect(screen.getByRole('button', { name: 'Önizle' })).toBeInTheDocument();
  });
});
