import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventFilesPanel } from '@/components/scheduling/EventFilesPanel';
import { ProblemError } from '@/lib/api/core';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { eventMediaApi } from '@/lib/api/uploads';

jest.mock('@/lib/api/events', () => ({ eventsApi: { get: jest.fn() } }));
jest.mock('@/lib/api/uploads', () => ({
  ...jest.requireActual('@/lib/api/uploads'),
  eventMediaApi: { remove: jest.fn(), add: jest.fn(), order: jest.fn() },
}));
jest.mock('@/lib/uploads/direct-upload', () => ({
  ...jest.requireActual('@/lib/uploads/direct-upload'),
  interruptedUploads: () => [],
}));

const file = {
  id: 'f1',
  name: 'program.pdf',
  type: 'application/pdf',
  size: 1024,
  status: 'ready',
};
const event = { id: 'e1', name: 'GeceKodu', files: [file], videos: [] } as unknown as CoreEvent;
const emptied = { ...event, files: [] } as CoreEvent;

describe('EventFilesPanel removal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('counts a removal core says is already gone as done: closes, says so, shows the list now', async () => {
    const user = userEvent.setup();
    const onEvent = jest.fn();
    (eventMediaApi.remove as jest.Mock).mockRejectedValue(new ProblemError(409, 'Conflict'));
    (eventsApi.get as jest.Mock).mockResolvedValue(emptied);
    render(<EventFilesPanel event={event} canEdit onEvent={onEvent} />);

    await user.click(screen.getByRole('button', { name: 'Kaldır' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'program.pdf kaldırılsın mı?' });
    await user.click(within(confirm).getByRole('button', { name: 'Kaldır' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(onEvent).toHaveBeenCalledWith(emptied);
    expect(await screen.findByText('program.pdf kaldırıldı')).toBeInTheDocument();
  });

  it('says any other refusal inside the dialog', async () => {
    const user = userEvent.setup();
    (eventMediaApi.remove as jest.Mock).mockRejectedValue(new ProblemError(403, 'Forbidden'));
    render(<EventFilesPanel event={event} canEdit onEvent={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Kaldır' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Kaldır' }));
    expect(await within(confirm).findByRole('alert')).toBeInTheDocument();
    expect(confirm).not.toHaveTextContent('Forbidden');
  });
});
