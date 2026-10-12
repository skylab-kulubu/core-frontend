import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventOverviewPage from '@/app/(authorized)/events/[id]/(workspace)/page';
import EventCompetitionPage from '@/app/(authorized)/events/[id]/(workspace)/competition/page';
import EventParticipantsPage from '@/app/(authorized)/events/[id]/(workspace)/participants/page';
import EventProgramPage from '@/app/(authorized)/events/[id]/(workspace)/program/page';
import { ProblemError } from '@/lib/api/core';
import { eventDaysApi } from '@/lib/api/eventDays';
import { eventsApi } from '@/lib/api/events';
import { ticketsApi } from '@/lib/api/tickets';
import { saveEventWithSeason } from '@/lib/scheduling/save-event';
import {
  primeEventWorkspace,
  renderEventTab,
  signInAs,
  workspaceEvent,
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

const tabNames = () => screen.getAllByRole('tab').map((tab) => tab.textContent);

describe('Event workspace layout', () => {
  beforeEach(primeEventWorkspace);
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('keeps the header and tabs over every tab, with the open route selected', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    await renderEventTab(<EventProgramPage />, '/events/e1/program');

    expect(await screen.findByRole('heading', { name: 'GeceKodu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Düzenle' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Program' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Genel bakış' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('heading', { name: 'Günler ve oturumlar' })).toBeInTheDocument();
  });

  it('moves between tabs without loading the event again', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    const workspace = await renderEventTab(<EventProgramPage />, '/events/e1/program');
    expect(await screen.findByRole('heading', { name: 'Günler ve oturumlar' })).toBeInTheDocument();
    const reads = [eventsApi.get, eventDaysApi.listByEvent, ticketsApi.listByEvent].map(
      (call) => (call as jest.Mock).mock.calls.length,
    );

    await workspace.openTab(<EventParticipantsPage />, '/events/e1/participants');

    expect(screen.getByRole('heading', { name: 'Başvuranlar' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Katılımcılar' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      [eventsApi.get, eventDaysApi.listByEvent, ticketsApi.listByEvent].map(
        (call) => (call as jest.Mock).mock.calls.length,
      ),
    ).toEqual(reads);
  });

  it('shows the owner-team Leader every tab the event has', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    await renderEventTab(<EventOverviewPage />);
    await screen.findByRole('heading', { name: 'GeceKodu' });
    expect(tabNames()).toEqual(
      expect.arrayContaining(['Genel bakış', 'Katılımcılar', 'Program', 'İçerik', 'Yarışma']),
    );
    expect(screen.getByRole('tab', { name: 'Genel bakış' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Kapı' })).toHaveAttribute('href', '/qr?eventId=e1');
    expect(screen.queryByRole('button', { name: 'Hesabınla kaydol' })).not.toBeInTheDocument();
  });

  it('shows door staff only the overview, the program and the door', async () => {
    signInAs(['/UYELER/ARGE/WEBLAB']);
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([
      { id: 'e1', name: 'GeceKodu', ownerTeam: 'GECEKODU' },
    ]);
    await renderEventTab(<EventOverviewPage />);
    await screen.findByRole('heading', { name: 'GeceKodu' });
    await waitFor(() => expect(screen.getByRole('link', { name: 'Kapı' })).toBeInTheDocument());
    expect(tabNames()).toEqual(['Genel bakış', 'Program']);
  });

  it('shows the cover beside the title and whole on the overview, not cut to a strip', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    (eventsApi.get as jest.Mock).mockResolvedValue({
      ...workspaceEvent,
      coverImageId: 'm1',
      coverImageUrl: 'https://cdn.example/kapak.png',
    });
    await renderEventTab(<EventOverviewPage />);
    await screen.findByRole('heading', { name: 'GeceKodu' });

    const headerCover = document.querySelector('[data-slot="page-header-cover"] img');
    expect(headerCover).toHaveAttribute('src', 'https://cdn.example/kapak.png');
    const overviewCover = document.querySelector('[data-slot="event-cover"] img');
    expect(overviewCover).toHaveAttribute('src', 'https://cdn.example/kapak.png');
    expect(overviewCover).toHaveClass('object-contain');
  });

  it('shows the competitor list to readers who cannot manage it once it has rows', async () => {
    signInAs(['/UYELER/ARGE/WEBLAB']);
    const { competitorsApi } = jest.requireMock('@/lib/api/competitors');
    competitorsApi.listByEvent.mockResolvedValue([{ id: 'c1', userId: 'u9', eventId: 'e1' }]);
    await renderEventTab(<EventCompetitionPage />, '/events/e1/competition');
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Yarışma' })).toHaveAttribute('aria-selected', 'true'),
    );
    expect(screen.getByRole('link', { name: /u9/ })).toHaveAttribute(
      'href',
      '/events/e1/competition/c1',
    );
    expect(screen.queryByRole('button', { name: 'Yarışmacı ekle' })).not.toBeInTheDocument();
  });

  it.each([
    ['#participants', '/events/e1/participants'],
    ['#program', '/events/e1/program'],
    ['#files', '/events/e1/content'],
    ['#competitors', '/events/e1/competition'],
    ['#certificates', '/events/e1/certificates'],
  ])('sends an old %s link to its tab', async (hash, target) => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    window.history.replaceState(null, '', `/events/e1${hash}`);
    await renderEventTab(<EventOverviewPage />);
    expect(workspaceRouter.replace).toHaveBeenCalledWith(target);
  });

  it('leaves the overview and its #overview link where they are', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    window.history.replaceState(null, '', '/events/e1#overview');
    await renderEventTab(<EventOverviewPage />);
    await screen.findByRole('heading', { name: 'GeceKodu' });
    expect(workspaceRouter.replace).not.toHaveBeenCalled();
  });

  it('saves the form Skyforms sends back to the event and opens the editor on the overview', async () => {
    signInAs(['/UYELER/YK']);
    (saveEventWithSeason as jest.Mock).mockResolvedValue(undefined);
    window.history.replaceState(
      null,
      '',
      '/events/e1?formSlot=apply&formUrl=https%3A%2F%2Fforms.yildizskylab.com%2Fforms%2Ff1',
    );

    await renderEventTab(<EventOverviewPage />);

    await waitFor(() =>
      expect(saveEventWithSeason).toHaveBeenCalledWith(
        expect.objectContaining({ formUrl: 'https://forms.yildizskylab.com/forms/f1' }),
        'e1',
      ),
    );
    expect(await screen.findByRole('dialog', { name: 'Etkinliği düzenle' })).toBeInTheDocument();
    expect(
      screen.getByText('Skyforms adresi bağlandı. Kısa link kayıtta skyl.app’den basılır.'),
    ).toBeInTheDocument();
    expect(`${window.location.pathname}${window.location.search}`).toBe('/events/e1');
    expect(workspaceRouter.replace).not.toHaveBeenCalled();
  });

  it('opens the editor when GET omits images, extra forms, and door staff', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/YK']);
    await renderEventTab(<EventOverviewPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'GeceKodu' })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Düzenle' }));
    expect(await screen.findByRole('dialog', { name: 'Etkinliği düzenle' })).toBeInTheDocument();
  });

  it('says the event was saved from the edit drawer', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/YK']);
    (saveEventWithSeason as jest.Mock).mockResolvedValueOnce('e1');
    await renderEventTab(<EventProgramPage />, '/events/e1/program');
    await screen.findByRole('heading', { name: 'GeceKodu' });
    await user.click(screen.getByRole('button', { name: 'Düzenle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Etkinliği düzenle' });
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByText('Etkinlik kaydedildi')).toBeInTheDocument();
  });

  it('asks before deleting the event, then offers Geri al that reopens it', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/YK']);
    (eventsApi.delete as jest.Mock).mockResolvedValueOnce(undefined);
    (eventsApi.restore as jest.Mock).mockResolvedValueOnce({ id: 'e1' });
    await renderEventTab(<EventProgramPage />, '/events/e1/program');
    await screen.findByRole('heading', { name: 'GeceKodu' });
    await user.click(screen.getByRole('button', { name: 'Sil' }));
    const confirm = await screen.findByRole('alertdialog', { name: '"GeceKodu" silinsin mi?' });
    expect(eventsApi.delete).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Etkinliği sil' }));
    await waitFor(() => expect(workspaceRouter.push).toHaveBeenCalledWith('/events'));
    expect(await screen.findByText('Etkinlik silindi')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Geri al' }));
    await waitFor(() => expect(eventsApi.restore).toHaveBeenCalledWith('e1'));
    expect(await screen.findByText('Etkinlik geri alındı')).toBeInTheDocument();
    expect(workspaceRouter.push).toHaveBeenLastCalledWith('/events/e1');
  });

  it('shows a refused save inside the edit drawer', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/YK']);
    (saveEventWithSeason as jest.Mock).mockRejectedValueOnce(
      new ProblemError(422, 'Unprocessable Content', {
        code: 'media_purpose_mismatch',
        fields: { mediaId: 'g1', role: 'event_cover', purpose: 'event_gallery' },
      }),
    );
    await renderEventTab(<EventProgramPage />, '/events/e1/program');
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'GeceKodu' })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Düzenle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Etkinliği düzenle' });

    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Bu dosya Etkinlik galerisi için yüklenmiş; etkinlik kapağı olarak kullanılamaz. Dosyayı bu alan için yeniden yükle.',
    );
  });

  it('shows why the event did not load instead of its tabs', async () => {
    signInAs(['/UYELER/YK']);
    (eventsApi.get as jest.Mock).mockRejectedValue(
      new ProblemError(404, 'Not Found', { detail: 'Etkinlik bulunamadı' }),
    );
    await renderEventTab(<EventProgramPage />, '/events/e1/program');
    expect(await screen.findByText('Etkinlik bulunamadı')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});
