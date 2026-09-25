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

  it('explains that a Canva link is a source reference and an export must be uploaded', async () => {
    const user = userEvent.setup();
    render(<CertificateTemplateEditor templateId="system-default" />);

    await screen.findByDisplayValue('SKY LAB Varsayılan Sertifika');
    await user.selectOptions(screen.getByLabelText('Tasarım kaynağı'), 'canva');
    await user.type(
      screen.getByLabelText('Kaynak bağlantısı'),
      'https://www.canva.com/design/example/edit',
    );

    expect(
      screen.getByText(/Canva bağlantısı tasarımı otomatik olarak içe aktarmaz/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Canva exportunu yükle')).toBeInTheDocument();
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
    const input = screen.getByLabelText('Canva exportunu yükle');
    expect(input).toHaveAttribute('accept', expect.stringContaining('application/pdf'));

    const pdf = new File(['%PDF-1.7 example'], 'certificate.pdf', {
      type: 'application/pdf',
    });
    await user.upload(input, pdf);

    expect(mediaApi.upload).toHaveBeenCalledWith(pdf);
    expect(await screen.findByText(/PDF arka planı hazır/i)).toBeInTheDocument();
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
});
