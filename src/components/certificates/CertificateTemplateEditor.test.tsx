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
// The same golden table as certificate-placement.test.ts (core-backend's copy)
import golden from '@/lib/__fixtures__/background-placement.json';

type GoldenCase = {
  page: { width: number; height: number };
  source: { width: number; height: number };
  placement: {
    fit: 'contain' | 'cover' | 'fill' | 'fitWidth' | 'fitHeight' | 'none';
    x: number;
    y: number;
    scale: number;
  };
  want: { left: number; top: number; width: number; height: number };
};

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
    assetInfo: jest.fn(),
    assetPreview: jest.fn(),
    assetText: jest.fn(),
    convertAssetText: jest.fn(),
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

const PDF_BACKGROUND = {
  id: 'bg-pdf',
  name: 'sertifika.pdf',
  type: 'application/pdf',
  url: 'https://cdn.example.test/files/sertifika.pdf',
  kind: 'FILE',
};

/** Canva's A4 portrait PDF, as core's /info reads it (pt × 96/72). */
const A4_PORTRAIT_PDF = {
  contentType: 'application/pdf',
  widthPx: 793.701,
  heightPx: 1122.52,
  pages: 1,
  textCount: 12,
};

/** The template's draft with a PDF background under its page. */
function withPdfBackground(layout: object = {}) {
  const draft = emptyCertificateDraft();
  (certificatesApi.template as jest.Mock).mockResolvedValue({
    id: 'tpl-pdf',
    name: 'PDF şablon',
    ownerTeam: '',
    sourceKind: 'upload',
    sourceRef: '',
    sourceEditUrl: '',
    draftLayout: { ...draft.layout, backgroundMediaId: 'bg-pdf', ...layout },
    system: true,
  });
  (mediaApi.get as jest.Mock).mockResolvedValue(PDF_BACKGROUND);
}

const backgroundImage = () => document.querySelector('img[data-background]') as HTMLElement;
/** A layer's button in the layer list (not its box on the canvas). */
const layerButton = (name: string) =>
  screen.getAllByRole('button', { name }).find((button) => button.className.includes('truncate'))!;

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
    (certificatesApi.assetInfo as jest.Mock).mockResolvedValue(A4_PORTRAIT_PDF);
    (certificatesApi.assetPreview as jest.Mock).mockResolvedValue(
      new Blob(['png'], { type: 'image/png' }),
    );
    URL.createObjectURL = jest.fn(() => 'blob:pdf-onizleme');
    URL.revokeObjectURL = jest.fn();
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

  it("draws an uploaded PDF from core's PNG and fits the page to it", async () => {
    const user = userEvent.setup();
    (mediaApi.upload as jest.Mock).mockResolvedValue(PDF_BACKGROUND);
    render(<CertificateTemplateEditor templateId="system-default" />);

    await screen.findByDisplayValue('SKY LAB Varsayılan Sertifika');
    await user.selectOptions(screen.getByLabelText('Tasarım kaynağı'), 'canva');
    const input = screen.getByLabelText('Canva dosyasını yükle');
    expect(input).toHaveAttribute('accept', expect.stringContaining('application/pdf'));

    const pdf = new File(['%PDF-1.7 example'], 'sertifika.pdf', { type: 'application/pdf' });
    await user.upload(input, pdf);

    expect(mediaApi.upload).toHaveBeenCalledWith(pdf);
    expect(await screen.findByText('3 · Dosyayı yükle ✓')).toBeInTheDocument();
    expect(certificatesApi.assetInfo).toHaveBeenCalledWith('bg-pdf');
    // Canva's A4 portrait PDF under an A4 landscape page: the page turns to fit it (K1)
    expect(
      await screen.findByText(/Sayfa arka plana uyduruldu \(1123×794 → 794×1123\)/),
    ).toBeInTheDocument();
    await waitFor(() => expect(backgroundImage()).toHaveAttribute('src', 'blob:pdf-onizleme'));
    expect(certificatesApi.assetPreview).toHaveBeenCalledWith('bg-pdf');
    expect(screen.queryByTitle('PDF arka plan önizlemesi')).toBeNull();
    expect(screen.getByLabelText('Yerleşim')).toHaveValue('fill');
    expect(bgBox('width')).toBeCloseTo(100, 2);
    expect(bgBox('height')).toBeCloseTo(100, 2);
    expect(screen.queryByText('PDF yerleşimi yakında')).toBeNull();
    expect(backgroundNaturalSize).not.toHaveBeenCalled();
  });

  it('says only that a PDF of the page ratio was uploaded', async () => {
    const user = userEvent.setup();
    (mediaApi.upload as jest.Mock).mockResolvedValue(PDF_BACKGROUND);
    (certificatesApi.assetInfo as jest.Mock).mockResolvedValue({
      ...A4_PORTRAIT_PDF,
      widthPx: 1122.52,
      heightPx: 793.701,
    });
    render(<CertificateTemplateEditor templateId="system-default" />);

    await screen.findByDisplayValue('SKY LAB Varsayılan Sertifika');
    await user.upload(
      screen.getByLabelText('Arka plan görseli yükle'),
      new File(['%PDF-1.7'], 'sertifika.pdf', { type: 'application/pdf' }),
    );

    expect(await screen.findByText('PDF arka planı yüklendi.')).toBeInTheDocument();
    expect(screen.queryByText(/Sayfa arka plana uyduruldu/)).toBeNull();
    expect(screen.getByLabelText('Yerleşim')).toHaveValue('fill');
  });

  it('draws an old PDF layout as core prints it: by its height, centred', async () => {
    withPdfBackground();
    render(<CertificateTemplateEditor templateId="tpl-pdf" />);

    await screen.findByDisplayValue('PDF şablon');
    // A portrait PDF under a landscape page, no placement: pdfcpu's scale (fitHeight)
    await waitFor(() => expect(screen.getByLabelText('Yerleşim')).toHaveValue('fitHeight'));
    // 793.701×1122.52 px to 794 px high: 561.41 px wide, 280.79 px from the left
    const width = (793.701 * 794) / 1122.52;
    expect(bgBox('left')).toBeCloseTo(((1123 - width) / 2 / 1123) * 100, 2);
    expect(bgBox('top')).toBeCloseTo(0, 2);
    expect(bgBox('width')).toBeCloseTo((width / 1123) * 100, 2);
    expect(bgBox('height')).toBeCloseTo(100, 2);
  });

  it("places a PDF in the golden table's box", async () => {
    const cases = (golden as { cases: GoldenCase[] }).cases.filter((_c, i) => i % 50 === 7);
    expect(cases.length).toBe(12);
    for (const c of cases) {
      withPdfBackground({
        width: c.page.width,
        height: c.page.height,
        orientation: c.page.width >= c.page.height ? 'landscape' : 'portrait',
        backgroundPlacement: c.placement,
      });
      (certificatesApi.assetInfo as jest.Mock).mockResolvedValue({
        ...A4_PORTRAIT_PDF,
        widthPx: c.source.width,
        heightPx: c.source.height,
      });
      const { unmount } = render(<CertificateTemplateEditor templateId="tpl-pdf" />);
      await screen.findByDisplayValue('PDF şablon');
      await waitFor(() => expect(screen.getByLabelText('Yerleşim')).toHaveValue(c.placement.fit));
      const percent = (value: number, side: number) => (value / side) * 100;
      expect(bgBox('left')).toBeCloseTo(percent(c.want.left, c.page.width), 2);
      expect(bgBox('top')).toBeCloseTo(percent(c.want.top, c.page.height), 2);
      expect(bgBox('width')).toBeCloseTo(percent(c.want.width, c.page.width), 2);
      expect(bgBox('height')).toBeCloseTo(percent(c.want.height, c.page.height), 2);
      unmount();
    }
  });

  it("saves a PDF's placement and fits the page to the PDF", async () => {
    const user = userEvent.setup();
    withPdfBackground({ backgroundPlacement: { fit: 'contain', x: 0, y: 0.5, scale: 1 } });
    (certificatesApi.updateTemplate as jest.Mock).mockImplementation(async (id, body) => ({
      id,
      draftLayout: body.layout,
    }));
    render(<CertificateTemplateEditor templateId="tpl-pdf" />);

    await screen.findByDisplayValue('PDF şablon');
    await user.click(await screen.findByRole('button', { name: 'Sayfayı arka plana uydur' }));
    expect(
      screen.getByText(/Sayfa arka plana uyduruldu \(1123×794 → 794×1123\)/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Taslağı kaydet/ }));

    await waitFor(() => expect(certificatesApi.updateTemplate).toHaveBeenCalled());
    expect((certificatesApi.updateTemplate as jest.Mock).mock.calls[0][1].layout).toMatchObject({
      width: 794,
      height: 1123,
      backgroundMediaId: 'bg-pdf',
      backgroundPlacement: { fit: 'fill', x: 0.5, y: 0.5, scale: 1 },
    });
  });

  it('shows a skeleton while core draws the PDF', async () => {
    (certificatesApi.assetPreview as jest.Mock).mockReturnValue(new Promise(() => {}));
    withPdfBackground();
    render(<CertificateTemplateEditor templateId="tpl-pdf" />);

    await screen.findByDisplayValue('PDF şablon');
    await waitFor(() =>
      expect(document.querySelector('[data-background-skeleton]')).toBeInTheDocument(),
    );
    expect(backgroundImage()).toBeNull();
  });

  it('says so when pdf-tools is down, keeps the saved placement and the PDF preview', async () => {
    const user = userEvent.setup();
    const down = new ProblemError(503, 'Service Unavailable', { code: 'pdf_tools_unavailable' });
    (certificatesApi.assetInfo as jest.Mock).mockRejectedValue(down);
    (certificatesApi.assetPreview as jest.Mock).mockRejectedValue(down);
    (certificatesApi.updateTemplate as jest.Mock).mockImplementation(async (id, body) => ({
      id,
      draftLayout: body.layout,
    }));
    withPdfBackground({ backgroundPlacement: { fit: 'contain', x: 0.5, y: 0.5, scale: 1 } });
    render(<CertificateTemplateEditor templateId="tpl-pdf" />);

    await screen.findByDisplayValue('PDF şablon');
    expect(await screen.findByText('PDF önizlemesi şu an üretilemiyor.')).toBeInTheDocument();
    expect(document.querySelector('[data-background-skeleton]')).toBeNull();
    // The PDF is still seen, in a frame as before
    expect(screen.getByTitle('PDF arka plan önizlemesi')).toHaveAttribute(
      'src',
      expect.stringContaining('sertifika.pdf#page=1'),
    );
    expect(screen.queryByLabelText('Yerleşim')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PDF önizle/ })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /Taslağı kaydet/ }));
    await waitFor(() => expect(certificatesApi.updateTemplate).toHaveBeenCalled());
    expect(
      (certificatesApi.updateTemplate as jest.Mock).mock.calls[0][1].layout.backgroundPlacement,
    ).toEqual({ fit: 'contain', x: 0.5, y: 0.5, scale: 1 });
  });

  it('reads a PDF again on PDF önizle once pdf-tools is back', async () => {
    const user = userEvent.setup();
    const down = new ProblemError(503, 'Service Unavailable', { code: 'pdf_tools_unavailable' });
    (certificatesApi.assetInfo as jest.Mock).mockRejectedValueOnce(down);
    (certificatesApi.assetPreview as jest.Mock).mockRejectedValueOnce(down);
    (certificatesApi.updateTemplate as jest.Mock).mockImplementation(async (id, body) => ({
      id,
      draftLayout: body.layout,
    }));
    (certificatesApi.previewTemplate as jest.Mock).mockResolvedValue(new Blob(['%PDF']));
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    withPdfBackground();
    render(<CertificateTemplateEditor templateId="tpl-pdf" />);

    expect(await screen.findByText('PDF önizlemesi şu an üretilemiyor.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /PDF önizle/ }));

    await waitFor(() => expect(backgroundImage()).toHaveAttribute('src', 'blob:pdf-onizleme'));
    expect(certificatesApi.assetInfo).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('PDF önizlemesi şu an üretilemiyor.')).toBeNull();
    expect(screen.queryByTitle('PDF arka plan önizlemesi')).toBeNull();
    expect(screen.getByLabelText('Yerleşim')).toHaveValue('fitHeight');
    open.mockRestore();
  });

  it('says why core cannot read an encrypted PDF', async () => {
    (certificatesApi.assetInfo as jest.Mock).mockRejectedValue(
      new ProblemError(400, 'Bad Request', { code: 'background_pdf_encrypted' }),
    );
    withPdfBackground();
    render(<CertificateTemplateEditor templateId="tpl-pdf" />);

    expect(
      await screen.findByText('PDF parolalı ya da şifreli; parolasız dışa aktarıp yeniden yükle.'),
    ).toBeInTheDocument();
  });

  it('falls back to the frame on a core without the asset routes', async () => {
    const user = userEvent.setup();
    const missing = new ProblemError(404, 'Not Found');
    (certificatesApi.assetInfo as jest.Mock).mockRejectedValue(missing);
    (certificatesApi.assetPreview as jest.Mock).mockRejectedValue(missing);
    (mediaApi.upload as jest.Mock).mockResolvedValue(PDF_BACKGROUND);
    (certificatesApi.updateTemplate as jest.Mock).mockImplementation(async (id, body) => ({
      id,
      draftLayout: body.layout,
    }));
    withImageBackground({ fit: 'contain', x: 0.5, y: 0.5, scale: 1 });
    render(<CertificateTemplateEditor templateId="tpl-1" />);

    await screen.findByDisplayValue('Görselli şablon');
    await user.upload(
      screen.getByLabelText('Arka plan görseli yükle'),
      new File(['%PDF-1.7'], 'sertifika.pdf', { type: 'application/pdf' }),
    );

    expect(await screen.findByTitle('PDF arka plan önizlemesi')).toHaveAttribute(
      'src',
      expect.stringContaining('sertifika.pdf#page=1&view=FitH'),
    );
    expect(backgroundImage()).toBeNull();
    expect(screen.queryByLabelText('Yerleşim')).not.toBeInTheDocument();
    expect(screen.queryByText('PDF önizlemesi şu an üretilemiyor.')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Taslağı kaydet/ }));
    await waitFor(() => expect(certificatesApi.updateTemplate).toHaveBeenCalled());
    // That core prints the PDF the old way: no placement goes with it
    expect(
      (certificatesApi.updateTemplate as jest.Mock).mock.calls[0][1].layout,
    ).not.toHaveProperty('backgroundPlacement');
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
    // The layers are back where they were on the A4 page
    await user.click(layerButton('Katılımcı adı'));
    expect(screen.getByLabelText('X')).toHaveValue(140);
    expect(screen.getByLabelText('Y')).toHaveValue(285);
    expect(screen.getByLabelText('WIDTH')).toHaveValue(843);
  });

  it('offers Geri al only until the next edit', async () => {
    const user = userEvent.setup();
    (mediaApi.upload as jest.Mock).mockResolvedValue(IMAGE_BACKGROUND);
    (backgroundNaturalSize as jest.Mock).mockResolvedValue({ width: 1600, height: 900 });
    render(<CertificateTemplateEditor templateId="system-default" />);

    await screen.findByDisplayValue('SKY LAB Varsayılan Sertifika');
    await user.upload(
      screen.getByLabelText('Arka plan görseli yükle'),
      new File(['png'], 'arka-plan.png', { type: 'image/png' }),
    );
    expect(await screen.findByRole('button', { name: 'Geri al' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Yerleşim'), 'contain');

    expect(screen.queryByRole('button', { name: 'Geri al' })).toBeNull();
    expect(screen.getByText(/Sayfa arka plana uyduruldu/)).toBeInTheDocument();
  });

  it('keeps no placement for a background of unknown size, and hides the controls', async () => {
    const user = userEvent.setup();
    withImageBackground({ fit: 'contain', x: 0, y: 0, scale: 1 });
    (certificatesApi.updateTemplate as jest.Mock).mockImplementation(async (id, body) => ({
      id,
      draftLayout: body.layout,
    }));
    render(<CertificateTemplateEditor templateId="tpl-1" />);

    await screen.findByDisplayValue('Görselli şablon');
    await waitFor(() => expect(bgBox('top')).toBeCloseTo(0, 2));
    expect(screen.getByLabelText('Yerleşim')).toHaveValue('contain');

    // An SVG with width="100%" and no viewBox: core cannot size it either
    const svg = {
      ...IMAGE_BACKGROUND,
      id: 'bg-svg',
      type: 'image/svg+xml',
      url: 'https://cdn.example.test/files/yuzde.svg',
    };
    (mediaApi.upload as jest.Mock).mockResolvedValue(svg);
    (backgroundNaturalSize as jest.Mock).mockRejectedValue(new Error('background size unknown'));
    await user.upload(
      screen.getByLabelText('Arka plan görseli yükle'),
      new File(['<svg width="100%"/>'], 'yuzde.svg', { type: 'image/svg+xml' }),
    );

    expect(await screen.findByText('Görselin boyutu okunamadı.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Yerleşim')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Konum' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sayfayı arka plana uydur' })).toBeNull();
    // Drawn as core prints it without a placement: covered, centred
    expect(backgroundImage()).toHaveAttribute('src', svg.url);
    expect(backgroundImage().style.objectFit).toBe('cover');

    await user.click(screen.getByRole('button', { name: /Taslağı kaydet/ }));
    await waitFor(() => expect(certificatesApi.updateTemplate).toHaveBeenCalled());
    const sent = (certificatesApi.updateTemplate as jest.Mock).mock.calls[0][1].layout;
    expect(sent.backgroundMediaId).toBe('bg-svg');
    expect(sent).not.toHaveProperty('backgroundPlacement');
  });

  it('keeps a saved placement when the opened background cannot be sized', async () => {
    const user = userEvent.setup();
    withImageBackground({ fit: 'contain', x: 0, y: 1, scale: 0.8 });
    // The CDN did not answer this time: the saved placement is not the editor's to drop
    (backgroundNaturalSize as jest.Mock).mockRejectedValue(new Error('background unreadable'));
    (certificatesApi.updateTemplate as jest.Mock).mockImplementation(async (id, body) => ({
      id,
      draftLayout: body.layout,
    }));
    render(<CertificateTemplateEditor templateId="tpl-1" />);

    await screen.findByDisplayValue('Görselli şablon');
    expect(await screen.findByText('Görselin boyutu okunamadı.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Yerleşim')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Taslağı kaydet/ }));
    await waitFor(() => expect(certificatesApi.updateTemplate).toHaveBeenCalled());
    expect((certificatesApi.updateTemplate as jest.Mock).mock.calls[0][1].layout).toMatchObject({
      backgroundMediaId: 'bg-1',
      backgroundPlacement: { fit: 'contain', x: 0, y: 1, scale: 0.8 },
    });
    expect(screen.queryByText('Yerleşim kaydedilmedi; core güncel değil.')).toBeNull();
  });

  it('shows the placement controls while the size is still being read', async () => {
    withImageBackground({ fit: 'contain', x: 0.5, y: 0.5, scale: 1 });
    (backgroundNaturalSize as jest.Mock).mockReturnValue(new Promise(() => undefined));
    render(<CertificateTemplateEditor templateId="tpl-1" />);

    await screen.findByDisplayValue('Görselli şablon');
    expect(await screen.findByLabelText('Yerleşim')).toHaveValue('contain');
    const grid = screen.getByRole('group', { name: 'Konum' });
    expect(within(grid).getAllByRole('button')).toHaveLength(9);
    expect(screen.queryByText('Görselin boyutu okunamadı.')).toBeNull();
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
  describe('PDF text to layers', () => {
    const CONVERTED = {
      backgroundMediaId: 'bg-pdf-metinsiz',
      backgroundOriginalMediaId: 'bg-pdf',
      elements: [
        {
          id: 'bgtext-1',
          kind: 'staticText',
          text: 'Katılım Belgesi',
          x: 286.44,
          y: 218.1,
          width: 535.28,
          height: 64,
          fontFamily: 'Montserrat',
          fontSize: 53.33,
          minFontSize: 45.33,
          fontWeight: 700,
          lineHeight: 1.2,
          color: '#1a2659',
          align: 'center',
          fit: 'shrink',
          origin: 'backgroundText',
          sourceFont: 'Montserrat-Bold',
        },
        {
          id: 'bgtext-2',
          kind: 'recipientName',
          x: 44.92,
          y: 330,
          width: 1033.16,
          height: 52,
          fontFamily: 'Noto Sans',
          fontSize: 42.67,
          minFontSize: 21.33,
          fontWeight: 400,
          align: 'center',
          fit: 'shrink',
          origin: 'backgroundText',
          sourceFont: 'BrandonGrotesque-Regular',
        },
      ],
      warnings: [
        {
          spanId: '15',
          elementId: 'bgtext-2',
          kind: 'fontSubstituted',
          from: 'BrandonGrotesque-Regular',
          to: 'Noto Sans',
        },
      ],
    };

    beforeEach(() => {
      (certificatesApi.assetInfo as jest.Mock).mockResolvedValue({
        ...A4_PORTRAIT_PDF,
        widthPx: 1122.52,
        heightPx: 793.701,
      });
      (certificatesApi.assetText as jest.Mock).mockResolvedValue({
        spans: [
          {
            id: '12',
            text: 'Katılım Belgesi',
            sourceFont: 'Montserrat-Bold',
            font: 'Montserrat',
            fontWeight: 700,
            fontSubstituted: false,
            fontSizePt: 40,
            convertible: true,
          },
          {
            id: '15',
            text: 'Ad Soyad',
            sourceFont: 'BrandonGrotesque-Regular',
            font: 'Noto Sans',
            fontWeight: 400,
            fontSubstituted: true,
            fontSizePt: 32,
            convertible: true,
          },
        ],
      });
      (certificatesApi.convertAssetText as jest.Mock).mockResolvedValue(CONVERTED);
      (certificatesApi.updateTemplate as jest.Mock).mockImplementation(async (id, body) => ({
        id,
        draftLayout: body.layout,
      }));
    });

    it('turns the PDF text into layers, the placeholder into the recipient', async () => {
      const user = userEvent.setup();
      withPdfBackground({ backgroundPlacement: { fit: 'fill', x: 0.5, y: 0.5, scale: 1 } });
      render(<CertificateTemplateEditor templateId="tpl-pdf" />);

      await screen.findByDisplayValue('PDF şablon');
      expect(await screen.findByText("Bu PDF'te metin var")).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Metinleri düzenlenebilir yap' }));
      const sheet = await screen.findByRole('dialog', { name: 'Metinleri düzenlenebilir yap' });
      await within(sheet).findByRole('list', { name: 'PDF metinleri' });
      await user.click(within(sheet).getByRole('checkbox', { name: 'Katılımcı adı yap' }));
      await user.click(within(sheet).getByRole('button', { name: 'Dönüştür' }));

      expect(
        await screen.findByText('2 metin katmana çevrildi; kaydetmeyi unutma.'),
      ).toBeInTheDocument();
      expect(certificatesApi.convertAssetText).toHaveBeenCalledWith('bg-pdf', {
        spanIds: ['12', '15'],
        kinds: { '15': 'recipientName' },
        page: { width: 1123, height: 794 },
        placement: { fit: 'fill', x: 0.5, y: 0.5, scale: 1 },
        existingElements: 2,
      });
      // The new PDF is drawn, its text a layer the designer can pick
      await waitFor(() =>
        expect(certificatesApi.assetPreview).toHaveBeenCalledWith('bg-pdf-metinsiz'),
      );
      expect(screen.getByText('2 metin katmana çevrildi')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Orijinale dön' })).toBeInTheDocument();
      await user.click(layerButton('Katılım Belgesi'));
      expect(screen.getByLabelText('Metin')).toHaveValue('Katılım Belgesi');
      expect(screen.getByText("PDF'teki yazı tipi: Montserrat-Bold")).toBeInTheDocument();
      await user.clear(screen.getByLabelText('Metin'));
      await user.type(screen.getByLabelText('Metin'), 'Başarı Belgesi');
      await user.click(screen.getByLabelText('İtalik'));
      // The stand-in font is said beside the layer
      const warned = screen.getByRole('img', {
        name: 'Yazı tipi değişti: BrandonGrotesque-Regular → Noto Sans',
      });
      expect(warned).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Taslağı kaydet/ }));
      await waitFor(() => expect(certificatesApi.updateTemplate).toHaveBeenCalled());
      const sent = (certificatesApi.updateTemplate as jest.Mock).mock.calls[0][1].layout;
      expect(sent.backgroundMediaId).toBe('bg-pdf-metinsiz');
      expect(sent.backgroundOriginalMediaId).toBe('bg-pdf');
      // The template's own recipient gave way to the PDF's placeholder
      expect(sent.elements.filter((e: { kind: string }) => e.kind === 'recipientName')).toEqual([
        expect.objectContaining({ id: 'bgtext-2', origin: 'backgroundText' }),
      ]);
      expect(sent.elements.find((e: { id: string }) => e.id === 'bgtext-1')).toMatchObject({
        text: 'Başarı Belgesi',
        fontStyle: 'italic',
        origin: 'backgroundText',
        sourceFont: 'Montserrat-Bold',
      });
    });

    it('gives back the layers a conversion replaced, and converts the rest later', async () => {
      const user = userEvent.setup();
      withPdfBackground({ backgroundPlacement: { fit: 'fill', x: 0.5, y: 0.5, scale: 1 } });
      render(<CertificateTemplateEditor templateId="tpl-pdf" />);

      await screen.findByDisplayValue('PDF şablon');
      await user.click(await screen.findByRole('button', { name: 'Metinleri düzenlenebilir yap' }));
      const sheet = await screen.findByRole('dialog', { name: 'Metinleri düzenlenebilir yap' });
      await within(sheet).findByRole('list', { name: 'PDF metinleri' });
      await user.click(within(sheet).getByRole('checkbox', { name: 'Katılımcı adı yap' }));
      await user.click(within(sheet).getByRole('button', { name: 'Dönüştür' }));
      await screen.findByText('2 metin katmana çevrildi; kaydetmeyi unutma.');

      // The converted text is named by its content on the canvas
      expect(
        screen.getByRole('button', { name: 'Sabit metin: Katılım Belgesi' }),
      ).toBeInTheDocument();
      // The PDF converted still has text: a second conversion keeps the first original
      expect(await screen.findByRole('button', { name: 'Kalan metinleri çevir' })).toBeEnabled();

      await user.click(screen.getByRole('button', { name: 'Orijinale dön' }));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Orijinale dön' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: /Taslağı kaydet/ }));
      await waitFor(() => expect(certificatesApi.updateTemplate).toHaveBeenCalled());
      const sent = (certificatesApi.updateTemplate as jest.Mock).mock.calls[0][1].layout;
      // The template's own recipient, with its place, is back
      const own = emptyCertificateDraft().layout.elements[0];
      expect(sent.elements.filter((e: { kind: string }) => e.kind === 'recipientName')).toEqual([
        expect.objectContaining({ x: own.x, y: own.y, width: own.width }),
      ]);
    });

    it('says why a PDF has no text', async () => {
      (certificatesApi.assetInfo as jest.Mock).mockResolvedValue({
        ...A4_PORTRAIT_PDF,
        textCount: 0,
      });
      (certificatesApi.assetText as jest.Mock).mockResolvedValue({
        spans: [],
        textMissing: 'outlines',
      });
      withPdfBackground();
      render(<CertificateTemplateEditor templateId="tpl-pdf" />);

      expect(
        await screen.findByText('Yazılar çizgiye çevrilmiş; düzenlenemez.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Metinleri düzenlenebilir yap' })).toBeNull();
    });

    it('keeps converted layers as plain ones once the background is removed', async () => {
      const user = userEvent.setup();
      withPdfBackground({
        backgroundMediaId: 'bg-pdf-metinsiz',
        backgroundOriginalMediaId: 'bg-pdf',
        backgroundPlacement: { fit: 'fill', x: 0.5, y: 0.5, scale: 1 },
        elements: [...CONVERTED.elements, { ...emptyCertificateDraft().layout.elements[2] }],
      });
      render(<CertificateTemplateEditor templateId="tpl-pdf" />);

      await screen.findByDisplayValue('PDF şablon');
      await user.click(await screen.findByRole('button', { name: /Arka planı kaldır/ }));
      await user.click(screen.getByRole('button', { name: /Taslağı kaydet/ }));
      await waitFor(() => expect(certificatesApi.updateTemplate).toHaveBeenCalled());
      const sent = (certificatesApi.updateTemplate as jest.Mock).mock.calls[0][1].layout;
      // Left out of the JSON core gets
      expect(sent.backgroundOriginalMediaId).toBeUndefined();
      expect(sent.elements).toHaveLength(3);
      expect(sent.elements.some((e: { origin?: string }) => e.origin)).toBe(false);
      expect(sent.elements[0]).toMatchObject({
        text: 'Katılım Belgesi',
        sourceFont: 'Montserrat-Bold',
      });
    });

    it('goes back to the original PDF, the converted layers removed', async () => {
      const user = userEvent.setup();
      withPdfBackground({
        backgroundMediaId: 'bg-pdf-metinsiz',
        backgroundOriginalMediaId: 'bg-pdf',
        backgroundPlacement: { fit: 'fill', x: 0.5, y: 0.5, scale: 1 },
        elements: [...CONVERTED.elements, { ...emptyCertificateDraft().layout.elements[2] }],
      });
      render(<CertificateTemplateEditor templateId="tpl-pdf" />);

      await screen.findByDisplayValue('PDF şablon');
      await user.click(await screen.findByRole('button', { name: 'Orijinale dön' }));
      const dialog = await screen.findByRole('alertdialog');
      expect(dialog).toHaveTextContent('Dönüştürülen 2 metin silinecek.');
      await user.click(within(dialog).getByRole('button', { name: 'Orijinale dön' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

      expect(await screen.findByText("Bu PDF'te metin var")).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Taslağı kaydet/ }));
      await waitFor(() => expect(certificatesApi.updateTemplate).toHaveBeenCalled());
      const sent = (certificatesApi.updateTemplate as jest.Mock).mock.calls[0][1].layout;
      expect(sent.backgroundMediaId).toBe('bg-pdf');
      expect(sent).not.toHaveProperty('backgroundOriginalMediaId');
      expect(sent.elements.some((e: { origin?: string }) => e.origin)).toBe(false);
      // The recipient's name, which the conversion had taken, is back
      expect(sent.elements.map((e: { kind: string }) => e.kind).sort()).toEqual([
        'recipientName',
        'verificationQr',
      ]);
    });

    it('moves the converted layers with the background', async () => {
      const user = userEvent.setup();
      withPdfBackground({
        backgroundMediaId: 'bg-pdf-metinsiz',
        backgroundOriginalMediaId: 'bg-pdf',
        backgroundPlacement: { fit: 'fill', x: 0.5, y: 0.5, scale: 1 },
        elements: [...CONVERTED.elements, { ...emptyCertificateDraft().layout.elements[2] }],
      });
      render(<CertificateTemplateEditor templateId="tpl-pdf" />);

      await screen.findByDisplayValue('PDF şablon');
      await waitFor(() => expect(screen.getByLabelText('Yerleşim')).toHaveValue('fill'));
      await user.selectOptions(screen.getByLabelText('Yerleşim'), 'contain');
      await user.clear(screen.getByLabelText('Ölçek (%)'));
      await user.type(screen.getByLabelText('Ölçek (%)'), '50');
      await user.click(layerButton('Katılım Belgesi'));

      // The page box (1123×794) became half of it, centred: 280.75, 198.5, 561.5 × 397
      expect((screen.getByLabelText('X') as HTMLInputElement).valueAsNumber).toBeCloseTo(
        280.75 + 286.44 * 0.5,
        1,
      );
      expect((screen.getByLabelText('WIDTH') as HTMLInputElement).valueAsNumber).toBeCloseTo(
        535.28 * 0.5,
        1,
      );
      // The QR, not from the PDF, stays where it was
      await user.click(layerButton('Doğrulama QR'));
      expect(screen.getByLabelText('X')).toHaveValue(910);
    });
  });

  it('keeps the QR square when the page size changes', async () => {
    const user = userEvent.setup();
    render(<CertificateTemplateEditor templateId="system-default" />);

    await screen.findByDisplayValue('SKY LAB Varsayılan Sertifika');
    await user.selectOptions(screen.getByLabelText('Sayfa ölçüsü'), 'a4Portrait');
    const qr = screen
      .getAllByRole('button', { name: 'Doğrulama QR' })
      .find((button) => button.className.includes('truncate'));
    await user.click(qr!);

    expect(screen.getByLabelText('WIDTH')).toHaveValue(92);
    expect(screen.getByLabelText('HEIGHT')).toHaveValue(92);
  });
});
