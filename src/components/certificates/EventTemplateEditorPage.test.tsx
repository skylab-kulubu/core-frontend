import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { EventTemplateEditorPage } from '@/components/certificates/EventTemplateEditorPage';
import { certificatesApi } from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';
import { eventsApi } from '@/lib/api/events';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/use-app-can', () => ({
  ...jest.requireActual('@/lib/use-app-can'),
  useTeamCan: () => () => true,
}));
jest.mock('@/lib/api/events', () => ({ eventsApi: { get: jest.fn() } }));
jest.mock('@/lib/api/certificates', () => ({
  certificatesApi: { eventTemplate: jest.fn(), createEventTemplate: jest.fn(), resolve: jest.fn() },
}));
jest.mock('@/components/certificates/CertificateTemplateEditor', () => ({
  CertificateTemplateEditor: (props: {
    templateId: string;
    eventId: string;
    eventEditable: boolean;
  }) => <p>{`Editör ${props.templateId} ${props.eventId} ${props.eventEditable}`}</p>,
}));

const api = certificatesApi as unknown as Record<string, jest.Mock>;

const state = (eventTemplate: object | null) => ({ resolution: null, eventTemplate, choices: [] });

describe('EventTemplateEditorPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (eventsApi.get as jest.Mock).mockResolvedValue({
      id: 'e1',
      name: 'GeceKodu',
      ownerTeam: 'GECEKODU',
    });
  });

  it('opens the Event template in the editor, back to the edit page’s Sertifika section', async () => {
    api.eventTemplate.mockResolvedValue(
      state({ id: 't-own', name: 'GeceKodu sertifikası', draftUpdatedAt: '' }),
    );
    render(<EventTemplateEditorPage eventId="e1" />);

    expect(await screen.findByText('Editör t-own e1 true')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Sertifika şablonu/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GeceKodu' })).toHaveAttribute(
      'href',
      '/events/e1/edit#sertifika',
    );
  });

  it('leads back to the Sertifikalar tab when opened from it', async () => {
    api.eventTemplate.mockResolvedValue(state({ id: 't-own', name: 'x', draftUpdatedAt: '' }));
    render(<EventTemplateEditorPage eventId="e1" from="certificates" />);
    expect(await screen.findByRole('link', { name: 'GeceKodu' })).toHaveAttribute(
      'href',
      '/events/e1/certificates',
    );
  });

  it('offers to create one when the Event has none, then opens it', async () => {
    const user = userEvent.setup();
    api.eventTemplate
      .mockResolvedValueOnce(state(null))
      .mockResolvedValueOnce(state({ id: 't-new', name: 'x', draftUpdatedAt: '' }));
    api.createEventTemplate.mockResolvedValue({ id: 't-new' });
    render(<EventTemplateEditorPage eventId="e1" />);

    await user.click(await screen.findByRole('button', { name: /Etkinliğe özel şablon oluştur/ }));

    expect(api.createEventTemplate).toHaveBeenCalledWith('e1', 'current');
    expect(await screen.findByText('Editör t-new e1 true')).toBeInTheDocument();
  });

  it('says an older core has no Event templates', async () => {
    api.eventTemplate.mockRejectedValue(new ProblemError(404, 'Not Found'));
    api.resolve.mockResolvedValue(null);
    render(<EventTemplateEditorPage eventId="e1" />);
    await waitFor(() =>
      expect(screen.getByText('Etkinliğe özel şablon bu sunucuda yok')).toBeInTheDocument(),
    );
  });
});
