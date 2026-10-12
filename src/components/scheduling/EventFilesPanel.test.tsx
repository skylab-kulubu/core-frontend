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

  it('treats a 404 for a file that is no longer listed as done: closes and shows the list now', async () => {
    const user = userEvent.setup();
    const onEvent = jest.fn();
    (eventMediaApi.remove as jest.Mock).mockRejectedValue(new ProblemError(404, 'Not Found'));
    (eventsApi.get as jest.Mock).mockResolvedValue(emptied);
    render(<EventFilesPanel event={event} canEdit onEvent={onEvent} />);

    await user.click(screen.getByRole('button', { name: 'Kaldır' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'program.pdf kaldırılsın mı?' });
    await user.click(within(confirm).getByRole('button', { name: 'Kaldır' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(onEvent).toHaveBeenCalledWith(emptied);
    expect(await screen.findByText('program.pdf zaten kaldırılmış')).toBeInTheDocument();
  });

  it('keeps the dialog with the error when a 404 file is still listed', async () => {
    const user = userEvent.setup();
    const onEvent = jest.fn();
    (eventMediaApi.remove as jest.Mock).mockRejectedValue(new ProblemError(404, 'Not Found'));
    (eventsApi.get as jest.Mock).mockResolvedValue(event);
    render(<EventFilesPanel event={event} canEdit onEvent={onEvent} />);

    await user.click(screen.getByRole('button', { name: 'Kaldır' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Kaldır' }));
    expect(await within(confirm).findByRole('alert')).toBeInTheDocument();
    expect(onEvent).toHaveBeenCalledWith(event);
    expect(screen.queryByText(/kaldırıldı|kaldırılmış/)).not.toBeInTheDocument();
  });

  it('does not count a 409 as removed', async () => {
    const user = userEvent.setup();
    (eventMediaApi.remove as jest.Mock).mockRejectedValue(new ProblemError(409, 'Conflict'));
    render(<EventFilesPanel event={event} canEdit onEvent={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Kaldır' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Kaldır' }));
    expect(await within(confirm).findByRole('alert')).toBeInTheDocument();
    expect(eventsApi.get).not.toHaveBeenCalled();
    expect(screen.queryByText(/kaldırıldı|kaldırılmış/)).not.toBeInTheDocument();
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
