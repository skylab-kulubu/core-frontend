import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {
  CertificateTemplateEditor,
  emptyCertificateDraft,
} from '@/components/certificates/CertificateTemplateEditor';
import { certificatesApi } from '@/lib/api/certificates';

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
});
