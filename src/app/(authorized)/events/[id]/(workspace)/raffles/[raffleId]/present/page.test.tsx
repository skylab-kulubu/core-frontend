import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventRafflePresentPage from '@/app/(authorized)/events/[id]/(workspace)/raffles/[raffleId]/present/page';
import { DEFAULT_RAFFLE_CRITERIA, rafflesApi, type Raffle } from '@/lib/api/raffles';
import {
  primeEventWorkspace,
  renderEventTab,
  signInAs,
  workspaceRouter,
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
jest.mock('@/lib/api/raffles', () => ({
  ...jest.requireActual('@/lib/api/raffles'),
  rafflesApi: { get: jest.fn() },
}));

// jsdom has no PointerEvent; base-ui's Checkbox sends one to its hidden input on a click
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
  }
});

const row = (
  position: number,
  status: 'winner' | 'alternate' | 'forfeited',
  name: string,
  email: string,
) => ({
  position,
  status,
  ticketId: `t${position}`,
  name,
  maskedEmail: email,
  ticketType: 'GUEST' as const,
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
  drawnBy: null,
  eligibleCount: 50,
  winnerCount: 2,
  alternateCount: 1,
  criteria: DEFAULT_RAFFLE_CRITERIA,
  listHash: 'a'.repeat(64),
  seed: 'b'.repeat(64),
  algorithm: 'sky-raffle-v1',
  entries: [
    row(1, 'forfeited', 'Gelmeyen Kişi', 'g***@o***.com'),
    row(2, 'winner', 'Ayşe Nur Yılmaz', 'a***@o***.com'),
    row(3, 'winner', 'Mert Kaya', 'm***@o***.com'),
    row(4, 'alternate', 'Yedek Kişi', 'y***@o***.com'),
  ],
};

const renderPresent = () =>
  renderEventTab(
    <EventRafflePresentPage params={Promise.resolve({ id: 'e1', raffleId: 'r1' })} />,
    '/events/e1/raffles/r1/present',
  );

beforeEach(() => {
  primeEventWorkspace();
  signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
  (rafflesApi.get as jest.Mock).mockResolvedValue(raffle);
});

describe('Çekiliş projector', () => {
  it('opens the winners one by one, never an e-mail or an alternate', async () => {
    const user = userEvent.setup();
    await renderPresent();
    const stage = await screen.findByRole('dialog', { name: 'Kapanış çekilişi — kazananlar' });
    const list = within(stage).getByRole('list', { name: 'Kazananlar' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).queryByText('Ayşe Nur Yılmaz')).not.toBeInTheDocument();

    await user.keyboard(' ');
    expect(within(list).getByText('Ayşe Nur Yılmaz')).toBeInTheDocument();
    expect(within(list).queryByText('Mert Kaya')).not.toBeInTheDocument();

    await user.click(within(stage).getByRole('heading', { name: 'Kapanış çekilişi' }));
    expect(within(list).getByText('Mert Kaya')).toBeInTheDocument();

    expect(stage).not.toHaveTextContent('@');
    expect(stage).not.toHaveTextContent('Yedek Kişi');
    expect(stage).not.toHaveTextContent('Gelmeyen Kişi');
  });

  it('shows all at once and shortens the names', async () => {
    const user = userEvent.setup();
    await renderPresent();
    const stage = await screen.findByRole('dialog');
    await user.click(within(stage).getByRole('button', { name: 'Hepsini göster' }));
    expect(within(stage).getByText('Mert Kaya')).toBeInTheDocument();
    await user.click(within(stage).getByRole('checkbox', { name: 'Adları kısalt' }));
    expect(within(stage).getByText('Ayşe Nur Y.')).toBeInTheDocument();
    expect(within(stage).getByText('Mert K.')).toBeInTheDocument();
    expect(within(stage).queryByText('Mert Kaya')).not.toBeInTheDocument();
  });

  it('goes back to the result on Escape', async () => {
    const user = userEvent.setup();
    await renderPresent();
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(workspaceRouter.push).toHaveBeenCalledWith('/events/e1/raffles/r1');
  });
});
