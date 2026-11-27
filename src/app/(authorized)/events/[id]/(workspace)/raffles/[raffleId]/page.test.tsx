import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventRafflePage from '@/app/(authorized)/events/[id]/(workspace)/raffles/[raffleId]/page';
import { ProblemError } from '@/lib/api/core';
import { DEFAULT_RAFFLE_CRITERIA, rafflesApi, type Raffle } from '@/lib/api/raffles';
import { primeEventWorkspace, renderEventTab, signInAs } from '@/test/event-workspace';

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
jest.mock('@/lib/api/raffles', () => ({
  ...jest.requireActual('@/lib/api/raffles'),
  rafflesApi: {
    preview: jest.fn(),
    draw: jest.fn(),
    list: jest.fn(),
    get: jest.fn(),
    forfeit: jest.fn(),
    verification: jest.fn(),
  },
}));
jest.mock('@/lib/raffle/verify', () => ({
  ...jest.requireActual('@/lib/raffle/verify'),
  verifyRaffle: jest.fn(),
}));

const { verifyRaffle } = jest.requireMock('@/lib/raffle/verify') as { verifyRaffle: jest.Mock };

const entry = (position: number, status: 'winner' | 'alternate', name: string) => ({
  position,
  status,
  ticketId: `t${position}`,
  name,
  maskedEmail: `${name[0].toLowerCase()}***@o***.com`,
  ticketType: 'REGISTERED' as const,
  promotedAt: null,
  forfeitedAt: null,
  forfeitReason: null,
  forfeitedBy: null,
});

const raffle: Raffle = {
  id: 'r1',
  eventId: 'e1',
  title: 'Kapanış çekilişi',
  drawnAt: '2026-11-27T14:05:00Z',
  drawnBy: { id: 'u1', name: 'Deniz Kaya' },
  eligibleCount: 312,
  winnerCount: 2,
  alternateCount: 1,
  criteria: DEFAULT_RAFFLE_CRITERIA,
  listHash: 'a'.repeat(64),
  seed: 'b'.repeat(64),
  algorithm: 'sky-raffle-v1',
  entries: [
    entry(1, 'winner', 'Ece Tan'),
    entry(2, 'winner', 'Can Er'),
    entry(3, 'alternate', 'Ada Su'),
  ],
};

const renderRaffle = () =>
  renderEventTab(
    <EventRafflePage params={Promise.resolve({ id: 'e1', raffleId: 'r1' })} />,
    '/events/e1/raffles/r1',
  );

beforeEach(() => {
  primeEventWorkspace();
  signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
  (rafflesApi.get as jest.Mock).mockResolvedValue(raffle);
});

describe('Çekiliş result page', () => {
  it('lists winners and alternates with masked e-mails and a projector link', async () => {
    await renderRaffle();
    const winners = await screen.findByRole('region', { name: 'Kazananlar' });
    expect(within(winners).getByText('Ece Tan')).toBeInTheDocument();
    expect(within(winners).getByText('e***@o***.com')).toBeInTheDocument();
    const alternates = screen.getByRole('region', { name: 'Yedekler' });
    expect(within(alternates).getByText('Ada Su')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Projektörde göster' })).toHaveAttribute(
      'href',
      '/events/e1/raffles/r1/present',
    );
  });

  it('asks a reason before calling the alternate, then shows the new winner', async () => {
    const user = userEvent.setup();
    (rafflesApi.forfeit as jest.Mock).mockResolvedValue({
      ...raffle,
      entries: [
        {
          ...raffle.entries[0],
          status: 'forfeited',
          forfeitReason: 'Salonda değildi',
          forfeitedAt: '2026-11-27T14:10:00Z',
          forfeitedBy: { id: 'u1', name: 'Deniz Kaya' },
        },
        raffle.entries[1],
        { ...raffle.entries[2], status: 'winner', promotedAt: '2026-11-27T14:10:00Z' },
      ],
    });
    await renderRaffle();
    const winners = await screen.findByRole('region', { name: 'Kazananlar' });
    await user.click(within(winners).getAllByRole('button', { name: 'Gelmedi, yedeği çağır' })[0]);

    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText('Yerine sıradaki yedek Ada Su kazanan olur.'),
    ).toBeInTheDocument();
    // No reason: not sent
    await user.click(within(dialog).getByRole('button', { name: 'Yedeği çağır' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Gerekçe en az 3 karakter olmalı.',
    );
    expect(rafflesApi.forfeit).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText('Gerekçe'), 'Salonda değildi');
    await user.click(within(dialog).getByRole('button', { name: 'Yedeği çağır' }));
    await waitFor(() =>
      expect(rafflesApi.forfeit).toHaveBeenCalledWith('e1', 'r1', 1, 'Salonda değildi'),
    );
    const after = await screen.findByRole('region', { name: 'Gelmeyenler' });
    expect(within(after).getByText('Ece Tan')).toBeInTheDocument();
    expect(within(after).getByText(/Salonda değildi · Deniz Kaya/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Kazananlar' })).getByText('Ada Su'),
    ).toBeInTheDocument();
  });

  it('says when no alternate is left', async () => {
    const user = userEvent.setup();
    (rafflesApi.forfeit as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { code: 'raffle_no_alternates' }),
    );
    await renderRaffle();
    const winners = await screen.findByRole('region', { name: 'Kazananlar' });
    await user.click(within(winners).getAllByRole('button', { name: 'Gelmedi, yedeği çağır' })[1]);
    const dialog = await screen.findByRole('alertdialog');
    await user.type(within(dialog).getByLabelText('Gerekçe'), 'Gelmedi');
    await user.click(within(dialog).getByRole('button', { name: 'Yedeği çağır' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Yedek kalmadı; yerine kimse çağrılamaz.',
    );
  });

  it('checks the draw in the browser and says the result', async () => {
    const user = userEvent.setup();
    const verification = {
      algorithm: 'sky-raffle-v1',
      seed: raffle.seed,
      listHash: raffle.listHash,
      ticketIds: ['t1', 't2', 't3'],
      order: ['t1', 't2', 't3'],
    };
    (rafflesApi.verification as jest.Mock).mockResolvedValue(verification);
    verifyRaffle.mockResolvedValue({ algorithm: true, list: true, order: true, entries: true });
    await renderRaffle();
    await user.click(await screen.findByRole('button', { name: /Tarayıcıda doğrula/ }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Liste özeti tutuyor · Sıra tohumla aynı',
    );
    expect(verifyRaffle).toHaveBeenCalledWith(verification, raffle.entries);
  });

  it('says a failed check', async () => {
    const user = userEvent.setup();
    (rafflesApi.verification as jest.Mock).mockResolvedValue({});
    verifyRaffle.mockResolvedValue({ algorithm: true, list: false, order: true, entries: true });
    await renderRaffle();
    await user.click(await screen.findByRole('button', { name: /Tarayıcıda doğrula/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('Liste özeti tutmuyor');
  });
});
