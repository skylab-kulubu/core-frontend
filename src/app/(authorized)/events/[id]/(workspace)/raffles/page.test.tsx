import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventRafflesPage from '@/app/(authorized)/events/[id]/(workspace)/raffles/page';
import { ProblemError } from '@/lib/api/core';
import { DEFAULT_RAFFLE_CRITERIA, rafflesApi } from '@/lib/api/raffles';
import {
  eventDaysModule,
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
  rafflesApi: {
    preview: jest.fn(),
    draw: jest.fn(),
    list: jest.fn(),
    get: jest.fn(),
    forfeit: jest.fn(),
    verification: jest.fn(),
  },
}));

const LEADER = ['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER'];

const preview = {
  eligible: 312,
  excluded: { pastWinners: 3, organizers: 12, doorStaff: 4, coOrganizers: 0 },
  candidates: [
    { name: 'Ay*** Yı***', ticketType: 'REGISTERED' as const },
    { name: 'Me*** Ka***', ticketType: 'GUEST' as const },
  ],
  truncated: true,
};

const renderRaffles = () => renderEventTab(<EventRafflesPage />, '/events/e1/raffles');

// jsdom has no PointerEvent; base-ui's Checkbox sends one to its hidden input on a click
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
  }
});

beforeEach(() => {
  primeEventWorkspace();
  (rafflesApi.list as jest.Mock).mockResolvedValue([]);
  (rafflesApi.preview as jest.Mock).mockResolvedValue(preview);
});

describe('Çekiliş page', () => {
  it('asks core once the form rests and shows the count and who is left out', async () => {
    const user = userEvent.setup();
    signInAs(LEADER);
    await renderRaffles();

    expect(await screen.findByText('Uygun: 312 kişi')).toBeInTheDocument();
    expect(
      screen.getByText('Hariç tutulan: 3 önceki kazanan · 12 düzenleyen · 4 kapı görevlisi'),
    ).toBeInTheDocument();
    expect(rafflesApi.preview).toHaveBeenCalledTimes(1);
    expect(rafflesApi.preview).toHaveBeenLastCalledWith(
      'e1',
      DEFAULT_RAFFLE_CRITERIA,
      expect.anything(),
    );

    // Three changes in a row: one question, with all three
    (rafflesApi.preview as jest.Mock).mockResolvedValue({ ...preview, eligible: 40 });
    await user.selectOptions(screen.getByLabelText('Bilet türü'), 'GUEST');
    await user.click(screen.getByRole('checkbox', { name: 'Kapı görevlileri' }));
    await user.click(screen.getByRole('checkbox', { name: 'Sertifika eşiğini geçenler' }));

    expect(await screen.findByText('Uygun: 40 kişi')).toBeInTheDocument();
    expect(rafflesApi.preview).toHaveBeenCalledTimes(2);
    expect(rafflesApi.preview).toHaveBeenLastCalledWith(
      'e1',
      {
        ...DEFAULT_RAFFLE_CRITERIA,
        ticketType: 'GUEST',
        excludeDoorStaff: false,
        certificateEligible: true,
      },
      expect.anything(),
    );
  });

  it('sends the counted-session minimum and shows it out of the counted sessions', async () => {
    const user = userEvent.setup();
    signInAs(LEADER);
    await renderRaffles();
    await screen.findByText('Uygun: 312 kişi');
    expect(screen.getByText('/1')).toBeInTheDocument();

    await user.type(screen.getByLabelText('En az kaç sayılan oturuma katılmış'), '1');
    await waitFor(() =>
      expect(rafflesApi.preview).toHaveBeenLastCalledWith(
        'e1',
        { ...DEFAULT_RAFFLE_CRITERIA, minCounted: 1 },
        expect.anything(),
      ),
    );

    // Above the counted sessions: said, and not asked
    const calls = (rafflesApi.preview as jest.Mock).mock.calls.length;
    await user.type(screen.getByLabelText('En az kaç sayılan oturuma katılmış'), '5');
    expect(await screen.findByText('1 ile 1 arasında bir sayı yaz')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Çek' })).toBeDisabled();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(rafflesApi.preview).toHaveBeenCalledTimes(calls);
  });

  it('asks no Session minimum of an event without Sessions', async () => {
    eventDaysModule.eventDaysApi.listSessions.mockResolvedValue([]);
    signInAs(LEADER);
    await renderRaffles();
    await screen.findByText('Uygun: 312 kişi');
    expect(screen.queryByLabelText('En az kaç sayılan oturuma katılmış')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Alana giriş')).toBeInTheDocument();
  });

  it('opens the masked list', async () => {
    const user = userEvent.setup();
    signInAs(LEADER);
    await renderRaffles();
    await user.click(await screen.findByRole('button', { name: 'Listeyi göster' }));
    const list = screen.getByRole('list', { name: 'Uygun kişiler' });
    expect(within(list).getByText('Ay*** Yı***')).toBeInTheDocument();
    expect(screen.getByText('İlk 2 kişi gösteriliyor.')).toBeInTheDocument();
  });

  it('asks before drawing, then opens the result', async () => {
    const user = userEvent.setup();
    signInAs(LEADER);
    (rafflesApi.draw as jest.Mock).mockResolvedValue({ id: 'r9' });
    await renderRaffles();
    await screen.findByText('Uygun: 312 kişi');

    await user.type(screen.getByLabelText('Başlık'), 'Kapanış çekilişi');
    await user.clear(screen.getByLabelText('Kazanan'));
    await user.type(screen.getByLabelText('Kazanan'), '3');
    await user.clear(screen.getByLabelText('Yedek'));
    await user.type(screen.getByLabelText('Yedek'), '2');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Çek' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Çek' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(
        '312 kişi arasından 3 kazanan ve 2 yedek çekilecek. Çekiliş kaydı silinemez.',
      ),
    ).toBeInTheDocument();
    expect(rafflesApi.draw).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Çek' }));

    await waitFor(() =>
      expect(rafflesApi.draw).toHaveBeenCalledWith('e1', {
        title: 'Kapanış çekilişi',
        criteria: DEFAULT_RAFFLE_CRITERIA,
        winners: 3,
        alternates: 2,
      }),
    );
    expect(workspaceRouter.push).toHaveBeenCalledWith('/events/e1/raffles/r9');
  });

  it.each([
    [
      new ProblemError(409, 'Conflict', {
        code: 'raffle_too_few_candidates',
        fields: { eligible: 2 },
      }),
      'Bu şartlara uyan 2 kişi var; kazanan sayısı bundan büyük olamaz.',
    ],
    [
      new ProblemError(503, 'Unavailable', { code: 'audit_unavailable' }),
      'Denetim kaydı açılamadı, çekiliş yapılmadı. Biraz sonra tekrar dene.',
    ],
  ])('says core’s refusal in the question (%#)', async (problem, text) => {
    const user = userEvent.setup();
    signInAs(LEADER);
    (rafflesApi.draw as jest.Mock).mockRejectedValue(problem);
    await renderRaffles();
    await screen.findByText('Uygun: 312 kişi');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Çek' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Çek' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Çek' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(text);
    expect(workspaceRouter.push).not.toHaveBeenCalled();
  });

  it('lists the raffles drawn so far with their counts and criteria', async () => {
    signInAs(LEADER);
    (rafflesApi.list as jest.Mock).mockResolvedValue([
      {
        id: 'r1',
        title: 'Açılış çekilişi',
        drawnAt: '2026-11-27T09:30:00Z',
        drawnBy: { id: 'u1', name: 'Deniz Kaya' },
        eligibleCount: 312,
        winnerCount: 3,
        alternateCount: 2,
        criteria: { ...DEFAULT_RAFFLE_CRITERIA, minCounted: 3, ticketType: 'REGISTERED' },
      },
    ]);
    await renderRaffles();
    const history = await screen.findByRole('region', { name: 'Yapılan çekilişler' });
    expect(within(history).getByRole('link', { name: /Açılış çekilişi/ })).toHaveAttribute(
      'href',
      '/events/e1/raffles/r1',
    );
    expect(
      within(history).getByText(/Deniz Kaya · 312 uygun · 3 kazanan · 2 yedek/),
    ).toBeInTheDocument();
    expect(
      within(history).getByText(
        'En az 3 sayılan oturum · Yalnız üye · Hariç: önceki kazananlar, düzenleyenler, kapı görevlileri, ortak düzenleyenler',
      ),
    ).toBeInTheDocument();
  });

  it('keeps the page from who may neither edit the event nor assign its tickets', async () => {
    signInAs(['/UYELER/ARGE/WEBLAB']);
    await renderRaffles();
    expect(await screen.findByText('Bu etkinlikte çekiliş yetkin yok')).toBeInTheDocument();
    expect(rafflesApi.list).not.toHaveBeenCalled();
  });

  it('says so when core refuses the reader', async () => {
    signInAs(LEADER);
    (rafflesApi.list as jest.Mock).mockRejectedValue(new ProblemError(403, 'Forbidden'));
    await renderRaffles();
    expect(await screen.findByText('Bu etkinlikte çekiliş yetkin yok')).toBeInTheDocument();
  });
});
