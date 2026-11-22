import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventParticipantsPage from '@/app/(authorized)/events/[id]/(workspace)/participants/page';
import { ProblemError } from '@/lib/api/core';
import { eventsApi } from '@/lib/api/events';
import { ticketsApi } from '@/lib/api/tickets';
import { guestTicket, primeEventWorkspace, renderEventTab, signInAs } from '@/test/event-workspace';

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

const renderParticipants = () =>
  renderEventTab(<EventParticipantsPage />, '/events/e1/participants');

describe('Event Katılımcılar tab', () => {
  beforeEach(primeEventWorkspace);

  it('opens Skymail with only the selected applicants', async () => {
    const user = userEvent.setup();
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([guestTicket]);
    (eventsApi.syncMailList as jest.Mock).mockResolvedValue({
      mailListId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      recipientCount: 1,
    });

    await renderParticipants();
    await user.click(await screen.findByRole('checkbox', { name: 'Ada Lovelace seç' }));
    await user.click(screen.getByRole('button', { name: 'Mail' }));

    await waitFor(() => expect(eventsApi.syncMailList).toHaveBeenCalledWith('e1', ['t-guest']));
    expect(open).toHaveBeenCalledWith(
      'https://iletisim.yildizskylab.com/mail-tasks/create?mail_list_id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '_blank',
      'noopener,noreferrer',
    );
    open.mockRestore();
  });

  it('lets a GECEKODU member see the roster but not apply-for-other', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU']);
    await renderParticipants();
    await waitFor(() =>
      expect(screen.getByRole('searchbox', { name: 'Katılımcı ara' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Katılımcı ekle' })).not.toBeInTheDocument();
  });

  it.each([
    {
      name: 'Privileged',
      groups: ['/UYELER/YK'],
    },
    {
      name: 'owner-team Leader',
      groups: ['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER'],
    },
  ])('shows Katılımcı ekle for $name', async ({ groups }) => {
    signInAs(groups);
    await renderParticipants();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Katılımcı ekle' })).toBeInTheDocument(),
    );
  });

  it('keeps the roster from door staff who open the tab by its address', async () => {
    signInAs(['/UYELER/ARGE/WEBLAB']);
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([
      { id: 'e1', name: 'GeceKodu', ownerTeam: 'GECEKODU' },
    ]);
    await renderParticipants();
    expect(await screen.findByText('Katılımcıları görme yetkin yok')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: 'Katılımcı ara' })).not.toBeInTheDocument();
    expect(ticketsApi.listByEvent).not.toHaveBeenCalled();
  });

  it('says a row check-in in a toast, not in a line above the roster', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([guestTicket]);
    (ticketsApi.checkIn as jest.Mock).mockResolvedValue({
      id: 'ci-1',
      sessionId: 's1',
      eventDayId: 'd1',
      createdAt: new Date(2026, 8, 19, 9, 4, 0).toISOString(),
    });

    await renderParticipants();
    await user.click((await screen.findAllByRole('button', { name: 'Ada Lovelace: katıldı' }))[0]);

    await waitFor(() => expect(ticketsApi.checkIn).toHaveBeenCalledWith('t-guest', 's1'));
    expect(await screen.findByText(/^Ada Lovelace · Açılış · /)).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Check-in sonucu' })).not.toBeInTheDocument();
  });

  it('says the person is already in when core refuses a second row check-in', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([guestTicket]);
    (ticketsApi.checkIn as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { detail: 'Conflict' }),
    );

    await renderParticipants();
    await user.click((await screen.findAllByRole('button', { name: 'Ada Lovelace: katıldı' }))[0]);

    const said = await screen.findByText('Bu kişi bu oturuma zaten girmiş.');
    expect(said).toHaveAttribute('role', 'alert');
  });

  describe('Bileti yeniden gönder, Bağlantıyı yenile', () => {
    const coded = { ...guestTicket, code: 'K7M2-QX9F' };

    async function openMenu(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole('button', { name: 'Ada Lovelace: eylemler' }));
    }

    it('shows the code and sends the Ticket again with a key once asked', async () => {
      const user = userEvent.setup();
      signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
      (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([coded]);
      (ticketsApi.resend as jest.Mock).mockResolvedValue({
        resend: 1,
        replayed: false,
        queued: true,
      });

      await renderParticipants();
      expect((await screen.findAllByText('K7M2-QX9F')).length).toBeGreaterThan(0);
      await openMenu(user);
      await user.click(await screen.findByRole('menuitem', { name: 'Bileti yeniden gönder' }));
      const dialog = await screen.findByRole('alertdialog', {
        name: 'Ada Lovelace: bilet yeniden gönderilsin mi?',
      });
      expect(ticketsApi.resend).not.toHaveBeenCalled();
      await user.click(within(dialog).getByRole('button', { name: 'Bileti gönder' }));

      await waitFor(() =>
        expect(ticketsApi.resend).toHaveBeenCalledWith('t-guest', expect.any(String)),
      );
      expect(await screen.findByText('Bilet yeniden gönderildi')).toBeInTheDocument();
    });

    it('says why core refused the resend', async () => {
      const user = userEvent.setup();
      signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
      (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([coded]);
      (ticketsApi.resend as jest.Mock).mockRejectedValue(
        new ProblemError(409, 'Conflict', { code: 'ticket_notification_off' }),
      );

      await renderParticipants();
      await openMenu(user);
      await user.click(await screen.findByRole('menuitem', { name: 'Bileti yeniden gönder' }));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Bileti gönder' }));
      expect(
        await within(dialog).findByText('Bilet postası kapalı; bilet gönderilemiyor.'),
      ).toBeInTheDocument();
    });

    it('asks once before renewing the link, and says a refusal in the dialog', async () => {
      const user = userEvent.setup();
      signInAs(['/UYELER/YK']);
      (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([coded]);
      (ticketsApi.renewLink as jest.Mock)
        .mockRejectedValueOnce(
          new ProblemError(503, 'Service Unavailable', { code: 'audit_unavailable' }),
        )
        .mockResolvedValueOnce({ ...coded, notificationQueued: true, resend: 2 });

      await renderParticipants();
      await openMenu(user);
      await user.click(await screen.findByRole('menuitem', { name: 'Bağlantıyı yenile' }));
      const dialog = await screen.findByRole('alertdialog', {
        name: 'Ada Lovelace: bağlantı yenilensin mi?',
      });
      expect(
        within(dialog).getByText('Eski bağlantı ve QR çalışmaz; yenisi postayla gider.'),
      ).toBeInTheDocument();
      expect(ticketsApi.renewLink).not.toHaveBeenCalled();

      await user.click(within(dialog).getByRole('button', { name: 'Bağlantıyı yenile' }));
      expect(
        await within(dialog).findByText(
          'İşlem kaydı açılamadı; hiçbir şey gönderilmedi. Biraz sonra tekrar dene.',
        ),
      ).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Bağlantıyı yenile' }));
      await waitFor(() => expect(ticketsApi.renewLink).toHaveBeenCalledTimes(2));
      const [first, second] = (ticketsApi.renewLink as jest.Mock).mock.calls;
      // The same question renews once: a retry sends its key again
      expect(second).toEqual(first);
      expect(await screen.findByText('Bağlantı yenilendi, bilet gönderildi')).toBeInTheDocument();
    });

    it.each([
      { name: 'DK', groups: ['/UYELER/DK'] },
      { name: 'a team member', groups: ['/UYELER/ORGANIZASYON/GECEKODU'] },
    ])('offers no row menu to $name', async ({ groups }) => {
      signInAs(groups);
      (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([coded]);
      await renderParticipants();
      await waitFor(() =>
        expect(screen.getByRole('searchbox', { name: 'Katılımcı ara' })).toBeInTheDocument(),
      );
      expect(
        screen.queryByRole('button', { name: 'Ada Lovelace: eylemler' }),
      ).not.toBeInTheDocument();
    });
  });

  it('opens a registration beside the list, its fields in groups and its address kept', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([
      { ...guestTicket, code: 'K7M2-QX9F' },
    ]);
    await renderParticipants();
    await user.click(await screen.findByRole('link', { name: 'Ada Lovelace' }));
    const panel = await screen.findByRole('dialog', { name: 'Ada Lovelace' });
    expect(within(panel).getByRole('region', { name: 'Kişi' })).toBeInTheDocument();
    expect(within(panel).getByRole('region', { name: 'Bilet' })).toHaveTextContent('K7M2-QX9F');
    expect(window.location.search).toBe('?kayit=t-guest');
    expect(
      within(panel).getByRole('button', { name: 'Bileti yeniden gönder' }),
    ).toBeInTheDocument();
    window.history.replaceState(null, '', '/');
  });

  it('says the registrations could not be read instead of an empty list, and retries', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    (ticketsApi.listByEvent as jest.Mock)
      .mockRejectedValueOnce(new ProblemError(503, 'Service Unavailable'))
      .mockResolvedValue([guestTicket]);
    await renderParticipants();
    expect(await screen.findByText('Kayıtlar yüklenemedi')).toBeInTheDocument();
    expect(screen.queryByText('Henüz başvuru yok.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yeniden dene' }));
    expect(await screen.findByRole('link', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.queryByText('Kayıtlar yüklenemedi')).not.toBeInTheDocument();
  });
});
