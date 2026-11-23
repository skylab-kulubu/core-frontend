import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventProgramPage from '@/app/(authorized)/events/[id]/(workspace)/program/page';
import { ProblemError } from '@/lib/api/core';
import { eventDaysApi } from '@/lib/api/eventDays';
import { sessionsApi } from '@/lib/api/sessions';
import { ticketsApi } from '@/lib/api/tickets';
import {
  guestTicket,
  primeEventWorkspace,
  renderEventTab,
  signInAs,
  workspaceSession,
} from '@/test/event-workspace';

jest.mock('next/navigation', () => jest.requireActual('@/test/event-workspace').navigationModule);
jest.mock('@/context/AuthContext', () => jest.requireActual('@/test/event-workspace').authModule);
jest.mock('@/lib/api/events', () => jest.requireActual('@/test/event-workspace').eventsModule);
jest.mock(
  '@/lib/api/eventDays',
  () => jest.requireActual('@/test/event-workspace').eventDaysModule,
);
jest.mock('@/lib/api/sessions', () =>
  jest.requireActual('@/test/event-workspace').sessionsModule(),
);
jest.mock('@/lib/api/tickets', () => jest.requireActual('@/test/event-workspace').ticketsModule);
jest.mock('@/lib/api/identity', () => jest.requireActual('@/test/event-workspace').identityModule);
jest.mock(
  '@/lib/api/competitors',
  () => jest.requireActual('@/test/event-workspace').competitorsModule,
);
jest.mock('@/lib/api/teams', () => jest.requireActual('@/test/event-workspace').teamsModule);
jest.mock('@/lib/api/seasons', () => jest.requireActual('@/test/event-workspace').seasonsModule);
jest.mock('@/lib/scheduling/save-event', () =>
  jest.requireActual('@/test/event-workspace').saveEventModule(),
);

const renderProgram = () => renderEventTab(<EventProgramPage />, '/events/e1/program');

/** Opens the session's "⋯" menu and presses one of its items. */
async function sessionAction(user: ReturnType<typeof userEvent.setup>, name: string) {
  const menus = await screen.findAllByRole('button', { name: /: eylemler$/ });
  await user.click(menus[menus.length - 1]);
  await user.click(await screen.findByRole('menuitem', { name }));
}

describe('Event Program tab Katıldı', () => {
  beforeEach(primeEventWorkspace);

  it('hides Katıldı for a GECEKODU member who can still write the event', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU']);
    await renderProgram();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'GeceKodu' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: 'Düzenle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Oturum ekle' })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Açılış: eylemler' }));
    expect(await screen.findByRole('menuitem', { name: 'Oturumu düzenle' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Katıldı' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Kapıyı aç' })).not.toBeInTheDocument();
  });

  it('shows Katıldı for the owner-team Leader', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    await renderProgram();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Açılış: eylemler' }));
    expect(await screen.findByRole('menuitem', { name: 'Katıldı' })).toBeInTheDocument();
  });

  it('shows Katıldı for assigned door staff without exposing the roster', async () => {
    signInAs(['/UYELER/ARGE/WEBLAB']);
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([
      { id: 'e1', name: 'GeceKodu', ownerTeam: 'GECEKODU' },
    ]);

    await renderProgram();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Açılış: eylemler' }));
    expect(await screen.findByRole('menuitem', { name: 'Katıldı' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Katılımcılar' })).not.toBeInTheDocument();
    expect(ticketsApi.listByEvent).not.toHaveBeenCalled();
  });

  it('accepts a typed name in the Katıldı person field', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([guestTicket]);
    (ticketsApi.resolveAndCheckIn as jest.Mock).mockResolvedValue({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      sessionId: 's1',
      eventDayId: 'd1',
      personName: 'Ada Lovelace',
      createdAt: new Date(2026, 8, 19, 9, 4, 0).toISOString(),
    });
    await renderProgram();
    await sessionAction(user, 'Katıldı');
    const dialog = await screen.findByRole('dialog', { name: 'Açılış · Katıldı' });
    expect(within(dialog).getByRole('button', { name: 'Katılımcı bul' })).toBeInTheDocument();
    const field = within(dialog).getByLabelText('Ad, e-posta ya da bilet kodu') as HTMLInputElement;
    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveAttribute('placeholder', 'Ad, e-posta ya da bilet kodu');
    await user.type(field, 'Ada Lovelace');
    expect(field.checkValidity()).toBe(true);
    await user.click(within(dialog).getByRole('button', { name: 'Katıldı' }));
    await waitFor(() =>
      expect(ticketsApi.resolveAndCheckIn).toHaveBeenCalledWith('s1', {
        personId: undefined,
        query: 'Ada Lovelace',
      }),
    );
    // A toast: the drawer closes and the Program list may sit far below the tabs
    expect(await screen.findByText(/^Ada Lovelace · Açılış · /)).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Check-in sonucu' })).not.toBeInTheDocument();
  });
});

describe('Event Program tab days and sessions', () => {
  beforeEach(primeEventWorkspace);

  it('rejects a whitespace-only day name before calling the API', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    await renderProgram();
    await user.click(await screen.findByRole('button', { name: 'Gün ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Gün ekle' });
    await user.type(within(dialog).getByLabelText('Gün adı'), '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(eventDaysApi.create).not.toHaveBeenCalled();
    expect(within(dialog).getByText('Gün adı zorunlu')).toBeInTheDocument();
  });

  it('rejects a whitespace-only session title before calling the API', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    await renderProgram();
    await user.click(await screen.findByRole('button', { name: 'Oturum ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Oturum ekle' });
    await user.type(within(dialog).getByLabelText('Başlık'), '   ');
    await user.type(within(dialog).getByLabelText('Konuşmacı'), 'Ada');
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(sessionsApi.create).not.toHaveBeenCalled();
    expect(within(dialog).getByText('Başlık zorunlu')).toBeInTheDocument();
  });

  it('says the day was added once the drawer closes', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    (eventDaysApi.create as jest.Mock).mockResolvedValue({ id: 'd2' });
    await renderProgram();
    await user.click(await screen.findByRole('button', { name: 'Gün ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Gün ekle' });
    await user.type(within(dialog).getByLabelText('Gün adı'), 'Gün 2');
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByText('Gün eklendi')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Gün ekle' })).not.toBeInTheDocument(),
    );
  });

  it('shows a session save error inside the open drawer, not behind it', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    (sessionsApi.create as jest.Mock).mockRejectedValue(
      new ProblemError(422, 'Unprocessable Content', {
        detail: 'session start is outside its day',
      }),
    );
    await renderProgram();
    await user.click(await screen.findByRole('button', { name: 'Oturum ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Oturum ekle' });
    await user.type(within(dialog).getByLabelText('Başlık'), 'Hatalı');
    await user.type(within(dialog).getByLabelText('Konuşmacı'), 'Kişi');
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Gönderilen bilgiler geçersiz.',
    );
    expect(dialog).not.toHaveTextContent('outside its day');
    expect(screen.queryByText('Oturum eklendi')).not.toBeInTheDocument();
  });

  it('says the session was saved and deleted', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    (sessionsApi.update as jest.Mock).mockResolvedValue({});
    (sessionsApi.delete as jest.Mock).mockResolvedValue(undefined);
    await renderProgram();
    await sessionAction(user, 'Oturumu düzenle');
    let dialog = await screen.findByRole('dialog', { name: 'Oturumu düzenle' });
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByText('Oturum kaydedildi')).toBeInTheDocument();

    await sessionAction(user, 'Oturumu düzenle');
    dialog = await screen.findByRole('dialog', { name: 'Oturumu düzenle' });
    await user.click(within(dialog).getByRole('button', { name: 'Sil' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: '"Açılış" oturumu silinsin mi?',
    });
    await user.click(within(confirm).getByRole('button', { name: 'Oturumu sil' }));
    expect(await screen.findByText('Oturum silindi')).toBeInTheDocument();
  });

  it('keeps the session drawer and its question open until the program is read again', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    (sessionsApi.delete as jest.Mock).mockResolvedValue(undefined);
    await renderProgram();
    await sessionAction(user, 'Oturumu düzenle');
    const drawer = await screen.findByRole('dialog', { name: 'Oturumu düzenle' });
    await user.click(within(drawer).getByRole('button', { name: 'Sil' }));

    let reread: (days: unknown[]) => void = () => {};
    (eventDaysApi.listByEvent as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        reread = resolve;
      }),
    );
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Oturumu sil' }));
    await waitFor(() => expect(sessionsApi.delete).toHaveBeenCalledWith('s1'));
    expect(await screen.findByText('Oturum silindi')).toBeInTheDocument();
    // The program has not been read again yet: both stay
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: 'Oturumu düzenle', hidden: true }),
    ).toBeInTheDocument();

    reread([]);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Oturumu düzenle' })).not.toBeInTheDocument(),
    );
    // The deleted session's row is gone, so focus lands on the toolbar's add button
    await waitFor(() => expect(screen.getByRole('button', { name: 'Oturum ekle' })).toHaveFocus());
  });

  it('asks before deleting a day and does nothing on Vazgeç', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    await renderProgram();
    await user.click(await screen.findByRole('button', { name: 'Günü sil' }));
    const confirm = await screen.findByRole('alertdialog', { name: '"Gün 1" günü silinsin mi?' });
    await waitFor(() =>
      expect(within(confirm).getByRole('button', { name: 'Vazgeç' })).toHaveFocus(),
    );
    await user.click(within(confirm).getByRole('button', { name: 'Vazgeç' }));
    expect(eventDaysApi.delete).not.toHaveBeenCalled();
  });

  it('deletes a day after confirming and brings it back with Geri al', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    (eventDaysApi.delete as jest.Mock).mockResolvedValue(undefined);
    (eventDaysApi.restore as jest.Mock).mockResolvedValue({ id: 'd1' });
    await renderProgram();
    await user.click(await screen.findByRole('button', { name: 'Günü sil' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Günü sil' }));
    await waitFor(() => expect(eventDaysApi.delete).toHaveBeenCalledWith('d1'));
    expect(await screen.findByText('Gün silindi')).toBeInTheDocument();
    await waitFor(() => expect(eventDaysApi.listByEvent).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole('button', { name: 'Geri al' }));
    await waitFor(() => expect(eventDaysApi.restore).toHaveBeenCalledWith('d1'));
    expect(await screen.findByText('Gün geri alındı')).toBeInTheDocument();
    // The program is read again, so the restored day shows without a page reload
    await waitFor(() => expect(eventDaysApi.listByEvent).toHaveBeenCalledTimes(3));
  });

  it('brings a deleted session back with Geri al', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    (sessionsApi.delete as jest.Mock).mockResolvedValue(undefined);
    (sessionsApi.restore as jest.Mock).mockResolvedValue({});
    await renderProgram();
    await sessionAction(user, 'Oturumu düzenle');
    const dialog = await screen.findByRole('dialog', { name: 'Oturumu düzenle' });
    await user.click(within(dialog).getByRole('button', { name: 'Sil' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Oturumu sil' }),
    );
    await waitFor(() => expect(eventDaysApi.listSessions).toHaveBeenCalledTimes(2));
    await user.click(await screen.findByRole('button', { name: 'Geri al' }));
    await waitFor(() => expect(sessionsApi.restore).toHaveBeenCalledWith('s1'));
    expect(await screen.findByText('Oturum geri alındı')).toBeInTheDocument();
    await waitFor(() => expect(eventDaysApi.listSessions).toHaveBeenCalledTimes(3));
  });

  it('shows a check-in error inside the Katıldı drawer', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    (ticketsApi.resolveAndCheckIn as jest.Mock).mockRejectedValue(
      new ProblemError(404, 'Not Found', { detail: 'no ticket for person' }),
    );
    await renderProgram();
    await sessionAction(user, 'Katıldı');
    const dialog = await screen.findByRole('dialog', { name: 'Açılış · Katıldı' });
    await user.type(within(dialog).getByLabelText('Ad, e-posta ya da bilet kodu'), 'Yok Kişi');
    await user.click(within(dialog).getByRole('button', { name: 'Katıldı' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Kayıt bulunamadı; silinmiş olabilir.',
    );
  });

  it('says the person is already in when core refuses a second check-in', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    (ticketsApi.resolveAndCheckIn as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { detail: 'Conflict' }),
    );
    await renderProgram();
    await sessionAction(user, 'Katıldı');
    const dialog = await screen.findByRole('dialog', { name: 'Açılış · Katıldı' });
    await user.type(within(dialog).getByLabelText('Ad, e-posta ya da bilet kodu'), 'Ada Lovelace');
    await user.click(within(dialog).getByRole('button', { name: 'Katıldı' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Bu kişi bu oturuma zaten girmiş.',
    );
  });
});

describe('Event Program tab timeline', () => {
  beforeEach(primeEventWorkspace);

  it('shows each session with its hours, marks the one running now, and opens the door', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    const hour = 3600_000;
    const iso = (offset: number) => new Date(Date.now() + offset).toISOString();
    (eventDaysApi.listSessions as jest.Mock).mockResolvedValue([
      {
        ...workspaceSession,
        id: 's2',
        title: 'Panel',
        startTime: iso(2 * hour),
        endTime: iso(3 * hour),
      },
      { ...workspaceSession, startTime: iso(-hour), endTime: iso(hour) },
    ]);
    await renderProgram();
    const list = await screen.findByRole('list', { name: /oturumları$/ });
    const rows = within(list).getAllByRole('listitem');
    // By start time, whatever order core gave
    expect(rows[0]).toHaveTextContent('Açılış');
    expect(rows[0]).toHaveTextContent(/\d{2}:\d{2}–\d{2}:\d{2}/);
    expect(within(rows[0]).getByText('Şimdi')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Sıradaki')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('link', { name: 'Kapıyı aç' })).toHaveAttribute(
      'href',
      '/events/e1/door',
    );
  });
});
