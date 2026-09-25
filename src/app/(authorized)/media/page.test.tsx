import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import MediaPage from '@/app/(authorized)/media/page';
import { eventsApi } from '@/lib/api/events';
import { mediaApi, type Media } from '@/lib/api/media';
import type { MediaPurpose } from '@/lib/media-purposes';

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { groups: ['/UYELER/YK'], roles: [] } }),
}));

jest.mock('@/lib/api/media', () => ({
  mediaApi: { list: jest.fn(), upload: jest.fn(), remove: jest.fn() },
}));

jest.mock('@/lib/api/events', () => ({
  eventsApi: { list: jest.fn() },
}));

function media(id: string, purpose: MediaPurpose, extra: Partial<Media> = {}): Media {
  return {
    id,
    name: `${id}.png`,
    type: 'image/png',
    url: `images/${id}`,
    size: 1,
    uploadedBy: 'u1',
    kind: 'image',
    purpose,
    createdAt: '2026-09-26T08:00:00Z',
    updatedAt: '2026-09-26T08:00:00Z',
    ...extra,
  };
}

describe('Medya', () => {
  beforeEach(() => {
    (eventsApi.list as jest.Mock).mockResolvedValue([]);
  });

  it('never lists private Media', async () => {
    (mediaApi.list as jest.Mock).mockResolvedValue([
      media('kapak', 'event_cover'),
      media('cv', 'answer_file'),
      media('oyun', 'answer_file_large'),
      media('sertifika', 'certificate_asset'),
    ]);

    render(<MediaPage />);

    expect(await screen.findByText('kapak.png')).toBeInTheDocument();
    expect(screen.queryByText('cv.png')).not.toBeInTheDocument();
    expect(screen.queryByText('oyun.png')).not.toBeInTheDocument();
    expect(screen.queryByText('sertifika.png')).not.toBeInTheDocument();
  });

  it("shows each Media's purpose, status and Owner team", async () => {
    (mediaApi.list as jest.Mock).mockResolvedValue([
      media('kapak', 'event_cover', { status: 'attached' }),
      media('eski', 'legacy'),
    ]);
    (eventsApi.list as jest.Mock).mockResolvedValue([
      { id: 'e1', name: 'Gecekodu', ownerTeam: 'GECEKODU', coverImageId: 'kapak', images: [] },
    ]);

    render(<MediaPage />);

    expect(
      await screen.findByText(/^Etkinlik kapağı · GECEKODU · https:\/\/cdn\./),
    ).toBeInTheDocument();
    expect(screen.getByText('Bağlı')).toBeInTheDocument();
    expect(screen.getByText(/^Eski kayıt \(legacy\) · https:\/\/cdn\./)).toBeInTheDocument();
  });

  it('shows when a pending Media expires, and no wait for legacy Media that never expire', async () => {
    (mediaApi.list as jest.Mock).mockResolvedValue([
      media('yeni', 'event_gallery', { status: 'pending', expiresAt: '2026-09-27T11:00:00Z' }),
      media('eski', 'legacy', { status: 'pending' }),
    ]);

    render(<MediaPage />);

    expect(
      await screen.findByText(/^Etkinlik galerisi · Bağlanmazsa silinir: 27 Eyl 2026 14:00 · /),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Beklemede')).toHaveLength(1);
    expect(screen.getByText(/^Eski kayıt \(legacy\) · https:/)).toBeInTheDocument();
  });

  it('filters by purpose', async () => {
    const user = userEvent.setup();
    (mediaApi.list as jest.Mock).mockResolvedValue([
      media('kapak', 'event_cover'),
      media('galeri', 'event_gallery'),
      media('eski', 'legacy'),
      media('cv', 'answer_file'),
    ]);
    render(<MediaPage />);
    await screen.findByText('kapak.png');

    const purpose = screen.getByRole('combobox', { name: 'Amaç' });
    expect(
      within(purpose)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Tüm amaçlar', 'Etkinlik kapağı', 'Etkinlik galerisi', 'Eski kayıt (legacy)']);
    await user.selectOptions(purpose, 'Etkinlik galerisi');

    expect(screen.getByText('galeri.png')).toBeInTheDocument();
    expect(screen.queryByText('kapak.png')).not.toBeInTheDocument();
    expect(screen.queryByText('eski.png')).not.toBeInTheDocument();
  });

  it('filters by the Owner team whose Events use the Media', async () => {
    const user = userEvent.setup();
    (mediaApi.list as jest.Mock).mockResolvedValue([
      media('gk-kapak', 'event_cover'),
      media('gk-galeri', 'event_gallery'),
      media('agc-kapak', 'event_cover'),
      media('bos', 'event_gallery'),
    ]);
    (eventsApi.list as jest.Mock).mockResolvedValue([
      {
        id: 'e1',
        name: 'Gecekodu',
        ownerTeam: 'GECEKODU',
        coverImageId: 'gk-kapak',
        images: [{ id: 'gk-galeri' }],
      },
      { id: 'e2', name: 'AGC', ownerTeam: 'AGC', coverImageId: 'agc-kapak', images: [] },
    ]);
    render(<MediaPage />);
    await screen.findByText('gk-kapak.png');

    const team = screen.getByRole('combobox', { name: 'Sahip ekip' });
    expect(
      within(team)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Tüm ekipler', 'AGC', 'GECEKODU']);
    await user.selectOptions(team, 'GECEKODU');

    expect(screen.getByText('gk-kapak.png')).toBeInTheDocument();
    expect(screen.getByText('gk-galeri.png')).toBeInTheDocument();
    expect(screen.queryByText('agc-kapak.png')).not.toBeInTheDocument();
    expect(screen.queryByText('bos.png')).not.toBeInTheDocument();
  });

  it('counts archived Events when working out the Owner team', async () => {
    (mediaApi.list as jest.Mock).mockResolvedValue([media('eski-kapak', 'event_cover')]);
    (eventsApi.list as jest.Mock).mockImplementation(async (_team?: string, lifecycle?: string) =>
      lifecycle === 'inactive'
        ? [{ id: 'e9', name: 'AGC 2025', ownerTeam: 'AGC', coverImageId: 'eski-kapak', images: [] }]
        : [],
    );

    render(<MediaPage />);

    expect(await screen.findByText(/^Etkinlik kapağı · AGC · /)).toBeInTheDocument();
  });

  it('says so when the Owner teams cannot be read, and still lists the Media', async () => {
    (mediaApi.list as jest.Mock).mockResolvedValue([media('kapak', 'event_cover')]);
    (eventsApi.list as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'));

    render(<MediaPage />);

    expect(await screen.findByText('kapak.png')).toBeInTheDocument();
    expect(
      screen.getByText('Sahip ekipler okunamadı; ekip bilgisi ve ekip filtresi eksik.'),
    ).toBeInTheDocument();
  });
});
