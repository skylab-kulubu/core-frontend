import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {
  CertificateTemplateEditor,
  emptyCertificateDraft,
} from '@/components/certificates/CertificateTemplateEditor';
import { certificatesApi } from '@/lib/api/certificates';

const mockSuccess = jest.fn();
// A GECEKODU member: edits the team's events, holds no certificate role
const mockUser = {
  id: 'member-1',
  username: 'uye',
  email: 'uye@example.com',
  firstName: 'Ada',
  lastName: 'Uye',
  roles: [] as string[],
  groups: ['/UYELER/ORGANIZASYON/GECEKODU'],
};

jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/lib/ui/use-notify', () => ({ useNotify: () => ({ success: mockSuccess }) }));
jest.mock('@/lib/api/certificates', () => ({
  certificatesApi: {
    template: jest.fn(),
    updateTemplate: jest.fn(),
    createTemplate: jest.fn(),
    publishTemplate: jest.fn(),
    previewTemplate: jest.fn(),
  },
}));
jest.mock('@/lib/api/media', () => ({ mediaApi: { get: jest.fn(), upload: jest.fn() } }));

const api = certificatesApi as unknown as Record<string, jest.Mock>;

const eventTemplate = {
  id: 't-own',
  name: 'GeceKodu sertifikası',
  ownerTeam: 'GECEKODU',
  eventId: 'e1',
  sourceKind: 'sky',
  sourceRef: '',
  sourceEditUrl: '',
  draftLayout: emptyCertificateDraft().layout,
  system: false,
};

describe('CertificateTemplateEditor on an Event template', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.template.mockResolvedValue(eventTemplate);
    api.updateTemplate.mockResolvedValue(eventTemplate);
    api.publishTemplate.mockResolvedValue({ version: 2 });
  });

  it('has no team field, says Etkinliğe özel, and lets who edits the event publish it', async () => {
    const user = userEvent.setup();
    render(<CertificateTemplateEditor templateId="t-own" eventId="e1" eventEditable />);

    const name = await screen.findByLabelText('Şablon adı');
    await waitFor(() => expect(name).toHaveValue('GeceKodu sertifikası'));
    expect(name).toBeEnabled();
    expect(screen.queryByLabelText('Sahip ekip')).not.toBeInTheDocument();
    expect(screen.getByText('Etkinliğe özel · SKY LAB editörü')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Kaydet ve yayınla/ }));

    await waitFor(() =>
      expect(mockSuccess).toHaveBeenCalledWith(
        'Sürüm 2 yayınlandı; bu etkinliğin yeni sertifikaları bunu kullanır',
      ),
    );
    expect(api.updateTemplate).toHaveBeenCalledWith(
      't-own',
      expect.objectContaining({ ownerTeam: 'GECEKODU' }),
    );
  });

  it('stays read-only for who may not edit the event', async () => {
    render(<CertificateTemplateEditor templateId="t-own" eventId="e1" />);
    const name = await screen.findByLabelText('Şablon adı');
    await waitFor(() => expect(name).toHaveValue('GeceKodu sertifikası'));
    expect(name).toBeDisabled();
    expect(screen.getByText('Bu şablon salt okunur.')).toBeInTheDocument();
  });
});
