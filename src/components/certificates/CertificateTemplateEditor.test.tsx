import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {
  CertificateTemplateEditor,
  emptyCertificateDraft,
} from '@/components/certificates/CertificateTemplateEditor';
import { certificatesApi } from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';
import { mediaApi } from '@/lib/api/media';
import { backgroundNaturalSize } from '@/lib/background-size';

const mockReplace = jest.fn();
let mockCurrentUser = {
  id: 'admin-1',
  username: 'admin',
  email: 'admin@example.com',
  firstName: 'SKY',
  lastName: 'Admin',
  roles: [] as string[],
  groups: ['/ADMIN'],
};

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockCurrentUser }),
}));

jest.mock('@/lib/api/certificates', () => ({
  certificatesApi: {
    template: jest.fn(),
    updateTemplate: jest.fn(),
    createTemplate: jest.fn(),
    publishTemplate: jest.fn(),
    previewTemplate: jest.fn(),
  },
}));

jest.mock('@/lib/api/media', () => ({
  mediaApi: { get: jest.fn(), upload: jest.fn() },
}));

jest.mock('@/lib/background-size', () => ({ backgroundNaturalSize: jest.fn() }));

const IMAGE_BACKGROUND = {
  id: 'bg-1',
  name: 'arka-plan.png',
  type: 'image/png',
  url: 'https://cdn.example.test/files/arka-plan.png',
  kind: 'IMAGE',
};

/** The template's draft with a 16:9 image under the A4 landscape page. */
function withImageBackground(placement?: object) {
  const draft = emptyCertificateDraft();
  (certificatesApi.template as jest.Mock).mockResolvedValue({
    id: 'tpl-1',
    name: 'Görselli şablon',
    ownerTeam: '',
    sourceKind: 'upload',
    sourceRef: '',
    sourceEditUrl: '',
    draftLayout: { ...draft.layout, backgroundMediaId: 'bg-1', backgroundPlacement: placement },
    system: true,
  });
  (mediaApi.get as jest.Mock).mockResolvedValue(IMAGE_BACKGROUND);
  (backgroundNaturalSize as jest.Mock).mockResolvedValue({ width: 1920, height: 1080 });
}

const backgroundImage = () => document.querySelector('img[data-background]') as HTMLElement;
/** A side of the background's box on the canvas, in % of the page. */
const bgBox = (side: 'left' | 'top' | 'width' | 'height') =>
  Number.parseFloat(backgroundImage().style[side]);

describe('CertificateTemplateEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = {
      id: 'admin-1',
      username: 'admin',
      email: 'admin@example.com',
      firstName: 'SKY',
      lastName: 'Admin',
      roles: [],
      groups: ['/ADMIN'],
    };
    const draft = emptyCertificateDraft();
    (certificatesApi.template as jest.Mock).mockResolvedValue({
      id: 'system-default',
      name: 'SKY LAB Varsayılan Sertifika',
      ownerTeam: '',
      sourceKind: 'sky',
      sourceRef: 'system-default',
      sourceEditUrl: '',
      draftLayout: draft.layout,
      system: true,
    });
  });

  it('lets a privileged admin edit the system default template', async () => {
    render(<CertificateTemplateEditor templateId="system-default" />);

    const name = await screen.findByLabelText('Şablon adı');
    await waitFor(() => expect(name).toHaveValue('SKY LAB Varsayılan Sertifika'));
    expect(name).toBeEnabled();
    expect(screen.queryByText(/Bu şablon salt okunur/)).not.toBeInTheDocument();
  });

  it('keeps the system default read-only for an ordinary member', async () => {
    mockCurrentUser = { ...mockCurrentUser, groups: ['/UYELER/ARGE/WEBLAB'] };

    render(<CertificateTemplateEditor templateId="system-default" />);

    const name = await screen.findByLabelText('Şablon adı');
    await waitFor(() => expect(name).toHaveValue('SKY LAB Varsayılan Sertifika'));
    expect(name).toBeDisabled();
    expect(screen.getByText(/Bu şablon salt okunur/)).toBeInTheDocument();
  });

  it('shows the Canva steps in one line: link, export, upload', async () => {
    const user = userEvent.setup();
    render(<CertificateTemplateEditor templateId="system-default" />);

    await screen.findByDisplayValue('SKY LAB Varsayılan Sertifika');
    await user.selectOptions(screen.getByLabelText('Tasarım kaynağı'), 'canva');
    await user.type(
      screen.getByLabelText('Kaynak bağlantısı'),
      'https://www.canva.com/design/example/edit',
    );

    const steps = screen.getByRole('list', { name: 'Canva adımları' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
    expect(steps).toHaveTextContent('3 · Dosyayı yükle');
    expect(screen.getByText('Canva dosyasını yükle')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Canva'da aç/ })).toHaveAttribute(
      'href',
      'https://www.canva.com/design/example/edit',
    );
  });

  it('offers a broad server-safe font library for editable text layers', async () => {
    const user = userEvent.setup();
    render(<CertificateTemplateEditor templateId="system-default" />);

    await screen.findByDisplayValue('SKY LAB Varsayılan Sertifika');
    const recipientLayers = screen.getAllByRole('button', { name: 'Katılımcı adı' });
    const layerListButton = recipientLayers.find((button) => button.className.includes('truncate'));
    expect(layerListButton).toBeDefined();
    await user.click(layerListButton!);

    const fontSelect = screen.getByLabelText('Yazı tipi');
    const options = within(fontSelect)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual(
      expect.arrayContaining([
        'Arial',
        'Carlito',
        'Noto Sans Display',
        'DejaVu Sans Condensed',
        'Caladea',
        'Noto Serif Display',
        'Liberation Mono',
      ]),
    );
    expect(options.length).toBeGreaterThanOrEqual(18);
  });

  it('lets the designer delete the verification QR and the Event name, and keeps the recipient', async () => {
    const user = userEvent.setup();
    render(<CertificateTemplateEditor templateId="system-default" />);

    await screen.findByDisplayValue('SKY LAB Varsayılan Sertifika');
    const layer = (name: string) =>
      screen
        .getAllByRole('button', { name })
        .find((button) => button.className.includes('truncate'));
    expect(layer('Doğrulama QR')).toBeDefined();
    // The QR is the only way to verify yet: it cannot go, and the panel says why
    await user.click(layer('Doğrulama QR')!);
    const remove = screen.getByRole('button', { name: /Katmanı sil/ });
    expect(remove).toBeDisabled();
    expect(remove).toHaveAccessibleDescription('QR ya da sertifika kodundan biri kalmalı.');

    // With the serial on the certificate the QR may go
    await user.click(
      within(screen.getByRole('complementary', { name: 'Katman ekle' })).getByRole('button', {
        name: /Sertifika kodu/,
      }),
    );
    await user.click(layer('Doğrulama QR')!);
    await user.click(screen.getByRole('button', { name: /Katmanı sil/ }));
    expect(layer('Doğrulama QR')).toBeUndefined();

    await user.click(layer('Katılımcı adı')!);
    expect(screen.queryByRole('button', { name: /Katmanı sil/ })).not.toBeInTheDocument();
    expect(screen.getByText('Zorunlu katman')).toBeInTheDocument();

    // The Event's name may go (ADR-0040 addendum 2026-11-25): a background may print it
    await user.click(layer('Etkinlik adı')!);
    await user.click(screen.getByRole('button', { name: /Katmanı sil/ }));
    expect(layer('Etkinlik adı')).toBeUndefined();
  });

  it('accepts a one-page PDF as a vector certificate background', async () => {
    const user = userEvent.setup();
    (mediaApi.upload as jest.Mock).mockResolvedValue({
      id: 'pdf-background',
      name: 'certificate.pdf',
      type: 'application/pdf',
      url: 'https://cdn.example.test/files/certificate.pdf',
      kind: 'FILE',
    });
    render(<CertificateTemplateEditor templateId="system-default" />);

    await screen.findByDisplayValue('SKY LAB Varsayılan Sertifika');
    await user.selectOptions(screen.getByLabelText('Tasarım kaynağı'), 'canva');
    const input = screen.getByLabelText('Canva dosyasını yükle');
    expect(input).toHaveAttribute('accept', expect.stringContaining('application/pdf'));

    const pdf = new File(['%PDF-1.7 example'], 'certificate.pdf', {
      type: 'application/pdf',
    });
    await user.upload(input, pdf);

    expect(mediaApi.upload).toHaveBeenCalledWith(pdf);
    expect(await screen.findByText('3 · Dosyayı yükle ✓')).toBeInTheDocument();
    expect(screen.getByTitle('PDF arka plan önizlemesi')).toBeInTheDocument();
    // A PDF is placed by ticket 07: no placement, no page fitting yet
    expect(screen.getByText('PDF yerleşimi yakında')).toBeInTheDocument();
    expect(screen.queryByLabelText('Yerleşim')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sayfayı arka plana uydur' })).toBeNull();
    expect(backgroundNaturalSize).not.toHaveBeenCalled();
  });

  it('explains a save core refused for its Media in Turkish', async () => {
    const user = userEvent.setup();
    (certificatesApi.updateTemplate as jest.Mock).mockRejectedValue(
      new ProblemError(422, 'Unprocessable Content', {
        code: 'media_not_linkable',
        detail:
          'The Media does not exist, is archived or purged, or expired before anything used it.',
        fields: { mediaId: 'bg-1', role: 'certificate_asset' },
      }),
    );
    render(<CertificateTemplateEditor templateId="system-default" />);

    await screen.findByDisplayValue('SKY LAB Varsayılan Sertifika');
    await user.click(screen.getByRole('button', { name: /Taslağı kaydet/ }));

    expect(
      await screen.findByText(
        'Seçilen dosya artık kullanılamıyor: silinmiş, arşivlenmiş ya da kaydedilmeden süresi dolmuş. Dosyayı yeniden yükle.',
      ),
    ).toBeInTheDocument();
  });

  it('places text on the canvas by its alignment, as the PDF does', async () => {
    const draft = emptyCertificateDraft();
    const text = (id: string, label: string, align?: 'left' | 'center' | 'right') => ({
      id,
      kind: 'staticText' as const,
      text: label,
      x: 40,
      y: 40,
      width: 400,
      height: 60,
      fontSize: 24,
      align,
      fit: 'shrink' as const,
    });
    (certificatesApi.template as jest.Mock).mockResolvedValue({
      id: 'system-default',
      name: 'SKY LAB Varsayılan Sertifika',
      ownerTeam: '',
      sourceKind: 'sky',
      sourceRef: 'system-default',
      sourceEditUrl: '',
      draftLayout: {
        ...draft.layout,
        elements: [
          text('l', 'Sola yaslı', 'left'),
          text('c', 'Ortalı', 'center'),
          text('r', 'Sağa yaslı', 'right'),
          text('d', 'Hizasız'),
        ],
      },
      system: true,
    });
    render(<CertificateTemplateEditor templateId="system-default" />);

    const box = async (label: string) => (await screen.findByText(label)).closest('button');
    expect(await box('Sola yaslı')).toHaveClass('justify-start');
    expect(await box('Ortalı')).toHaveClass('justify-center-safe');
    expect(await box('Sağa yaslı')).toHaveClass('justify-end-safe');
    expect(await box('Hizasız')).toHaveClass('justify-start');
    for (const label of ['Sola yaslı', 'Sağa yaslı', 'Hizasız']) {
      expect(await box(label)).not.toHaveClass('justify-center');
    }
  });
  it('draws an old layout covered and centred, and moves the image box with the fit', async () => {
    const user = userEvent.setup();
    withImageBackground();
    render(<CertificateTemplateEditor templateId="tpl-1" />);

    await screen.findByDisplayValue('Görselli şablon');
    // No placement: as core prints it today (cover, centre)
    await waitFor(() => expect(bgBox('width')).toBeCloseTo(125.695, 2));
    expect(bgBox('left')).toBeCloseTo(-12.848, 2);
    expect(bgBox('top')).toBeCloseTo(0, 2);
    expect(screen.getByLabelText('Yerleşim')).toHaveValue('cover');

    await user.selectOptions(screen.getByLabelText('Yerleşim'), 'contain');
    expect(bgBox('width')).toBeCloseTo(100, 2);
    expect(bgBox('top')).toBeCloseTo(10.221, 2);

    await user.click(screen.getByRole('button', { name: 'Sol üst' }));
    expect(bgBox('top')).toBeCloseTo(0, 2);
    expect(screen.getByRole('button', { name: 'Sol üst' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Ortala' }));
    expect(screen.getByRole('button', { name: 'Orta' })).toHaveAttribute('aria-pressed', 'true');

    const scale = screen.getByLabelText('Ölçek (%)');
    expect(scale).toBeEnabled();
    await user.selectOptions(screen.getByLabelText('Yerleşim'), 'fill');
    expect(bgBox('width')).toBeCloseTo(100, 2);
    expect(bgBox('height')).toBeCloseTo(100, 2);
    expect(scale).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sol üst' })).toBeDisabled();
  });

  it('saves the placement in range, scale 1 for fill', async () => {
    const user = userEvent.setup();
    withImageBackground({ fit: 'contain', x: 0, y: 0.5, scale: 2 });
    (certificatesApi.updateTemplate as jest.Mock).mockImplementation(async (id, body) => ({
      id,
      draftLayout: body.layout,
    }));
    render(<CertificateTemplateEditor templateId="tpl-1" />);

    await screen.findByDisplayValue('Görselli şablon');
    await waitFor(() => expect(screen.getByLabelText('Ölçek (%)')).toHaveValue(200));
    await user.selectOptions(screen.getByLabelText('Yerleşim'), 'fill');
    await user.click(screen.getByRole('button', { name: /Taslağı kaydet/ }));

    await waitFor(() => expect(certificatesApi.updateTemplate).toHaveBeenCalled());
    expect((certificatesApi.updateTemplate as jest.Mock).mock.calls[0][1].layout).toMatchObject({
      backgroundMediaId: 'bg-1',
      backgroundPlacement: { fit: 'fill', x: 0, y: 0.5, scale: 1 },
    });
    expect(screen.queryByText('Yerleşim kaydedilmedi; core güncel değil.')).toBeNull();
  });

  it('says so and does not publish when core drops the placement', async () => {
    const user = userEvent.setup();
    withImageBackground({ fit: 'contain', x: 0.5, y: 0.5, scale: 1 });
    // A core before backgroundPlacement reads the draft without it
    (certificatesApi.updateTemplate as jest.Mock).mockImplementation(async (id, body) => {
      const { backgroundPlacement: _dropped, ...layout } = body.layout;
      return { id, draftLayout: layout };
    });
    render(<CertificateTemplateEditor templateId="tpl-1" />);

    await screen.findByDisplayValue('Görselli şablon');
    await waitFor(() => expect(bgBox('top')).toBeCloseTo(10.221, 2));
    await user.click(screen.getByRole('button', { name: /Kaydet ve yayınla/ }));

    expect(
      await screen.findByText('Yerleşim kaydedilmedi; core güncel değil.'),
    ).toBeInTheDocument();
    expect(certificatesApi.publishTemplate).not.toHaveBeenCalled();
    // The editor draws what that core prints, and sends no placement any more
    expect(screen.queryByLabelText('Yerleşim')).not.toBeInTheDocument();
    expect(bgBox('width')).toBeCloseTo(125.695, 2);
    await user.click(screen.getByRole('button', { name: /Taslağı kaydet/ }));
    await waitFor(() => expect(certificatesApi.updateTemplate).toHaveBeenCalledTimes(2));
    expect(
      (certificatesApi.updateTemplate as jest.Mock).mock.calls[1][1].layout,
    ).not.toHaveProperty('backgroundPlacement');
  });

  it('fits the page to an uploaded background of another ratio, and takes it back', async () => {
    const user = userEvent.setup();
    (mediaApi.upload as jest.Mock).mockResolvedValue(IMAGE_BACKGROUND);
    (backgroundNaturalSize as jest.Mock).mockResolvedValue({ width: 1600, height: 900 });
    render(<CertificateTemplateEditor templateId="system-default" />);

    await screen.findByDisplayValue('SKY LAB Varsayılan Sertifika');
    const png = new File(['png'], 'arka-plan.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Arka plan görseli yükle'), png);

    expect(backgroundNaturalSize).toHaveBeenCalledWith(IMAGE_BACKGROUND.url, 'image/png', png);
    expect(
      await screen.findByText(/Sayfa arka plana uyduruldu \(1123×794 → 1600×900\)/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Yerleşim')).toHaveValue('fill');
    expect(screen.getByLabelText('Sayfa ölçüsü')).toHaveValue('custom');

    await user.click(screen.getByRole('button', { name: 'Geri al' }));
    expect(screen.queryByText(/Sayfa arka plana uyduruldu/)).toBeNull();
    expect(screen.getByLabelText('Sayfa ölçüsü')).toHaveValue('a4Landscape');
    expect(screen.getByLabelText('Yerleşim')).toHaveValue('cover');
    expect(backgroundImage()).toHaveAttribute('src', IMAGE_BACKGROUND.url);
  });

  it('only stretches a background of the page ratio, and cannot fit a 20:1 one', async () => {
    const user = userEvent.setup();
    (mediaApi.upload as jest.Mock).mockResolvedValue(IMAGE_BACKGROUND);
    (backgroundNaturalSize as jest.Mock).mockResolvedValue({ width: 2246, height: 1588 });
    render(<CertificateTemplateEditor templateId="system-default" />);

    await screen.findByDisplayValue('SKY LAB Varsayılan Sertifika');
    await user.upload(
      screen.getByLabelText('Arka plan görseli yükle'),
      new File(['png'], 'a.png', { type: 'image/png' }),
    );
    await waitFor(() => expect(screen.getByLabelText('Yerleşim')).toHaveValue('fill'));
    expect(screen.queryByText(/Sayfa arka plana uyduruldu/)).toBeNull();
    expect(screen.getByLabelText('Sayfa ölçüsü')).toHaveValue('a4Landscape');

    (backgroundNaturalSize as jest.Mock).mockResolvedValue({ width: 4000, height: 200 });
    (mediaApi.upload as jest.Mock).mockResolvedValue({
      ...IMAGE_BACKGROUND,
      id: 'bg-2',
      url: 'https://cdn.example.test/files/serit.png',
    });
    await user.upload(
      screen.getByLabelText('Arka plan görseli yükle'),
      new File(['png'], 'serit.png', { type: 'image/png' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sayfayı arka plana uydur' })).toBeDisabled(),
    );
    expect(screen.getByText('Oran 300–4000 px sınırına sığmıyor.')).toBeInTheDocument();
    expect(screen.getByLabelText('Sayfa ölçüsü')).toHaveValue('a4Landscape');
  });

  it('removes the background with its placement', async () => {
    const user = userEvent.setup();
    withImageBackground({ fit: 'contain', x: 0.5, y: 0.5, scale: 1 });
    (certificatesApi.updateTemplate as jest.Mock).mockImplementation(async (id, body) => ({
      id,
      draftLayout: body.layout,
    }));
    render(<CertificateTemplateEditor templateId="tpl-1" />);

    await screen.findByDisplayValue('Görselli şablon');
    await user.click(await screen.findByRole('button', { name: /Arka planı kaldır/ }));
    expect(backgroundImage()).toBeNull();
    await user.click(screen.getByRole('button', { name: /Taslağı kaydet/ }));
    await waitFor(() => expect(certificatesApi.updateTemplate).toHaveBeenCalled());
    const sent = (certificatesApi.updateTemplate as jest.Mock).mock.calls[0][1].layout;
    expect(sent).not.toHaveProperty('backgroundPlacement');
    expect(sent.backgroundMediaId).toBeUndefined();
  });
});
