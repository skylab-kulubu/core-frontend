import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventParticipantsPage from '@/app/(authorized)/events/[id]/(workspace)/participants/page';
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
    await user.click(screen.getByRole('button', { name: 'Seçilenlere mail' }));

    await waitFor(() => expect(eventsApi.syncMailList).toHaveBeenCalledWith('e1', ['t-guest']));
    expect(open).toHaveBeenCalledWith(
      'https://mail.yildizskylab.com/mail-tasks/create?mail_list_id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '_blank',
      'noopener,noreferrer',
    );
    open.mockRestore();
  });

  it('lets a GECEKODU member see the roster but not apply-for-other', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU']);
    await renderParticipants();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Başvuranlar' })).toBeInTheDocument(),
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
    expect(screen.queryByRole('heading', { name: 'Başvuranlar' })).not.toBeInTheDocument();
    expect(ticketsApi.listByEvent).not.toHaveBeenCalled();
  });
});
