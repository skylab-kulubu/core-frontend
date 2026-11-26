import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {
  EventTemplateRow,
  TemplateBindingDialog,
  useEventTemplateState,
  type EventTemplateView,
} from '@/components/certificates/EventTemplateRow';
import { certificatesApi } from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';

const mockPush = jest.fn();
const mockSuccess = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/ui/use-notify', () => ({
  useNotify: () => ({ success: mockSuccess }),
}));

jest.mock('@/lib/api/certificates', () => ({
  certificatesApi: {
    eventTemplate: jest.fn(),
    createEventTemplate: jest.fn(),
    resolve: jest.fn(),
    previewEvent: jest.fn(),
    setBinding: jest.fn(),
    clearBinding: jest.fn(),
  },
}));

const api = certificatesApi as unknown as Record<string, jest.Mock>;

const teamTemplate = {
  id: 't-team',
  name: 'GECEKODU sertifikası',
  ownerTeam: 'GECEKODU',
  system: false,
};

function view(partial: Partial<EventTemplateView> = {}): EventTemplateView {
  return {
    resolution: {
      source: 'ownerTeam',
      template: teamTemplate,
      version: { version: 2 },
    } as unknown as EventTemplateView['resolution'],
    eventTemplate: null,
    choices: [
      {
        id: 't-team',
        name: 'GECEKODU sertifikası',
        ownerTeam: 'GECEKODU',
        system: false,
        version: 2,
      },
    ],
    legacy: false,
    ...partial,
  };
}

/** The row as the edit page draws it: read from core, then shown. */
function Loaded({ canEdit = true }: { canEdit?: boolean }) {
  const state = useEventTemplateState('e1');
  if (state.status !== 'ready') return <p>{state.status === 'failed' ? state.error : '…'}</p>;
  return (
    <EventTemplateRow
      eventId="e1"
      view={state.view}
      canEdit={canEdit}
      canPick={canEdit}
      onPick={() => undefined}
    />
  );
}

describe('EventTemplateRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('without an Event template: the team template in use, and Etkinliğe özel şablon oluştur', async () => {
    api.eventTemplate.mockResolvedValue(view());
    render(<Loaded />);

    expect(await screen.findByText('GECEKODU sertifikası')).toBeInTheDocument();
    expect(screen.getByText('GECEKODU ekip şablonu · v2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Etkinliğe özel şablon oluştur' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Ekip şablonlarından seç' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Örnek PDF' })).toBeEnabled();
    expect(screen.queryByRole('link', { name: 'Düzenle' })).not.toBeInTheDocument();
  });

  it('with a draft Event template: Düzenle, and says certificates still take the team template', async () => {
    api.eventTemplate.mockResolvedValue(
      view({
        eventTemplate: { id: 't-own', name: 'GeceKodu sertifikası', draftUpdatedAt: '' },
      }),
    );
    render(<Loaded />);

    expect(await screen.findByRole('link', { name: 'Düzenle' })).toHaveAttribute(
      'href',
      '/events/e1/certificate-template',
    );
    expect(
      screen.getByText(
        'Taslak · yayınlanmadı; sertifikalar şu an GECEKODU ekip şablonuyla üretilir',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Etkinliğe özel şablon oluştur' }),
    ).not.toBeInTheDocument();
  });

  it('with a published Event template: Etkinliğe özel and its version', async () => {
    api.eventTemplate.mockResolvedValue(
      view({
        resolution: {
          source: 'event',
          template: {
            id: 't-own',
            name: 'GeceKodu sertifikası',
            ownerTeam: 'GECEKODU',
            system: false,
          },
          version: { version: 3 },
        } as unknown as EventTemplateView['resolution'],
        eventTemplate: {
          id: 't-own',
          name: 'GeceKodu sertifikası',
          draftUpdatedAt: '',
          publishedVersion: 3,
        },
      }),
    );
    render(<Loaded />);

    expect(await screen.findByText('Etkinliğe özel · v3')).toBeInTheDocument();
    expect(screen.queryByText(/Taslak/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Düzenle' })).toBeInTheDocument();
  });

  it('creates the Event template from the one in use and opens its editor', async () => {
    const user = userEvent.setup();
    api.eventTemplate.mockResolvedValue(view());
    api.createEventTemplate.mockResolvedValue({ id: 't-own' });
    render(<Loaded />);

    await user.click(await screen.findByRole('button', { name: 'Etkinliğe özel şablon oluştur' }));

    expect(api.createEventTemplate).toHaveBeenCalledWith('e1', 'current');
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/events/e1/certificate-template'));
  });

  it('opens the existing one when core says the Event has it already (409)', async () => {
    const user = userEvent.setup();
    api.eventTemplate.mockResolvedValue(view());
    api.createEventTemplate.mockRejectedValue(
      new ProblemError(409, 'Conflict', {
        code: 'template_event_exists',
        fields: { templateId: 't-own' },
      }),
    );
    render(<Loaded />);

    await user.click(await screen.findByRole('button', { name: 'Etkinliğe özel şablon oluştur' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/events/e1/certificate-template'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says a refused create in Turkish and stays', async () => {
    const user = userEvent.setup();
    api.eventTemplate.mockResolvedValue(view());
    api.createEventTemplate.mockRejectedValue(new ProblemError(403, 'Forbidden'));
    render(<Loaded />);

    await user.click(await screen.findByRole('button', { name: 'Etkinliğe özel şablon oluştur' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('on an older core (404) shows the resolved template alone, nothing to create or pick', async () => {
    api.eventTemplate.mockRejectedValue(new ProblemError(404, 'Not Found'));
    api.resolve.mockResolvedValue({
      source: 'clubDefault',
      template: { id: 'sys', name: 'SKY LAB Varsayılan', ownerTeam: '', system: true },
      version: { version: 1 },
    });
    render(<Loaded />);

    expect(await screen.findByText('SKY LAB Varsayılan')).toBeInTheDocument();
    expect(screen.getByText('SKY LAB varsayılanı · v1')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Etkinliğe özel şablon oluştur' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Ekip şablonlarından seç' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Örnek PDF' })).toBeInTheDocument();
  });

  it('shows who may not edit the template only the picture and the sample', async () => {
    api.eventTemplate.mockResolvedValue(view());
    render(<Loaded canEdit={false} />);

    expect(await screen.findByText('GECEKODU sertifikası')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Etkinliğe özel şablon oluştur' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Ekip şablonlarından seç' }),
    ).not.toBeInTheDocument();
  });
});

describe('TemplateBindingDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists the published Event template first, and binds the one chosen', async () => {
    const user = userEvent.setup();
    const onDone = jest.fn();
    api.setBinding.mockResolvedValue({});
    const current = view();
    render(
      <TemplateBindingDialog
        open
        onClose={() => undefined}
        eventId="e1"
        choices={current.choices}
        eventTemplate={{
          id: 't-own',
          name: 'GeceKodu sertifikası',
          draftUpdatedAt: '',
          publishedVersion: 1,
        }}
        resolution={current.resolution}
        onDone={onDone}
      />,
    );

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(screen.getByText('Etkinliğe özel · v1')).toBeInTheDocument();
    expect(radios[1]).toBeChecked();

    await user.click(radios[0]);
    await user.click(screen.getByRole('button', { name: 'Etkinliğe uygula' }));

    expect(api.setBinding).toHaveBeenCalledWith({
      scope: 'event',
      scopeKey: 'e1',
      templateId: 't-own',
    });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('leaves a draft Event template out', () => {
    const current = view();
    render(
      <TemplateBindingDialog
        open
        onClose={() => undefined}
        eventId="e1"
        choices={current.choices}
        eventTemplate={{ id: 't-own', name: 'GeceKodu sertifikası', draftUpdatedAt: '' }}
        resolution={current.resolution}
        onDone={() => undefined}
      />,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.queryByText(/Etkinliğe özel/)).not.toBeInTheDocument();
  });
});
