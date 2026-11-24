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

  it('lets the designer delete the verification QR, and keeps the names', async () => {
    const user = userEvent.setup();
    render(<CertificateTemplateEditor templateId="system-default" />);

    await screen.findByDisplayValue('SKY LAB Varsayılan Sertifika');
    const layer = (name: string) =>
      screen
        .getAllByRole('button', { name })
        .find((button) => button.className.includes('truncate'));
    expect(layer('Doğrulama QR')).toBeDefined();
    // The QR is the only way to verify yet: it stays, with a short line
    await user.click(layer('Doğrulama QR')!);
    await user.click(screen.getByRole('button', { name: /Katmanı sil/ }));
    expect(layer('Doğrulama QR')).toBeDefined();
    expect(screen.getByText('QR ya da sertifika kodundan biri kalmalı.')).toBeInTheDocument();

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
});
