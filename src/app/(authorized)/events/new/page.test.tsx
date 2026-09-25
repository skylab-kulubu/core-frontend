import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import NewEventPage from '@/app/(authorized)/events/new/page';
import { emptyEventForm } from '@/components/scheduling/EventEditor';
import { ProblemError } from '@/lib/api/core';
import { EVENT_DRAFT_PREFIX } from '@/lib/event-draft';
import { EventSaveIncomplete, saveEventWithSeason } from '@/lib/scheduling/save-event';

const mockPush = jest.fn();
const mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', groups: ['/UYELER/YK'], roles: [] } }),
}));

jest.mock('@/lib/api/teams', () => ({ teamsApi: { list: jest.fn().mockResolvedValue([]) } }));
jest.mock('@/lib/api/seasons', () => ({ seasonsApi: { list: jest.fn().mockResolvedValue([]) } }));
jest.mock('@/lib/api/identity', () => ({
  identityApi: { listUsers: jest.fn().mockResolvedValue([]) },
}));
jest.mock('@/lib/api/events', () => ({ eventsApi: { list: jest.fn().mockResolvedValue([]) } }));

jest.mock('@/lib/scheduling/save-event', () => ({
  ...jest.requireActual('@/lib/scheduling/save-event'),
  saveEventWithSeason: jest.fn(),
}));

const save = saveEventWithSeason as jest.Mock;

describe('Yeni etkinlik', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(
      `${EVENT_DRAFT_PREFIX}:new`,
      JSON.stringify({
        ...emptyEventForm(''),
        name: 'Gecekodu',
        location: 'YTÜ',
        imageIds: ['g1', 'g2'],
        reservedId: '11111111-1111-4111-8111-111111111111',
      }),
    );
  });

  it('updates the created Event on retry when its gallery failed, keeping the gallery', async () => {
    const user = userEvent.setup();
    save
      .mockRejectedValueOnce(
        new EventSaveIncomplete(
          'e-new',
          new ProblemError(422, 'Unprocessable Content', {
            code: 'media_not_linkable',
            fields: { mediaId: 'g2', role: 'event_gallery' },
          }),
        ),
      )
      .mockResolvedValueOnce('e-new');
    render(<NewEventPage />);

    const saveButton = await screen.findByRole('button', { name: 'Kaydet' });
    await user.click(saveButton);

    const form = saveButton.closest('form') as HTMLElement;
    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'Etkinlik oluşturuldu, ama kaydı tamamlanamadı: Seçilen dosya artık kullanılamıyor: silinmiş, arşivlenmiş ya da kaydedilmeden süresi dolmuş. Dosyayı yeniden yükle. Kaydet bu etkinliği günceller; yeni etkinlik açılmaz.',
    );
    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({ imageIds: ['g1', 'g2'] }),
      undefined,
    );
    expect(mockPush).not.toHaveBeenCalled();

    await user.click(saveButton);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/events/e-new'));
    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({ imageIds: ['g1', 'g2'] }),
      'e-new',
    );
  });
});
