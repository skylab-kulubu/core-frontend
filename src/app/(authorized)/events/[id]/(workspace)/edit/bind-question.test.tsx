import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventEditRoute from '@/app/(authorized)/events/[id]/(workspace)/edit/page';
import { formRespondentsApi } from '@/lib/api/form-respondents';
import { saveEventWithSeason } from '@/lib/scheduling/save-event';
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
jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn(() => Promise.reject(new TypeError('Failed to fetch'))) },
}));
jest.mock('@/lib/scheduling/save-event', () =>
  jest.requireActual('@/test/event-workspace').saveEventModule(),
);

const FORM = '33333333-3333-4333-8333-333333333333';

jest.mock('@/lib/api/skyforms', () => ({
  ...jest.requireActual('@/lib/api/skyforms'),
  readFormGate: jest.fn(() => Promise.resolve('open')),
  readFormTitle: jest.fn(() => Promise.resolve('Başvuru 2026')),
  readFormAnswerCounts: jest.fn(() => Promise.resolve({ accepted: 3, pending: 0 })),
  listMyForms: jest.fn(() =>
    Promise.resolve({
      items: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          title: 'Başvuru 2026',
          status: 2,
          userRole: 3,
          responseCount: 3,
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 20,
    }),
  ),
}));
jest.mock('@/lib/api/form-respondents', () => {
  const { ProblemError } = jest.requireActual('@/lib/api/core');
  const notListed = () =>
    Promise.reject(new ProblemError(404, 'Not Found', { code: 'form_not_listed' }));
  return {
    formRespondentsApi: {
      questions: jest.fn(notListed),
      mapping: jest.fn(notListed),
      previewTickets: jest.fn(() =>
        Promise.resolve({
          tickets: 0,
          waitlisted: 0,
          full: 0,
          alreadyTicketed: 0,
          pendingSkipped: 0,
        }),
      ),
      list: jest.fn(() =>
        Promise.resolve({ items: [], nextCursor: null, total: 0, collecting: true }),
      ),
      sendTickets: jest.fn(() => Promise.resolve({ jobId: 'job-1' })),
      ticketJob: jest.fn(),
    },
  };
});

describe('Edit page: a newly linked Skyforms form', () => {
  beforeEach(primeEventWorkspace);
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    window.sessionStorage.clear();
  });

  it('asks after the save whether its respondents get Tickets, staying on the edit page', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/YK']);
    (saveEventWithSeason as jest.Mock).mockResolvedValueOnce('e1');
    await renderEventTab(<EventEditRoute />, '/events/e1/edit');
    await user.click((await screen.findAllByRole('radio', { name: 'SkyForms' }))[0]!);
    await user.click(await screen.findByRole('button', { name: 'Form seç' }));
    await user.click(await screen.findByRole('button', { name: 'Başvuru 2026' }));
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    // A published event's new form is a new link: the save asks first (core event.changed)
    const notice = await screen.findByRole('alertdialog', { name: 'Bağlantılar değişti' });
    await user.click(within(notice).getByRole('button', { name: 'Kaydet' }));

    const question = await screen.findByText(
      'Bu formu 3 kişi doldurdu. Hepsini katılımcı olarak ekleyip biletlerini gönderelim mi?',
    );
    const dialog = question.closest<HTMLElement>('[role="alertdialog"]')!;
    expect(
      within(dialog).getByText('Yanıtlar alınıyor; biletler alım bitince gider.'),
    ).toBeInTheDocument();
    expect(workspaceRouter.push).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Biletleri gönder' }));
    expect(formRespondentsApi.sendTickets).toHaveBeenCalledWith('e1', { all: true, formId: FORM });
    expect(await screen.findByText('Etkinlik kaydedildi')).toBeInTheDocument();
    expect(workspaceRouter.push).not.toHaveBeenCalled();
  });
});
