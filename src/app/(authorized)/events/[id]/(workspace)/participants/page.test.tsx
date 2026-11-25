import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventParticipantsPage from '@/app/(authorized)/events/[id]/(workspace)/participants/page';
import { ProblemError } from '@/lib/api/core';
import { eventsApi } from '@/lib/api/events';
import { ticketsApi } from '@/lib/api/tickets';
import {
  guestTicket,
  primeEventWorkspace,
  renderEventTab,
  signInAs,
  workspaceEvent,
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
jest.mock('@/lib/api/form-respondents', () => {
  const { ProblemError } = jest.requireActual('@/lib/api/core');
  // A core without form respondents: no respondent view
  return {
    formRespondentsApi: {
      list: jest.fn(() => Promise.reject(new ProblemError(404, 'Not Found'))),
    },
  };
});
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

// jsdom has no PointerEvent; base-ui's Checkbox sends one to its hidden input on a click
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
  }
});

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
    await user.click(screen.getByRole('button', { name: 'E-posta' }));

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
    expect(screen.queryByRole('status', { name: 'Giriş sonucu' })).not.toBeInTheDocument();
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
        within(dialog).getByText('Eski bağlantı ve QR çalışmaz; yenisi e-postayla gider.'),
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

    it('offers no row menu to DK', async () => {
      signInAs(['/UYELER/DK']);
      (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([coded]);
      await renderParticipants();
      await waitFor(() =>
        expect(screen.getByRole('searchbox', { name: 'Katılımcı ara' })).toBeInTheDocument(),
      );
      expect(
        screen.queryByRole('button', { name: 'Ada Lovelace: eylemler' }),
      ).not.toBeInTheDocument();
    });

    it('offers a GECEKODU member, who edits its events, the cancel alone', async () => {
      const user = userEvent.setup();
      signInAs(['/UYELER/ORGANIZASYON/GECEKODU']);
      (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([coded]);
      await renderParticipants();
      await openMenu(user);
      expect(await screen.findByRole('menuitem', { name: 'Bileti iptal et' })).toBeInTheDocument();
      expect(
        screen.queryByRole('menuitem', { name: 'Bileti yeniden gönder' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Bağlantıyı yenile' })).not.toBeInTheDocument();
    });
  });

  describe('Bileti iptal et, Geri al', () => {
    const coded = { ...guestTicket, code: 'K7M2-QX9F', status: 'active' as const };
    const cancelledTicket = {
      ...guestTicket,
      id: 't-gone',
      guestFirstName: 'Grace',
      guestLastName: 'Hopper',
      guestEmail: 'grace@example.com',
      status: 'cancelled' as const,
      cancelledAt: '2026-11-24T10:05:00.000Z',
      cancelledBy: 'operator',
      cancelReason: 'Yanlış kayıt',
    };

    /** core's two lists: the active tickets by default, the cancelled ones with `?status=`. */
    function lists(active: unknown[], cancelled: unknown[]) {
      (ticketsApi.listByEvent as jest.Mock).mockImplementation(
        async (_event: string, status?: string) => (status === 'cancelled' ? cancelled : active),
      );
    }

    it('cancels a ticket with its reason once asked, and reads both lists again', async () => {
      const user = userEvent.setup();
      signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
      lists([coded], []);
      (ticketsApi.cancel as jest.Mock).mockResolvedValue({ ...coded, status: 'cancelled' });

      await renderParticipants();
      await user.click(await screen.findByRole('button', { name: 'Ada Lovelace: eylemler' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Bileti iptal et' }));
      const dialog = await screen.findByRole('alertdialog', {
        name: 'Ada Lovelace: bilet iptal edilsin mi?',
      });
      await user.type(within(dialog).getByLabelText('Gerekçe (isteğe bağlı)'), ' Yanlış kayıt ');
      expect(ticketsApi.cancel).not.toHaveBeenCalled();
      const reads = (ticketsApi.listByEvent as jest.Mock).mock.calls.length;
      await user.click(within(dialog).getByRole('button', { name: 'Bileti iptal et' }));

      await waitFor(() =>
        expect(ticketsApi.cancel).toHaveBeenCalledWith('t-guest', {
          reason: 'Yanlış kayıt',
          notify: true,
        }),
      );
      expect(await screen.findByText('Bilet iptal edildi')).toBeInTheDocument();
      await waitFor(() =>
        expect((ticketsApi.listByEvent as jest.Mock).mock.calls.length).toBeGreaterThan(reads),
      );
      expect(ticketsApi.listByEvent).toHaveBeenCalledWith('e1', 'cancelled');
    });

    it('sends no reason when none is written', async () => {
      const user = userEvent.setup();
      signInAs(['/UYELER/YK']);
      lists([coded], []);
      (ticketsApi.cancel as jest.Mock).mockResolvedValue({ ...coded, status: 'cancelled' });
      await renderParticipants();
      await user.click(await screen.findByRole('button', { name: 'Ada Lovelace: eylemler' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Bileti iptal et' }));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Bileti iptal et' }));
      await waitFor(() =>
        expect(ticketsApi.cancel).toHaveBeenCalledWith('t-guest', {
          reason: undefined,
          notify: true,
        }),
      );
    });

    it('tells the holder unless Kişiye bildir is cleared', async () => {
      const user = userEvent.setup();
      signInAs(['/UYELER/YK']);
      lists([coded], []);
      (ticketsApi.cancel as jest.Mock).mockResolvedValue({ ...coded, status: 'cancelled' });
      await renderParticipants();
      await user.click(await screen.findByRole('button', { name: 'Ada Lovelace: eylemler' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Bileti iptal et' }));
      const dialog = await screen.findByRole('alertdialog');
      const box = within(dialog).getByRole('checkbox', { name: 'Kişiye bildir' });
      expect(box).toBeChecked();
      await user.click(box);
      await user.click(within(dialog).getByRole('button', { name: 'Bileti iptal et' }));
      await waitFor(() =>
        expect(ticketsApi.cancel).toHaveBeenCalledWith('t-guest', {
          reason: undefined,
          notify: false,
        }),
      );
    });

    it.each([
      ['event_ended', 'Etkinlik bitmiş; bilet iptal edilemez.'],
      ['ticket_checked_in', 'Girişi olan bilet iptal edilemez; önce girişi geri al.'],
      ['ticket_in_competition', 'Kişi yarışmada; önce yarışmadan çıkar.'],
    ])('says core’s 409 %s in the dialog', async (code, text) => {
      const user = userEvent.setup();
      signInAs(['/UYELER/YK']);
      lists([coded], []);
      (ticketsApi.cancel as jest.Mock).mockRejectedValue(
        new ProblemError(409, 'Conflict', { code }),
      );
      await renderParticipants();
      await user.click(await screen.findByRole('button', { name: 'Ada Lovelace: eylemler' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Bileti iptal et' }));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Bileti iptal et' }));
      expect(await within(dialog).findByText(text)).toBeInTheDocument();
    });

    it('says a 403 as no right to cancel', async () => {
      const user = userEvent.setup();
      signInAs(['/UYELER/YK']);
      lists([coded], []);
      (ticketsApi.cancel as jest.Mock).mockRejectedValue(new ProblemError(403, 'Forbidden'));
      await renderParticipants();
      await user.click(await screen.findByRole('button', { name: 'Ada Lovelace: eylemler' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Bileti iptal et' }));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Bileti iptal et' }));
      expect(
        await within(dialog).findByText('Bu bileti iptal etme yetkin yok.'),
      ).toBeInTheDocument();
    });

    it('keeps the cancel of a ticket with an entry shut, saying why', async () => {
      const user = userEvent.setup();
      signInAs(['/UYELER/YK']);
      lists(
        [
          {
            ...coded,
            checkIns: [
              { id: 'c1', ticketId: 't-guest', sessionId: 's1', createdAt: '2026-09-19T09:00:00Z' },
            ],
          },
        ],
        [],
      );
      await renderParticipants();
      await user.click(await screen.findByRole('button', { name: 'Ada Lovelace: eylemler' }));
      const item = await screen.findByRole('menuitem', { name: /Bileti iptal et/ });
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toHaveTextContent('Önce girişi geri al');
    });

    it('lists the cancelled tickets apart, with the reason, and takes one back', async () => {
      const user = userEvent.setup();
      signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
      lists([coded], [cancelledTicket]);
      (ticketsApi.restore as jest.Mock).mockResolvedValue({ ...cancelledTicket, status: 'active' });

      await renderParticipants();
      expect(await screen.findByRole('link', { name: 'Ada Lovelace' })).toBeInTheDocument();
      // The active tickets by default
      expect(screen.queryByRole('link', { name: 'Grace Hopper' })).not.toBeInTheDocument();
      await user.click(await screen.findByRole('button', { name: /İptal edilenler/ }));

      expect(await screen.findByRole('link', { name: 'Grace Hopper' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Ada Lovelace' })).not.toBeInTheDocument();
      expect(screen.getByText('Gerekçe: Yanlış kayıt')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'E-posta' })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Grace Hopper seç' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Grace Hopper: iptali geri al' }));
      const dialog = await screen.findByRole('alertdialog', {
        name: 'Grace Hopper: iptal geri alınsın mı?',
      });
      expect(
        within(dialog).getByText('Kişiye yeni bağlantı ve QR’lı bilet postası gider.'),
      ).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Geri al' }));
      await waitFor(() => expect(ticketsApi.restore).toHaveBeenCalledWith('t-gone'));
      expect(await screen.findByText('Bilet yeniden etkin')).toBeInTheDocument();
    });

    it('shuts cancel and Geri al once the event is over, saying so', async () => {
      const user = userEvent.setup();
      signInAs(['/UYELER/YK']);
      (eventsApi.get as jest.Mock).mockResolvedValue({
        ...workspaceEvent,
        startDate: '2026-01-10T09:00:00+03:00',
        endDate: '2026-01-10T18:00:00+03:00',
      });
      lists([coded], [cancelledTicket]);
      await renderParticipants();

      await user.click(await screen.findByRole('button', { name: 'Ada Lovelace: eylemler' }));
      const item = await screen.findByRole('menuitem', { name: /Bileti iptal et/ });
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toHaveTextContent('Etkinlik bitti');
      await user.keyboard('{Escape}');

      await user.click(await screen.findByRole('button', { name: /İptal edilenler/ }));
      const restore = await screen.findByRole('button', { name: 'Grace Hopper: iptali geri al' });
      expect(restore).toBeDisabled();
      expect(restore).toHaveAttribute('title', 'Etkinlik bitti');
      expect(ticketsApi.cancel).not.toHaveBeenCalled();
      expect(ticketsApi.restore).not.toHaveBeenCalled();
    });

    it('offers no Geri al to who may not edit the event', async () => {
      const user = userEvent.setup();
      signInAs(['/UYELER/DK']);
      lists([coded], [cancelledTicket]);
      await renderParticipants();
      await user.click(await screen.findByRole('button', { name: /İptal edilenler/ }));
      expect(await screen.findByRole('link', { name: 'Grace Hopper' })).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Grace Hopper: iptali geri al' }),
      ).not.toBeInTheDocument();
    });

    it('shows no cancelled ticket when core does not know the status yet', async () => {
      signInAs(['/UYELER/YK']);
      // An older core ignores `?status=` and answers every ticket, none of them with a status
      (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([guestTicket]);
      await renderParticipants();
      expect(await screen.findByRole('link', { name: 'Ada Lovelace' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /İptal edilenler/ })).not.toBeInTheDocument();
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
    // The first read of the active tickets fails; the tab's cancelled read may come first
    let failed = false;
    (ticketsApi.listByEvent as jest.Mock).mockImplementation(async (_event, status?: string) => {
      if (status) return [];
      if (!failed) {
        failed = true;
        throw new ProblemError(503, 'Service Unavailable');
      }
      return [guestTicket];
    });
    await renderParticipants();
    expect(await screen.findByText('Kayıtlar yüklenemedi')).toBeInTheDocument();
    expect(screen.queryByText('Henüz başvuru yok.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yeniden dene' }));
    expect(await screen.findByRole('link', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.queryByText('Kayıtlar yüklenemedi')).not.toBeInTheDocument();
  });

  it('opens the registration a link names while the page is already open', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    (ticketsApi.listByEvent as jest.Mock).mockResolvedValue([guestTicket]);
    const view = await renderParticipants();
    expect(await screen.findByRole('link', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Ada Lovelace' })).not.toBeInTheDocument();
    window.history.pushState(null, '', '/events/e1/participants?kayit=t-guest');
    await view.openTab(<EventParticipantsPage />, '/events/e1/participants');
    expect(await screen.findByRole('dialog', { name: 'Ada Lovelace' })).toBeInTheDocument();
    window.history.replaceState(null, '', '/');
  });
});
