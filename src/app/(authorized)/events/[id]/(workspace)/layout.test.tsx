import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventOverviewPage from '@/app/(authorized)/events/[id]/(workspace)/page';
import EventEditRoute from '@/app/(authorized)/events/[id]/(workspace)/edit/page';
import EventCompetitionPage from '@/app/(authorized)/events/[id]/(workspace)/competition/page';
import EventParticipantsPage from '@/app/(authorized)/events/[id]/(workspace)/participants/page';
import EventProgramPage from '@/app/(authorized)/events/[id]/(workspace)/program/page';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { certificatesApi } from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';
import { eventDaysApi } from '@/lib/api/eventDays';
import { eventsApi } from '@/lib/api/events';
import { eventOrganizersApi } from '@/lib/api/event-organizers';
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
jest.mock('@/lib/api/competitions', () => ({
  ...jest.requireActual('@/lib/api/competitions'),
  competitionsApi: { listByEvent: jest.fn().mockResolvedValue([]), leaderboard: jest.fn() },
}));
jest.mock('@/lib/api/teams', () => jest.requireActual('@/test/event-workspace').teamsModule);
jest.mock('@/lib/api/seasons', () => jest.requireActual('@/test/event-workspace').seasonsModule);
// Unreadable by default (the group rule stands); a test sets core's answer
jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn(() => Promise.reject(new TypeError('Failed to fetch'))) },
}));
jest.mock('@/lib/scheduling/save-event', () =>
  jest.requireActual('@/test/event-workspace').saveEventModule(),
);
// An older core without Co-organizers (404) unless a test sets core's answer
jest.mock('@/lib/api/event-organizers', () => {
  const { ProblemError: Problem } = jest.requireActual('@/lib/api/core');
  return {
    eventOrganizersApi: {
      get: jest.fn(() => Promise.reject(new Problem(404, 'Not Found'))),
      put: jest.fn(),
    },
  };
});
// An older core without Event templates (404) unless a test sets core's answer
jest.mock('@/lib/api/certificates', () => {
  const actual = jest.requireActual('@/lib/api/certificates');
  const { ProblemError: Problem } = jest.requireActual('@/lib/api/core');
  return {
    ...actual,
    certificatesApi: {
      ...actual.certificatesApi,
      eventTemplate: jest.fn(() => Promise.reject(new Problem(404, 'Not Found'))),
      createEventTemplate: jest.fn(),
      resolve: jest.fn(() => Promise.resolve(null)),
    },
  };
});

/** core's capabilities: every Event write for GECEKODU. */
function allowStatusActions(write = true) {
  (capabilitiesApi.get as jest.Mock).mockResolvedValue({
    teams: [{ team: 'GECEKODU', can: { 'event.update': write, 'event.delete': write } }],
  });
}

// Back to unreadable after a test that set core's answer
afterEach(() => {
  (capabilitiesApi.get as jest.Mock).mockImplementation(() =>
    Promise.reject(new TypeError('Failed to fetch')),
  );
});

/** The event's own menu (its pages), the open one marked as the current page. */
const menu = () => screen.getByRole('navigation', { name: 'Etkinlik' });
const tab = (name: string) => within(menu()).getByRole('link', { name: new RegExp(`^${name}`) });
const tabNames = () =>
  within(menu())
    .getAllByRole('link')
    .map((link) => link.textContent?.replace(/\d+$/, ''));

describe('Event workspace layout', () => {
  beforeEach(primeEventWorkspace);
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('keeps the header and tabs over every tab, with the open route selected', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    await renderEventTab(<EventProgramPage />, '/events/e1/program');

    expect(await screen.findByRole('heading', { name: 'GeceKodu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Düzenle' })).toBeInTheDocument();
    expect(tab('Program')).toHaveAttribute('aria-current', 'page');
    expect(tab('Genel bakış')).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('heading', { name: 'Günler ve oturumlar' })).toBeInTheDocument();
  });

  it('moves between tabs without loading the event again', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    const workspace = await renderEventTab(<EventProgramPage />, '/events/e1/program');
    expect(await screen.findByRole('heading', { name: 'Günler ve oturumlar' })).toBeInTheDocument();
    // The event's own reads; the tab reads its cancelled tickets and its waiting list itself
    // (`?status=cancelled`, `?status=waitlisted`)
    const eventReads = () =>
      [eventsApi.get, eventDaysApi.listByEvent, ticketsApi.listByEvent].map(
        (call) =>
          (call as jest.Mock).mock.calls.filter(
            (args) => args[1] !== 'cancelled' && args[1] !== 'waitlisted',
          ).length,
      );
    const reads = eventReads();

    await workspace.openTab(<EventParticipantsPage />, '/events/e1/participants');

    // The participants tab is drawn (its roster's search), from the workspace's data
    expect(await screen.findByRole('searchbox', { name: 'Katılımcı ara' })).toBeInTheDocument();
    expect(tab('Katılımcılar')).toHaveAttribute('aria-current', 'page');
    expect(eventReads()).toEqual(reads);
  });

  it('shows the owner-team Leader every tab the event has', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    await renderEventTab(<EventOverviewPage />);
    await screen.findByRole('heading', { name: 'GeceKodu' });
    expect(tabNames()).toEqual(
      expect.arrayContaining(['Genel bakış', 'Katılımcılar', 'Program', 'Dosyalar', 'Yarışma']),
    );
    expect(tab('Genel bakış')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Kapı' })).toHaveAttribute('href', '/events/e1/door');
    expect(screen.queryByRole('button', { name: 'Hesabınla kaydol' })).not.toBeInTheDocument();
  });

  it('opens the tabs a Co-organizer team’s Leader may use, by core’s decision on the Event', async () => {
    signInAs(['/UYELER/ARGE/WEBLAB/LIDERLER']);
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      teams: [{ team: 'WEBLAB', can: { 'event.update': true } }],
      otherTeams: { can: {} },
    });
    (eventsApi.get as jest.Mock).mockResolvedValue({
      ...workspaceEvent,
      viewer: {
        via: 'coTeam',
        can: {
          'event.update': true,
          'event.delete': false,
          'ticket.read': true,
          'certificate.issue': true,
          'certificate.template.assign': true,
          'competition.manage': true,
        },
      },
    });
    await renderEventTab(<EventOverviewPage />);
    await screen.findByRole('heading', { name: 'GeceKodu' });
    await waitFor(() =>
      expect(tabNames()).toEqual(expect.arrayContaining(['Katılımcılar', 'Sertifikalar'])),
    );
    expect(screen.getByRole('link', { name: 'Düzenle' })).toHaveAttribute(
      'href',
      '/events/e1/edit',
    );
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

  it('shows the cover whole beside the title, its colours behind the header', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU/LIDERLER']);
    (eventsApi.get as jest.Mock).mockResolvedValue({
      ...workspaceEvent,
      coverImageId: 'm1',
      coverImageUrl: 'https://cdn.example/kapak.png',
    });
    await renderEventTab(<EventOverviewPage />);
    await screen.findByRole('heading', { name: 'GeceKodu' });

    // Whole in front of its own colours: the frame shows all of it, a blurred copy fills the ground
    const header = document.querySelector('[data-slot="object-page-header"]');
    const shown = [...(header?.querySelectorAll('img') ?? [])].filter((img) =>
      img.classList.contains('object-contain'),
    );
    expect(shown).toHaveLength(1);
    expect(shown[0]).toHaveAttribute('src', 'https://cdn.example/kapak.png');
    expect(header?.querySelector('[data-slot="object-cover-backdrop"] img')).toHaveAttribute(
      'src',
      'https://cdn.example/kapak.png',
    );
  });

  it('shows the competitor list to readers who cannot manage it once it has rows', async () => {
    signInAs(['/UYELER/ARGE/WEBLAB']);
    const { competitorsApi } = jest.requireMock('@/lib/api/competitors');
    competitorsApi.listByEvent.mockResolvedValue([{ id: 'c1', userId: 'u9', eventId: 'e1' }]);
    await renderEventTab(<EventCompetitionPage />, '/events/e1/competition');
    await waitFor(() => expect(tab('Yarışma')).toHaveAttribute('aria-current', 'page'));
    // The old records sit folded under the competitions
    expect(await screen.findByText('Henüz yarışma yok')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Göster' }));
    expect(await screen.findByRole('link', { name: /u9/ })).toHaveAttribute(
      'href',
      '/events/e1/competition/c1',
    );
    expect(screen.queryByRole('button', { name: 'Yarışma ekle' })).not.toBeInTheDocument();
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

  it('saves the form Skyforms sends back to the event and opens the edit page', async () => {
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
        // the Event as read: only what Skyforms changed is sent
        expect.objectContaining({ formUrl: '' }),
        { notifyTicketHolders: false },
      ),
    );
    expect(await screen.findByText('Form bağlandı.')).toBeInTheDocument();
    // The edit page shows what was linked, without the return in the address
    expect(workspaceRouter.replace).toHaveBeenCalledWith('/events/e1/edit');
  });

  it('opens no editor for a DK member coming back from Skyforms', async () => {
    signInAs(['/UYELER/DK']);
    let answer: (value: unknown) => void = () => undefined;
    (capabilitiesApi.get as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    window.history.replaceState(
      null,
      '',
      '/events/e1?formSlot=apply&formUrl=https%3A%2F%2Fforms.yildizskylab.com%2Fforms%2Ff1',
    );

    await renderEventTab(<EventOverviewPage />);
    expect(await screen.findByRole('heading', { name: 'GeceKodu' })).toBeInTheDocument();
    // The save waits for core's answer, which says DK writes nothing
    answer({
      can: {},
      teams: [],
      otherTeams: { can: { 'event.update': false } },
      noOwnerTeam: { can: { 'event.update': false } },
    });
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Düzenle' })).toBeNull());
    expect(workspaceRouter.replace).not.toHaveBeenCalledWith(expect.stringContaining('/edit'));
    expect(saveEventWithSeason).not.toHaveBeenCalled();
  });

  it('links Düzenle to the edit page, which opens when GET omits images, extra forms, and door staff', async () => {
    signInAs(['/UYELER/YK']);
    await renderEventTab(<EventOverviewPage />);
    expect(await screen.findByRole('link', { name: 'Düzenle' })).toHaveAttribute(
      'href',
      '/events/e1/edit',
    );
  });

  it('shows the edit page in sections, without the tabs, its jump list naming each', async () => {
    signInAs(['/UYELER/YK']);
    await renderEventTab(<EventEditRoute />, '/events/e1/edit');
    const sections = await screen.findByRole('navigation', { name: 'Bölümler' });
    expect(
      within(sections)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Temel bilgiler',
      'Düzenleyenler',
      'Zaman ve yer',
      'Başvuru ve form',
      'Bilet ve kapı',
      'Sertifika',
      'Görünürlük ve yayın',
    ]);
    expect(screen.getByRole('heading', { name: 'Sertifika' })).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Düzenle' })).not.toBeInTheDocument();
  });

  it('holds Yayınla on the edit page while a change is unsaved', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/YK']);
    allowStatusActions();
    (eventsApi.get as jest.Mock).mockResolvedValue({ ...workspaceEvent, status: 'draft' });
    await renderEventTab(<EventEditRoute />, '/events/e1/edit');
    const publish = await screen.findByRole('button', { name: 'Yayınla' });
    expect(publish).toBeEnabled();
    await user.type(await screen.findByDisplayValue('GeceKodu'), '!');
    expect(screen.getByRole('button', { name: 'Yayınla' })).toBeDisabled();
  });

  it('says a change is unsaved and asks before Vazgeç drops it', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/YK']);
    await renderEventTab(<EventEditRoute />, '/events/e1/edit');
    const name = await screen.findByDisplayValue('GeceKodu');
    expect(screen.queryByText('Kaydedilmemiş değişiklik var')).not.toBeInTheDocument();
    await user.type(name, ' 2026');
    expect(screen.getByText('Kaydedilmemiş değişiklik var')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Vazgeç' }));
    const ask = await screen.findByRole('alertdialog', {
      name: 'Kaydedilmemiş değişiklikler silinsin mi?',
    });
    expect(workspaceRouter.push).not.toHaveBeenCalled();
    await user.click(within(ask).getByRole('button', { name: 'Değişiklikleri sil' }));
    await waitFor(() => expect(workspaceRouter.push).toHaveBeenCalledWith('/events/e1'));
  });

  it('asks before a link to another page leaves unsaved work, and warns on closing the tab', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/YK']);
    await renderEventTab(<EventEditRoute />, '/events/e1/edit');
    await user.type(await screen.findByDisplayValue('GeceKodu'), '!');

    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    const away = document.createElement('a');
    away.href = '/events';
    away.textContent = 'Etkinlikler';
    document.body.appendChild(away);
    await user.click(away);
    expect(
      await screen.findByRole('alertdialog', { name: 'Kaydedilmemiş değişiklikler silinsin mi?' }),
    ).toBeInTheDocument();
    away.remove();
  });

  /** core's answer for a GECEKODU member: competition writes as the Team's Leader chose. */
  const memberCompetitors = (manage: boolean) =>
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      teams: [
        {
          team: 'GECEKODU',
          levels: ['MEMBER'],
          can: {
            'competitor.read': true,
            'competitor.create': manage,
            'competitor.update': manage,
            'competition.manage': manage,
          },
        },
      ],
    });

  it('lets a member manage competitions when core does (the Team setting on)', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU']);
    memberCompetitors(true);
    await renderEventTab(<EventCompetitionPage />, '/events/e1/competition');
    await screen.findByRole('heading', { name: 'GeceKodu' });
    // No competitor yet: the tab is there because core lets the member manage them
    await waitFor(() => expect(tabNames()).toContain('Yarışma'));
    expect((await screen.findAllByRole('button', { name: 'Yarışma ekle' })).length).toBeGreaterThan(
      0,
    );
  });

  it('shows a member no competitor tools once the Leader turned the setting off', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU']);
    memberCompetitors(false);
    await renderEventTab(<EventOverviewPage />);
    await screen.findByRole('heading', { name: 'GeceKodu' });
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    await act(async () => undefined);
    expect(tabNames()).not.toContain('Yarışma');
  });

  it('keeps the event’s own team among the owner choices of a Leader of the Team above', async () => {
    signInAs(['/UYELER/ARGE/WEBLAB/LIDERLER']);
    (eventsApi.get as jest.Mock).mockResolvedValue({ ...workspaceEvent, ownerTeam: 'MOBIL' });
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      teams: [
        { team: 'MOBIL', levels: ['LEADER'], can: { 'event.update': true } },
        { team: 'WEBLAB', levels: ['LEADER', 'MEMBER'], can: { 'event.update': true } },
      ],
    });
    await renderEventTab(<EventEditRoute />, '/events/e1/edit');
    await screen.findByRole('heading', { name: 'GeceKodu' });
    const owner = (await screen.findByRole('combobox', {
      name: 'Sahip ekip',
    })) as HTMLSelectElement;
    expect(owner.value).toBe('MOBIL');
    expect([...owner.options].map((option) => option.value)).toEqual(
      expect.arrayContaining(['MOBIL', 'WEBLAB']),
    );
  });

  it('holds the event’s Kaydet while a Düzenleyenler change is unsaved', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/YK']);
    (eventOrganizersApi.get as jest.Mock).mockResolvedValueOnce({
      ownerTeam: 'GECEKODU',
      ownerRule: 'members',
      teams: [
        { code: 'WEBLAB', name: 'WEBLAB', management: 'members', visibility: 'co_organizer' },
      ],
      people: [],
      canManage: true,
    });
    await renderEventTab(<EventEditRoute />, '/events/e1/edit');
    const section = document.getElementById('duzenleyenler') as HTMLElement;
    await user.selectOptions(
      await within(section).findByRole('combobox', { name: 'Görünüm' }),
      'helper',
    );
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));

    expect(
      await screen.findByText('Düzenleyenler değişikliği kaydedilmedi; önce kaydet ya da vazgeç.'),
    ).toBeInTheDocument();
    expect(saveEventWithSeason).not.toHaveBeenCalled();
    // Leaving asks once, for the whole page, though only Düzenleyenler changed
    const barCancel = screen
      .getAllByRole('button', { name: 'Vazgeç' })
      .find((button) => !section.contains(button)) as HTMLElement;
    await user.click(barCancel);
    expect(
      await screen.findAllByRole('alertdialog', {
        name: 'Kaydedilmemiş değişiklikler silinsin mi?',
      }),
    ).toHaveLength(1);
    expect(workspaceRouter.push).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    // Dropping the change lets the event save again
    await user.click(within(section).getByRole('button', { name: 'Vazgeç' }));
    expect(
      screen.queryByText('Düzenleyenler değişikliği kaydedilmedi; önce kaydet ya da vazgeç.'),
    ).not.toBeInTheDocument();
  });

  it('says the event was saved from the edit page and goes back to the event', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/YK']);
    (saveEventWithSeason as jest.Mock).mockResolvedValueOnce('e1');
    await renderEventTab(<EventEditRoute />, '/events/e1/edit');
    await screen.findByRole('heading', { name: 'GeceKodu' });
    await user.click(await screen.findByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByText('Etkinlik kaydedildi')).toBeInTheDocument();
    expect(workspaceRouter.push).toHaveBeenCalledWith('/events/e1');
    // The form it opened with goes along, so only the changed fields are written
    expect(saveEventWithSeason).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'GeceKodu' }),
      'e1',
      expect.objectContaining({ name: 'GeceKodu', location: 'YTÜ' }),
      // Nothing asked: the answer still goes, so core tells nobody
      { notifyTicketHolders: false },
    );
  });

  describe('a new time or place of a published event (core event.updated)', () => {
    // jsdom has no PointerEvent; base-ui's Checkbox sends one to its hidden input on a click
    beforeAll(() => {
      if (!('PointerEvent' in window)) {
        Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
      }
    });

    async function moveTheEvent(user: ReturnType<typeof userEvent.setup>) {
      await renderEventTab(<EventEditRoute />, '/events/e1/edit');
      await screen.findByRole('heading', { name: 'GeceKodu' });
      const place = await screen.findByRole('combobox', { name: 'Konum' });
      await user.clear(place);
      await user.type(place, 'Oditoryum');
      await user.click(screen.getByRole('button', { name: 'Kaydet' }));
      return screen.findByRole('alertdialog', { name: 'Etkinliğin yeri değişti' });
    }

    beforeEach(() => {
      signInAs(['/UYELER/YK']);
      (eventsApi.get as jest.Mock).mockResolvedValue({ ...workspaceEvent, ticketCount: 3 });
      (saveEventWithSeason as jest.Mock).mockResolvedValue('e1');
    });

    it('asks whether the ticket holders are told, ticked, and saves with the answer', async () => {
      const user = userEvent.setup();
      const question = await moveTheEvent(user);
      const box = within(question).getByRole('checkbox', {
        name: 'Bilet sahiplerine bildir (3 kişi)',
      });
      expect(box).toBeChecked();
      expect(saveEventWithSeason).not.toHaveBeenCalled();

      await user.click(within(question).getByRole('button', { name: 'Kaydet' }));

      await waitFor(() =>
        expect(saveEventWithSeason).toHaveBeenCalledWith(
          expect.objectContaining({ location: 'Oditoryum' }),
          'e1',
          expect.objectContaining({ location: 'YTÜ' }),
          { notifyTicketHolders: true },
        ),
      );
      expect(workspaceRouter.push).toHaveBeenCalledWith('/events/e1');
    });

    it('saves without telling when the box is cleared', async () => {
      const user = userEvent.setup();
      const question = await moveTheEvent(user);
      await user.click(within(question).getByRole('checkbox'));
      await user.click(within(question).getByRole('button', { name: 'Kaydet' }));

      await waitFor(() =>
        expect(saveEventWithSeason).toHaveBeenCalledWith(
          expect.anything(),
          'e1',
          expect.anything(),
          { notifyTicketHolders: false },
        ),
      );
    });

    it('saves nothing when the question is left', async () => {
      const user = userEvent.setup();
      const question = await moveTheEvent(user);
      await user.click(within(question).getByRole('button', { name: 'Vazgeç' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(saveEventWithSeason).not.toHaveBeenCalled();
      expect(workspaceRouter.push).not.toHaveBeenCalledWith('/events/e1');
    });

    it('asks for a new name too, unticked, listing what changed (core event.changed)', async () => {
      const user = userEvent.setup();
      await renderEventTab(<EventEditRoute />, '/events/e1/edit');
      await screen.findByRole('heading', { name: 'GeceKodu' });
      const name = screen.getByPlaceholderText('Etkinlik adı');
      await user.clear(name);
      await user.type(name, 'Gece Kodu 2026');
      await user.click(screen.getByRole('button', { name: 'Kaydet' }));
      const question = await screen.findByRole('alertdialog', { name: 'Ad değişti' });
      const box = within(question).getByRole('checkbox', {
        name: 'Bilet sahiplerine bildir (3 kişi)',
      });
      // Other details alone: unticked (core docs/event-updated-notification.md#other-details)
      expect(box).not.toBeChecked();
      await user.click(box);

      await user.click(within(question).getByRole('button', { name: 'Kaydet' }));

      await waitFor(() =>
        expect(saveEventWithSeason).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Gece Kodu 2026' }),
          'e1',
          expect.objectContaining({ name: 'GeceKodu' }),
          { notifyTicketHolders: true },
        ),
      );
    });

    it('saves a new name without telling when the unticked box is left', async () => {
      const user = userEvent.setup();
      await renderEventTab(<EventEditRoute />, '/events/e1/edit');
      await screen.findByRole('heading', { name: 'GeceKodu' });
      const name = screen.getByPlaceholderText('Etkinlik adı');
      await user.clear(name);
      await user.type(name, 'Gece Kodu 2026');
      await user.click(screen.getByRole('button', { name: 'Kaydet' }));
      const question = await screen.findByRole('alertdialog', { name: 'Ad değişti' });
      await user.click(within(question).getByRole('button', { name: 'Kaydet' }));

      await waitFor(() =>
        expect(saveEventWithSeason).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Gece Kodu 2026' }),
          'e1',
          expect.anything(),
          { notifyTicketHolders: false },
        ),
      );
    });

    it('does not ask for a draft', async () => {
      const user = userEvent.setup();
      (eventsApi.get as jest.Mock).mockResolvedValue({
        ...workspaceEvent,
        status: 'draft',
        ticketCount: 3,
      });
      await renderEventTab(<EventEditRoute />, '/events/e1/edit');
      await screen.findByRole('heading', { name: 'GeceKodu' });
      const place = await screen.findByRole('combobox', { name: 'Konum' });
      await user.clear(place);
      await user.type(place, 'Oditoryum');
      await user.click(screen.getByRole('button', { name: 'Kaydet' }));

      await waitFor(() =>
        expect(saveEventWithSeason).toHaveBeenCalledWith(
          expect.objectContaining({ location: 'Oditoryum' }),
          'e1',
          expect.anything(),
          { notifyTicketHolders: false },
        ),
      );
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
  });

  it('asks before deleting a draft, then offers Geri al that reopens it', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/YK']);
    allowStatusActions();
    (eventsApi.get as jest.Mock).mockResolvedValue({ ...workspaceEvent, status: 'draft' });
    (eventsApi.delete as jest.Mock).mockResolvedValueOnce(undefined);
    (eventsApi.restore as jest.Mock).mockResolvedValueOnce({ id: 'e1' });
    await renderEventTab(<EventProgramPage />, '/events/e1/program');
    await screen.findByRole('heading', { name: 'GeceKodu' });
    await user.click(await screen.findByRole('button', { name: 'Diğer eylemler' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sil…' }));
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

  it('shows a refused save in the save bar', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/YK']);
    (saveEventWithSeason as jest.Mock).mockRejectedValueOnce(
      new ProblemError(422, 'Unprocessable Content', {
        code: 'media_purpose_mismatch',
        fields: { mediaId: 'g1', role: 'event_cover', purpose: 'event_gallery' },
      }),
    );
    await renderEventTab(<EventEditRoute />, '/events/e1/edit');
    const save = await screen.findByRole('button', { name: 'Kaydet' });
    const dialog = save.closest('form') as HTMLElement;

    await user.click(save);

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Bu dosya Etkinlik galerisi için yüklenmiş; etkinlik kapağı olarak kullanılamaz. Dosyayı bu alan için yeniden yükle.',
    );
  });

  it('names the event a refused form is on, in the save bar and at the form', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/YK']);
    const formId = '0b6f1c1e-6a39-4d0f-9d0c-3a8c5d1e2f00';
    (eventsApi.get as jest.Mock).mockResolvedValue({
      ...workspaceEvent,
      formUrl: `https://forms.yildizskylab.com/${formId}`,
    });
    (saveEventWithSeason as jest.Mock).mockRejectedValueOnce(
      new ProblemError(409, 'Conflict', {
        code: 'form_in_use',
        fields: { formId, event: { id: 'e9', name: 'Gecekodu 2025', status: 'published' } },
      }),
    );
    await renderEventTab(<EventEditRoute />, '/events/e1/edit');
    const save = await screen.findByRole('button', { name: 'Kaydet' });
    const dialog = save.closest('form') as HTMLElement;

    await user.click(save);

    expect((await within(dialog).findAllByRole('alert'))[0]).toHaveTextContent(
      'Bu form şu etkinlikte kullanılıyor: Gecekodu 2025.',
    );
    expect(
      within(dialog).getByRole('link', { name: 'Gecekodu 2025 (yeni sekmede açılır)' }),
    ).toHaveAttribute('href', '/events/e9');
    expect(within(dialog).getByRole('link', { name: 'Bu formdan yeni form aç' })).toHaveAttribute(
      'href',
      expect.stringContaining(`fromForm=${formId}`),
    );
  });

  it('shows who edits the event Sertifikalar, without a certificate role', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU']);
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      teams: [{ team: 'GECEKODU', can: { 'event.update': true } }],
    });
    await renderEventTab(<EventOverviewPage />);
    await screen.findByRole('heading', { name: 'GeceKodu' });
    await waitFor(() => expect(tabNames()).toContain('Sertifikalar'));
  });

  it('keeps Sertifikalar from a member who neither edits the event nor holds a certificate role', async () => {
    signInAs(['/UYELER/ORGANIZASYON/GECEKODU']);
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      teams: [{ team: 'GECEKODU', can: { 'event.update': false } }],
    });
    await renderEventTab(<EventOverviewPage />);
    await screen.findByRole('heading', { name: 'GeceKodu' });
    await waitFor(() => expect(tabNames()).not.toContain('Sertifikalar'));
  });

  it('draws the template row in the Sertifika section and asks before leaving unsaved work for the editor', async () => {
    const user = userEvent.setup();
    signInAs(['/UYELER/YK']);
    (certificatesApi.eventTemplate as jest.Mock).mockResolvedValueOnce({
      resolution: {
        source: 'ownerTeam',
        template: {
          id: 't-team',
          name: 'GECEKODU sertifikası',
          ownerTeam: 'GECEKODU',
          system: false,
        },
        version: { version: 2 },
      },
      eventTemplate: null,
      choices: [],
    });
    (certificatesApi.createEventTemplate as jest.Mock).mockResolvedValue({ id: 't-own' });
    await renderEventTab(<EventEditRoute />, '/events/e1/edit');
    expect(await screen.findByText('GECEKODU ekip şablonu · v2')).toBeInTheDocument();

    await user.type(await screen.findByDisplayValue('GeceKodu'), ' 2026');
    await user.click(screen.getByRole('button', { name: 'Etkinliğe özel şablon oluştur' }));

    expect(certificatesApi.createEventTemplate).toHaveBeenCalledWith('e1', 'current');
    expect(
      await screen.findByRole('alertdialog', { name: 'Kaydedilmemiş değişiklikler silinsin mi?' }),
    ).toBeInTheDocument();
    expect(workspaceRouter.push).not.toHaveBeenCalledWith('/events/e1/certificate-template');
  });

  it('shows why the event did not load instead of its tabs', async () => {
    signInAs(['/UYELER/YK']);
    (eventsApi.get as jest.Mock).mockRejectedValue(
      new ProblemError(404, 'Not Found', { detail: 'event not found' }),
    );
    await renderEventTab(<EventProgramPage />, '/events/e1/program');
    expect(await screen.findByText('Etkinlik bulunamadı; silinmiş olabilir.')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});
