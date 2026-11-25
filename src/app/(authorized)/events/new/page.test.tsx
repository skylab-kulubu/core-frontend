import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import NewEventPage from '@/app/(authorized)/events/new/page';
import { emptyEventForm } from '@/components/scheduling/EventEditor';
import { ProblemError } from '@/lib/api/core';
import { EVENT_DRAFT_PREFIX } from '@/lib/event-draft';
import { EventSaveIncomplete, saveEventWithSeason } from '@/lib/scheduling/save-event';

const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams({ formUrl: 'https://forms.example.com/f/gecekodu' });

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

// A test may hold core's capabilities back (loading), then let them in
type EventCreate = ReturnType<typeof import('@/lib/use-event-create').useEventCreate>;
let mockEventCreate: EventCreate | null = null;
jest.mock('@/lib/use-event-create', () => {
  const actual = jest.requireActual('@/lib/use-event-create');
  return {
    useEventCreate: (groups: string[]) => mockEventCreate ?? actual.useEventCreate(groups),
  };
});

jest.mock('@/lib/scheduling/save-event', () => ({
  ...jest.requireActual('@/lib/scheduling/save-event'),
  saveEventWithSeason: jest.fn(),
}));

const save = saveEventWithSeason as jest.Mock;

describe('Yeni etkinlik', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEventCreate = null;
    mockSearchParams = new URLSearchParams({ formUrl: 'https://forms.example.com/f/gecekodu' });
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

    const saveButton = await screen.findByRole('button', { name: 'Oluştur' });
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
    expect(await screen.findByText('Etkinlik oluşturuldu')).toBeInTheDocument();
    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({ imageIds: ['g1', 'g2'] }),
      'e-new',
    );
  });

  it('opens the whole form in sections on its own, no return from Skyforms needed', async () => {
    mockSearchParams = new URLSearchParams();
    sessionStorage.clear();
    const user = userEvent.setup();
    render(<NewEventPage />);
    const sections = await screen.findByRole('navigation', { name: 'Bölümler' });
    expect(within(sections).getAllByRole('link')).toHaveLength(7);
    await user.type(screen.getByLabelText('Ad'), 'Gece Kodu 2026');
    expect(screen.getByText('Kaydedilmemiş değişiklik var')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Oluştur' }));
    const form = screen.getByRole('button', { name: 'Oluştur' }).closest('form') as HTMLElement;
    expect(await within(form).findByRole('alert')).toHaveTextContent('Konum gerekli.');
    expect(save).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('asks before Vazgeç drops typed work', async () => {
    mockSearchParams = new URLSearchParams();
    sessionStorage.clear();
    const user = userEvent.setup();
    render(<NewEventPage />);
    await user.click(await screen.findByRole('button', { name: 'Vazgeç' }));
    // Nothing typed: no question
    expect(mockPush).toHaveBeenCalledWith('/events');
    mockPush.mockClear();

    await user.type(screen.getByLabelText('Ad'), 'Gece');
    await user.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(
      await screen.findByRole('alertdialog', { name: 'Kaydedilmemiş değişiklikler silinsin mi?' }),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('drops the kept draft with "Değişiklikleri sil": the page opens empty again', async () => {
    mockSearchParams = new URLSearchParams();
    sessionStorage.clear();
    const user = userEvent.setup();
    const { unmount } = render(<NewEventPage />);
    await user.type(await screen.findByLabelText('Ad'), 'Gece');
    expect(sessionStorage.getItem(`${EVENT_DRAFT_PREFIX}:new`)).toContain('Gece');
    await user.click(screen.getByRole('button', { name: 'Vazgeç' }));
    const ask = await screen.findByRole('alertdialog', {
      name: 'Kaydedilmemiş değişiklikler silinsin mi?',
    });
    await user.click(within(ask).getByRole('button', { name: 'Değişiklikleri sil' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/events'));
    expect(sessionStorage.getItem(`${EVENT_DRAFT_PREFIX}:new`)).toBeNull();
    unmount();

    render(<NewEventPage />);
    expect(await screen.findByLabelText('Ad')).toHaveValue('');
    expect(screen.queryByText('Kaydedilmemiş değişiklik var')).not.toBeInTheDocument();
  });

  it('waits for core’s capabilities: a YK member who leads a team opens a clean form, no owner', async () => {
    mockSearchParams = new URLSearchParams();
    sessionStorage.clear();
    mockEventCreate = {
      canCreate: true,
      privilegedWriter: false,
      leaderTeams: ['WEBLAB'],
      ready: false,
    };
    const { rerender } = render(<NewEventPage />);
    mockEventCreate = { ...mockEventCreate, privilegedWriter: true, ready: true };
    rerender(<NewEventPage />);
    expect(await screen.findByRole('navigation', { name: 'Bölümler' })).toBeInTheDocument();
    expect(screen.queryByText('Kaydedilmemiş değişiklik var')).not.toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem(`${EVENT_DRAFT_PREFIX}:new`) ?? '{}').ownerTeam).toBe(
      '',
    );
  });
});
