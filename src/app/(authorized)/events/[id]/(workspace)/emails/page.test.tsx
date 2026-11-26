import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EventEmailsPage from '@/app/(authorized)/events/[id]/(workspace)/emails/page';
import type { EventFormState } from '@/components/scheduling/EventEditor';
import { eventsApi } from '@/lib/api/events';
import { saveEventWithSeason } from '@/lib/scheduling/save-event';
import {
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

// jsdom has no PointerEvent; base-ui's switch sends one to its hidden input on a click
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
  }
});

describe('Postalar', () => {
  // core answers what was saved: the next read gives it back
  let saved: Record<string, unknown>;
  beforeEach(() => {
    primeEventWorkspace();
    signInAs(['/UYELER/YK']);
    saved = {
      ...workspaceEvent,
      status: 'draft',
      attendanceWelcomeMail: true,
      attendanceRecordedMail: true,
      attendeeNote: 'Wi-Fi: SKYLAB',
      feedbackAutoSend: true,
      attendanceRule: 'once',
      attendanceAutoFinalize: true,
    };
    (eventsApi.get as jest.Mock).mockImplementation(() => Promise.resolve({ ...saved }));
    (saveEventWithSeason as jest.Mock).mockImplementation(async (values: EventFormState) => {
      saved = { ...saved, ...values };
      return 'e1';
    });
  });

  it('lists every automatic mail, the ticket and certificate ones linking to their settings', async () => {
    await renderEventTab(<EventEmailsPage />, '/events/e1/emails');
    const first = await screen.findByRole('listitem', { name: 'Bilet postası' });
    const list = first.closest('ul') as HTMLElement;
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((row) => row.getAttribute('aria-label')),
    ).toEqual([
      'Bilet postası',
      'Hoş geldin postası',
      'Katılım postası',
      'Geri bildirim postası',
      'Sertifika postası',
    ]);
    expect(within(list).getByRole('link', { name: /Kayıt ayarları/ })).toHaveAttribute(
      'href',
      '/events/e1/participants/settings#bilet',
    );
    expect(within(list).getByRole('link', { name: /Sertifikalar/ })).toHaveAttribute(
      'href',
      '/events/e1/certificates',
    );
    expect(screen.getByText('Katılımcı notu: Wi-Fi: SKYLAB')).toBeInTheDocument();
  });

  it('saves a switch at once, only its own field, and offers Geri al', async () => {
    const user = userEvent.setup();
    await renderEventTab(<EventEmailsPage />, '/events/e1/emails');
    await user.click(await screen.findByRole('switch', { name: 'Katılım postası' }));
    await waitFor(() =>
      expect(saveEventWithSeason).toHaveBeenCalledWith(
        expect.objectContaining({ attendanceRecordedMail: false, attendanceWelcomeMail: true }),
        'e1',
        expect.objectContaining({ attendanceRecordedMail: true }),
        { notifyTicketHolders: false },
      ),
    );
    expect(await screen.findByText('Katılım postası kapatıldı')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Katılım postası' })).not.toBeChecked(),
    );

    await user.click(screen.getByRole('button', { name: 'Geri al' }));
    await waitFor(() =>
      expect(saveEventWithSeason).toHaveBeenLastCalledWith(
        expect.objectContaining({ attendanceRecordedMail: true }),
        'e1',
        expect.objectContaining({ attendanceRecordedMail: false }),
        { notifyTicketHolders: false },
      ),
    );
    expect(await screen.findByText('Katılım postası açıldı')).toBeInTheDocument();
  });

  it('edits the welcome mail’s note in a drawer saved by its own Kaydet', async () => {
    const user = userEvent.setup();
    await renderEventTab(<EventEmailsPage />, '/events/e1/emails');
    await user.click(await screen.findByRole('button', { name: 'Hoş geldin postasını düzenle' }));
    const drawer = await screen.findByRole('dialog', { name: 'Hoş geldin postası' });
    const note = within(drawer).getByRole('textbox', { name: 'Katılımcı notu' });
    await user.clear(note);
    await user.type(note, 'Salon B');
    await user.click(within(drawer).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() =>
      expect(saveEventWithSeason).toHaveBeenCalledWith(
        expect.objectContaining({ attendeeNote: 'Salon B' }),
        'e1',
        expect.objectContaining({ attendeeNote: 'Wi-Fi: SKYLAB' }),
        { notifyTicketHolders: false },
      ),
    );
  });
});
