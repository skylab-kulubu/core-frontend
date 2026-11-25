import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import CertificateFontsPage from '@/app/(authorized)/certificates/fonts/page';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { certificatesApi } from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';
import { mediaApi } from '@/lib/api/media';

let mockUser = { id: 'yk', groups: ['/UYELER/YK'], roles: [] as string[] };

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/certificates/fonts',
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/lib/api/teams', () => ({
  teamsApi: { list: jest.fn().mockResolvedValue([{ team: 'ARTLAB' }, { team: 'WEBLAB' }]) },
}));
// Unreadable unless a test sets core's answer (the group rule stands)
jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn(() => Promise.reject(new TypeError('Failed to fetch'))) },
}));
jest.mock('@/lib/api/media', () => ({ mediaApi: { upload: jest.fn() } }));
jest.mock('@/lib/api/certificates', () => ({
  certificatesApi: {
    fonts: jest.fn(),
    createFont: jest.fn(),
    fontFile: jest.fn(),
    archiveFont: jest.fn(),
  },
}));

const CLUB_FONT = {
  id: 'f-club',
  ownerTeam: '',
  family: 'Brandon Grotesque',
  weight: 700,
  style: 'normal',
  mediaId: 'm-club',
  missingTurkish: '',
  uploadedBy: 'yk',
  createdAt: '2026-11-20T10:00:00Z',
};

const TEAM_FONT = {
  id: 'f-art',
  ownerTeam: 'ARTLAB',
  family: 'Gotham',
  weight: 400,
  style: 'italic',
  mediaId: 'm-art',
  missingTurkish: 'ğı',
  uploadedBy: 'someone',
  createdAt: '2026-11-21T10:00:00Z',
};

const fontFile = () => new File(['wOF2'], 'Gotham-Bold.woff2', { type: 'font/woff2' });

async function openUpload(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Yazı tipi yükle' }));
  return screen.findByRole('dialog', { name: 'Yazı tipi yükle' });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'yk', groups: ['/UYELER/YK'], roles: [] };
  window.history.replaceState(null, '', '/certificates/fonts');
  (certificatesApi.fonts as jest.Mock).mockResolvedValue([CLUB_FONT]);
  (certificatesApi.fontFile as jest.Mock).mockResolvedValue(new Blob(['x']));
  (mediaApi.upload as jest.Mock).mockResolvedValue({ id: 'upload-1' });
});

describe('Certificate fonts: the list', () => {
  it('lists the club fonts with the sample line, face, team and the Turkish letters', async () => {
    render(<CertificateFontsPage />);
    expect(await screen.findByText('Brandon Grotesque')).toBeInTheDocument();
    expect(certificatesApi.fonts).toHaveBeenCalledWith(undefined);
    expect(screen.getByText("Ağrı Dağı'nda gün ışığı · ĞÜŞİÖÇ ğüşıöç")).toHaveStyle({
      fontFamily: "'cf-m-club', sans-serif",
    });
    expect(screen.getByText('Kulüp geneli')).toBeInTheDocument();
    expect(screen.getByText('Tam')).toBeInTheDocument();
  });

  it("reads a team's fonts with the club's, and names the letters a font lacks", async () => {
    const user = userEvent.setup();
    (certificatesApi.fonts as jest.Mock).mockImplementation(async (team?: string) =>
      team === 'ARTLAB' ? [CLUB_FONT, TEAM_FONT] : [CLUB_FONT],
    );
    render(<CertificateFontsPage />);
    await screen.findByText('Brandon Grotesque');
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Ekip' }), 'ARTLAB');
    expect(await screen.findByText('Gotham')).toBeInTheDocument();
    expect(certificatesApi.fonts).toHaveBeenLastCalledWith('ARTLAB');
    expect(screen.getByText('eksik: ğ, ı')).toBeInTheDocument();
    expect(screen.getByText('400 italik')).toBeInTheDocument();
  });

  it('drops a slower answer for a team no longer shown', async () => {
    const user = userEvent.setup();
    let answerClub: (rows: unknown[]) => void = () => {};
    (certificatesApi.fonts as jest.Mock).mockImplementation((team?: string) =>
      team === 'ARTLAB'
        ? Promise.resolve([CLUB_FONT, TEAM_FONT])
        : new Promise((resolve) => {
            answerClub = resolve;
          }),
    );
    render(<CertificateFontsPage />);
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Ekip' }), 'ARTLAB');
    expect(await screen.findByText('Gotham')).toBeInTheDocument();
    answerClub([]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByText('Gotham')).toBeInTheDocument();
    expect(screen.queryByText('Henüz yazı tipi yok')).not.toBeInTheDocument();
  });

  it('says when there is none yet', async () => {
    (certificatesApi.fonts as jest.Mock).mockResolvedValue([]);
    render(<CertificateFontsPage />);
    expect(await screen.findByText('Henüz yazı tipi yok')).toBeInTheDocument();
  });

  it('shows no upload and no row menu to someone who may not add fonts', async () => {
    mockUser = { id: 'member', groups: ['/ARTLAB/UYELER'], roles: [] };
    (capabilitiesApi.get as jest.Mock).mockResolvedValueOnce({
      can: { 'media.uploadCertificateFont': false },
      teams: [{ team: 'ARTLAB', levels: ['MEMBER'], can: {} }],
    });
    (certificatesApi.fonts as jest.Mock).mockResolvedValue([CLUB_FONT, TEAM_FONT]);
    render(<CertificateFontsPage />);
    expect(await screen.findByText('Gotham')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yazı tipi yükle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eylemler/ })).not.toBeInTheDocument();
  });

  it('archives a font after saying published templates keep it', async () => {
    const user = userEvent.setup();
    (certificatesApi.archiveFont as jest.Mock).mockResolvedValue(undefined);
    render(<CertificateFontsPage />);
    await user.click(await screen.findByRole('button', { name: 'Brandon Grotesque: eylemler' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Arşivle' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Brandon Grotesque 700 arşivlensin mi?',
    });
    expect(confirm).toHaveTextContent('Yayınlanmış şablonlar etkilenmez; yeni şablonda seçilemez.');
    await user.click(within(confirm).getByRole('button', { name: 'Arşivle' }));
    await waitFor(() => expect(certificatesApi.archiveFont).toHaveBeenCalledWith('f-club'));
    await waitFor(() => expect(screen.queryByText('Brandon Grotesque')).not.toBeInTheDocument());
  });
});

describe('Certificate fonts: upload', () => {
  it('uploads the file as a certificate_font and adds it to the chosen team', async () => {
    const user = userEvent.setup();
    (certificatesApi.createFont as jest.Mock).mockResolvedValue({
      ...CLUB_FONT,
      id: 'f-new',
      family: 'Gotham',
      weight: 700,
    });
    render(<CertificateFontsPage />);
    const panel = await openUpload(user);
    const team = within(panel).getByRole('combobox', { name: 'Ekip' });
    expect(
      within(team)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Kulüp geneli', 'ARTLAB', 'WEBLAB']);
    await user.upload(within(panel).getByLabelText('Dosya'), fontFile());
    await user.click(within(panel).getByRole('button', { name: 'Yükle' }));
    await waitFor(() => expect(certificatesApi.createFont).toHaveBeenCalledWith('upload-1', ''));
    expect(mediaApi.upload).toHaveBeenCalledWith(expect.any(File), 'certificate_font');
    expect(await screen.findByText('Gotham 700 eklendi')).toBeInTheDocument();
  });

  it.each([
    ['font_unreadable', 400, 'Dosya okunamadı: TTF, OTF ya da WOFF2 bir yazı tipi olmalı.'],
    ['font_too_large', 400, "Yazı tipi 10 MB'tan büyük."],
    [
      'font_unsupported',
      400,
      'Değişken yazı tipi ya da koleksiyon (TTC) yüklenmez; tek bir kalınlığın dosyasını yükle.',
    ],
    ['font_embedding_restricted', 400, 'Bu yazı tipinin lisansı gömmeye izin vermiyor.'],
    ['font_exists', 409, 'Bu ekipte bu aile, kalınlık ve stilde bir yazı tipi zaten var.'],
    ['pdf_tools_unavailable', 503, 'Yazı tipi şu an denetlenemiyor; biraz sonra tekrar dene.'],
    ['busy', 503, 'Yazı tipi şu an denetlenemiyor; biraz sonra tekrar dene.'],
    ['', 503, 'Yazı tipi şu an denetlenemiyor; biraz sonra tekrar dene.'],
  ])('says %s in a short Turkish line', async (code, status, text) => {
    const user = userEvent.setup();
    (certificatesApi.createFont as jest.Mock).mockRejectedValue(
      new ProblemError(status, 'Refused', { code, fields: { fontId: 'f-club' } }),
    );
    render(<CertificateFontsPage />);
    const panel = await openUpload(user);
    await user.upload(within(panel).getByLabelText('Dosya'), fontFile());
    await user.click(within(panel).getByRole('button', { name: 'Yükle' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent(text);
    expect(panel).not.toHaveTextContent('Refused');
  });

  it("opens the upload from the editor's link with the PDF's family named", async () => {
    window.history.replaceState(null, '', '/certificates/fonts?aile=BrandonGrotesque');
    render(<CertificateFontsPage />);
    const panel = await screen.findByRole('dialog', { name: 'Yazı tipi yükle' });
    expect(panel).toHaveTextContent("PDF'teki yazı tipi: BrandonGrotesque");
  });
});
