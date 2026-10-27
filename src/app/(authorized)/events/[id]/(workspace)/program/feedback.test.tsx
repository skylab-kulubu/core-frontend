import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventOverviewPage from '@/app/(authorized)/events/[id]/(workspace)/page';
import EventProgramPage from '@/app/(authorized)/events/[id]/(workspace)/program/page';
import { eventDaysApi } from '@/lib/api/eventDays';
import { eventsApi } from '@/lib/api/events';
import { sessionsApi } from '@/lib/api/sessions';
import { urlsApi } from '@/lib/api/urls';
import {
  primeEventWorkspace,
  renderEventTab,
  signInAs,
  workspaceEvent,
  workspaceRouter,
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
jest.mock('@/lib/api/urls', () => jest.requireActual('@/test/event-workspace').urlsModule());
jest.mock('@/lib/api/skyforms', () => ({
  readFormGate: jest.fn().mockResolvedValue('open'),
  setFormGate: jest.fn(),
}));
jest.mock('@/lib/scheduling/save-event', () =>
  jest.requireActual('@/test/event-workspace').saveEventModule(),
);

const FORM = 'https://forms.yildizskylab.com/55555555-5555-4555-8555-555555555555';
const LEADER = ['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER'];
const renderProgram = () => renderEventTab(<EventProgramPage />, '/events/e1/program');

function inMode(feedbackMode: string, session: Record<string, unknown> = {}) {
  (eventsApi.get as jest.Mock).mockResolvedValue({ ...workspaceEvent, feedbackMode });
  (eventDaysApi.listSessions as jest.Mock).mockResolvedValue([{ ...workspaceSession, ...session }]);
}

async function openSessionEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Oturumu düzenle' }));
  return screen.findByRole('dialog', { name: 'Oturumu düzenle' });
}

describe('Program: a Session feedback form (per_session)', () => {
  beforeEach(() => {
    primeEventWorkspace();
    window.history.replaceState(null, '', '/events/e1/program');
    (eventsApi.feedbackCounts as jest.Mock).mockResolvedValue({
      event: { sent: 0, answered: 0 },
      sessions: [{ sessionId: 's1', sent: 4, answered: 1 }],
    });
    (sessionsApi.update as jest.Mock).mockResolvedValue({});
    (urlsApi.create as jest.Mock).mockResolvedValue({
      id: 'u1',
      alias: 'gecekodu-gecekoduacilis2026',
    });
  });

  it('shows no feedback form in the Session drawer out of the per-Session mode, and sends none', async () => {
    const user = userEvent.setup();
    signInAs(LEADER);
    inMode('event', { feedbackFormUrl: FORM });
    await renderProgram();

    const dialog = await openSessionEditor(user);
    expect(within(dialog).queryByText('Oturum bitince gönder')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Geri bildirim' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));

    await waitFor(() => expect(sessionsApi.update).toHaveBeenCalled());
    const body = (sessionsApi.update as jest.Mock).mock.calls[0][1];
    // core keeps the Session's form when the body leaves it out
    expect(body).not.toHaveProperty('feedbackFormUrl');
    expect(body).not.toHaveProperty('feedbackAutoSend');
  });

  it('saves the form, its short link named after the Session, and the box', async () => {
    const user = userEvent.setup();
    signInAs(LEADER);
    inMode('per_session');
    await renderProgram();

    const dialog = await openSessionEditor(user);
    await user.type(within(dialog).getByLabelText('Form adresi'), FORM);
    fireEvent.click(within(dialog).getByRole('switch', { name: /Oturum bitince gönder/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));

    await waitFor(() => expect(sessionsApi.update).toHaveBeenCalled());
    expect(urlsApi.create).toHaveBeenCalledWith({
      url: FORM,
      alias: 'gecekodu-gecekoduacilis2026',
    });
    expect(sessionsApi.update).toHaveBeenLastCalledWith(
      's1',
      expect.objectContaining({
        title: 'Açılış',
        feedbackFormUrl: FORM,
        feedbackFormAlias: 'gecekodu-gecekoduacilis2026',
        feedbackAutoSend: false,
      }),
    );
  });

  it('clears a removed form with null', async () => {
    const user = userEvent.setup();
    signInAs(LEADER);
    inMode('per_session', { feedbackFormUrl: FORM, feedbackFormAlias: 'acilis' });
    await renderProgram();

    const dialog = await openSessionEditor(user);
    await user.clear(within(dialog).getByLabelText('Form adresi'));
    await user.clear(within(dialog).getByLabelText('Kısa adres'));
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));

    await waitFor(() =>
      expect(sessionsApi.update).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({
          feedbackFormUrl: null,
          feedbackFormAlias: null,
          feedbackAutoSend: true,
        }),
      ),
    );
  });

  it('shows the Session form link, QR and counts, and sends it now', async () => {
    const user = userEvent.setup();
    signInAs(LEADER);
    inMode('per_session', { feedbackFormUrl: FORM, feedbackFormAlias: 'acilis' });
    (sessionsApi.sendFeedback as jest.Mock).mockResolvedValue({ sent: true, recipients: 4 });
    await renderProgram();

    await user.click(await screen.findByRole('button', { name: 'Geri bildirim' }));
    const drawer = await screen.findByRole('dialog', { name: 'Açılış · Geri bildirim' });
    expect(within(drawer).getByLabelText('QR acilis')).toBeInTheDocument();
    expect(await within(drawer).findByText('Gönderilen 4 · Cevaplayan 1')).toBeInTheDocument();

    await user.click(within(drawer).getByRole('button', { name: 'Şimdi gönder' }));
    const question = await screen.findByRole('alertdialog', {
      name: 'Geri bildirim formu şimdi gönderilsin mi?',
    });
    await user.click(within(question).getByRole('button', { name: 'Şimdi gönder' }));
    expect(sessionsApi.sendFeedback).toHaveBeenCalledWith('s1');
    expect(await screen.findByText('4 kişiye gönderiliyor')).toBeInTheDocument();
  });
});

describe('Back from Skyforms with a Session feedback form', () => {
  beforeEach(() => {
    primeEventWorkspace();
    (sessionsApi.update as jest.Mock).mockResolvedValue({});
    (urlsApi.create as jest.Mock).mockResolvedValue({
      id: 'u1',
      alias: 'gecekodu-gecekoduacilis2026',
    });
  });

  it('saves it on its Session, not on the Event, and opens Program', async () => {
    signInAs(['/UYELER/YK']);
    inMode('per_session');
    window.history.replaceState(
      null,
      '',
      `/events/e1?formSlot=feedback-session%3As1&formUrl=${encodeURIComponent(FORM)}`,
    );

    await renderEventTab(<EventOverviewPage />);

    await waitFor(() =>
      expect(sessionsApi.update).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({
          title: 'Açılış',
          feedbackFormUrl: FORM,
          feedbackFormAlias: 'gecekodu-gecekoduacilis2026',
        }),
      ),
    );
    await waitFor(() => expect(workspaceRouter.replace).toHaveBeenCalledWith('/events/e1/program'));
    expect(screen.queryByRole('dialog', { name: 'Etkinliği düzenle' })).not.toBeInTheDocument();
  });
});

describe('Overview: the Sessions for the Event form (event_with_sessions)', () => {
  beforeEach(() => {
    primeEventWorkspace();
    window.history.replaceState(null, '', '/events/e1');
  });

  it('lists the Sessions to copy, with how the form asks about them', async () => {
    const user = userEvent.setup();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    signInAs(LEADER);
    inMode('event_with_sessions');
    await renderEventTab(<EventOverviewPage />);

    expect(await screen.findByText('Açılış (Ada)')).toBeInTheDocument();
    expect(screen.getByText(/matris sorusu/)).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText('Formda oturumlar'),
      'Kişi katıldığı oturumları işaretler',
    );
    expect(screen.getByText(/Hangi oturumlara katıldın/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Listeyi kopyala' }));
    expect(writeText).toHaveBeenCalledWith('Açılış (Ada)');
  });

  it('shows no list in the other modes', async () => {
    signInAs(LEADER);
    inMode('event');
    await renderEventTab(<EventOverviewPage />);
    await screen.findByRole('heading', { name: 'GeceKodu' });
    expect(screen.queryByText('Formda oturumlar')).not.toBeInTheDocument();
  });
});
