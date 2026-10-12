import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EditCompetitorPage from '@/app/(authorized)/events/[id]/competition/[competitorId]/page';
import { ProblemError } from '@/lib/api/core';
import { competitorsApi } from '@/lib/api/competitors';
import { eventsApi } from '@/lib/api/events';

const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockAuth = { user: { id: 'yk', groups: ['/UYELER/YK'], roles: [] } };

jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/lib/api/events', () => ({ eventsApi: { get: jest.fn() } }));
jest.mock('@/lib/api/competitors', () => ({
  competitorsApi: { get: jest.fn(), update: jest.fn(), delete: jest.fn(), reinstate: jest.fn() },
}));
jest.mock('@/lib/api/identity', () => ({
  identityApi: { listUsers: jest.fn(), getUser: jest.fn().mockResolvedValue(undefined) },
}));

const competitor = {
  id: 'c1',
  userId: 'u1',
  eventId: 'e2',
  score: 5,
  isWinner: false,
  createdAt: '',
  updatedAt: '',
};

async function renderEdit(eventId: string) {
  await act(async () => {
    render(<EditCompetitorPage params={Promise.resolve({ id: eventId, competitorId: 'c1' })} />);
  });
}

describe('Event Yarışma: edit competitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (competitorsApi.get as jest.Mock).mockResolvedValue(competitor);
    (eventsApi.get as jest.Mock).mockResolvedValue({
      id: 'e2',
      name: 'Hackathon',
      ownerTeam: 'GECEKODU',
      active: true,
    });
  });

  it('opens the competitor under its own event when the address names another', async () => {
    await renderEdit('e1');
    expect(mockRouter.replace).toHaveBeenCalledWith('/events/e2/competition/c1');
    expect(eventsApi.get).not.toHaveBeenCalled();
  });

  it('shows the competitor of the event in the address', async () => {
    await renderEdit('e2');
    expect(await screen.findByText('Hackathon')).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('keeps the form when saving fails, with the error beside it', async () => {
    const user = userEvent.setup();
    (competitorsApi.update as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { detail: 'competitor exists' }),
    );
    await renderEdit('e2');
    await user.click(await screen.findByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kayıt şu anki durumunda buna uygun değil',
    );
    expect(screen.getByLabelText('Puan')).toHaveValue(5);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('says the competitor was saved and deleted', async () => {
    const user = userEvent.setup();
    (competitorsApi.update as jest.Mock).mockResolvedValue(competitor);
    (competitorsApi.delete as jest.Mock).mockResolvedValue(undefined);
    await renderEdit('e2');
    await user.click(await screen.findByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByText('Yarışmacı kaydedildi')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sil' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Yarışmacı Hackathon yarışmasından silinsin mi?',
    });
    expect(competitorsApi.delete).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Yarışmacıyı sil' }));
    await waitFor(() => expect(competitorsApi.delete).toHaveBeenCalledWith('c1'));
    expect(await screen.findByText('Yarışmacı silindi')).toBeInTheDocument();
    expect(mockRouter.push).toHaveBeenLastCalledWith('/events/e2/competition');
  });

  it('brings a deleted competitor back with Geri al and opens it', async () => {
    const user = userEvent.setup();
    (competitorsApi.delete as jest.Mock).mockResolvedValue(undefined);
    (competitorsApi.reinstate as jest.Mock).mockResolvedValue(competitor);
    await renderEdit('e2');
    await user.click(await screen.findByRole('button', { name: 'Sil' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Yarışmacıyı sil',
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'Geri al' }));
    await waitFor(() => expect(competitorsApi.reinstate).toHaveBeenCalledWith('c1'));
    expect(await screen.findByText('Yarışmacı geri alındı')).toBeInTheDocument();
    expect(mockRouter.push).toHaveBeenLastCalledWith('/events/e2/competition/c1');
  });

  it('shows a refused delete instead of failing silently', async () => {
    const user = userEvent.setup();
    (competitorsApi.delete as jest.Mock).mockRejectedValue(
      new ProblemError(403, 'Forbidden', { detail: 'missing role' }),
    );
    await renderEdit('e2');
    await user.click(await screen.findByRole('button', { name: 'Sil' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Yarışmacıyı sil' }));
    expect(await within(confirm).findByRole('alert')).toHaveTextContent(
      'Bu işlem için yetkin yok.',
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('offers no Geri al when the event is not active, as core cannot reinstate there', async () => {
    const user = userEvent.setup();
    (eventsApi.get as jest.Mock).mockResolvedValue({
      id: 'e2',
      name: 'Hackathon',
      ownerTeam: 'GECEKODU',
      active: false,
    });
    (competitorsApi.delete as jest.Mock).mockResolvedValue(undefined);
    await renderEdit('e2');
    await user.click(await screen.findByRole('button', { name: 'Sil' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Etkinlik aktif olmadığı için geri alınamaz.');
    expect(confirm).not.toHaveTextContent('Geri al ile');
    await user.click(within(confirm).getByRole('button', { name: 'Yarışmacıyı sil' }));
    await waitFor(() => expect(competitorsApi.delete).toHaveBeenCalledWith('c1'));
    expect(await screen.findByText('Yarışmacı silindi')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Geri al' })).not.toBeInTheDocument();
  });
});
