import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { CompetitionBoard } from '@/components/scheduling/CompetitionBoard';
import { ProblemError } from '@/lib/api/core';
import { competitionsApi } from '@/lib/api/competitions';

jest.mock('@/lib/api/competitions', () => ({
  ...jest.requireActual('@/lib/api/competitions'),
  competitionsApi: {
    listByEvent: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    move: jest.fn(),
    cancel: jest.fn(),
    candidates: jest.fn(),
    addEntrants: jest.fn(),
    score: jest.fn(),
    entries: jest.fn(),
    leaderboard: jest.fn(),
  },
}));

const api = competitionsApi as jest.Mocked<typeof competitionsApi>;

const competition = {
  id: 'c1',
  eventId: 'e1',
  ownerTeam: 'GECEKODU',
  name: 'Kod yarışı',
  description: '',
  entrantMode: 'individual',
  status: 'running' as const,
  stages: [],
  createdAt: '',
  updatedAt: '',
};

const board = {
  competitionId: 'c1',
  stageId: 'st1',
  strategy: 'manual',
  rows: [
    { rank: 1, entrantId: 'n1', displayName: 'Ada Lovelace', score: 50, entryId: 'x1' },
    { rank: null, entrantId: 'n2', displayName: 'Grace Hopper', score: null, entryId: null },
  ],
};

describe('CompetitionBoard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState(null, '', '/events/e1/competition');
    api.listByEvent.mockResolvedValue([competition]);
    api.leaderboard.mockResolvedValue(board);
    api.score.mockResolvedValue({ id: 'x2', entrantId: 'n2', points: 30, recordedAt: '' });
  });

  it('says there is none yet and offers to add one to who manages', async () => {
    api.listByEvent.mockResolvedValue([]);
    render(<CompetitionBoard eventId="e1" canManage />);
    expect(await screen.findByText('Henüz yarışma yok')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yarışma ekle' })).toBeInTheDocument();
  });

  it('creates a competition from its name', async () => {
    api.listByEvent.mockResolvedValue([]);
    api.create.mockResolvedValue({ ...competition, status: 'draft' });
    const user = userEvent.setup();
    render(<CompetitionBoard eventId="e1" canManage />);
    await user.click(await screen.findByRole('button', { name: 'Yarışma ekle' }));
    const drawer = await screen.findByRole('dialog', { name: 'Yarışma ekle' });
    await user.type(within(drawer).getByLabelText('Ad'), 'Kod yarışı');
    await user.click(within(drawer).getByRole('button', { name: 'Kaydet' }));
    expect(api.create).toHaveBeenCalledWith('e1', { name: 'Kod yarışı', description: '' });
    expect(await screen.findByRole('heading', { name: 'Kod yarışı' })).toBeInTheDocument();
    expect(window.location.search).toBe('?yarisma=c1');
  });

  it('shows the table with its figures and writes a first score in place', async () => {
    const user = userEvent.setup();
    render(<CompetitionBoard eventId="e1" canManage />);
    expect((await screen.findAllByText('Ada Lovelace')).length).toBeGreaterThan(0);
    const figures = screen.getByRole('group', { name: 'Özet' });
    expect(within(figures).getByText('Puanlanan').nextSibling).toHaveTextContent('1');
    await user.type(screen.getByLabelText('Grace Hopper: puan'), '30,5{Enter}');
    await waitFor(() =>
      expect(api.score).toHaveBeenCalledWith('c1', { entrantId: 'n2', points: 30.5 }),
    );
  });

  it('asks why before correcting a written score and names the score it replaces', async () => {
    const user = userEvent.setup();
    render(<CompetitionBoard eventId="e1" canManage />);
    const cell = await screen.findByLabelText('Ada Lovelace: puan');
    await user.clear(cell);
    await user.type(cell, '55{Enter}');
    const dialog = await screen.findByRole('alertdialog');
    await user.type(within(dialog).getByLabelText('Neden'), 'Jüri düzeltti');
    await user.click(within(dialog).getByRole('button', { name: 'Puanı düzelt' }));
    await waitFor(() =>
      expect(api.score).toHaveBeenCalledWith('c1', {
        entrantId: 'n1',
        points: 55,
        replacesId: 'x1',
        reason: 'Jüri düzeltti',
      }),
    );
  });

  it('says another organizer changed the score meanwhile and reads the table again', async () => {
    api.score.mockRejectedValue(new ProblemError(409, 'Conflict', { code: 'score_changed' }));
    const user = userEvent.setup();
    render(<CompetitionBoard eventId="e1" canManage />);
    await user.type(await screen.findByLabelText('Grace Hopper: puan'), '10{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('başka biri puanı değiştirdi');
    await waitFor(() => expect(api.leaderboard).toHaveBeenCalledTimes(2));
  });

  it('leaves the scores read-only for who does not manage', async () => {
    render(<CompetitionBoard eventId="e1" canManage={false} />);
    expect((await screen.findAllByText('Ada Lovelace')).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Grace Hopper: puan')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Katılımcı ekle' })).not.toBeInTheDocument();
  });

  it('adds those who came in as entrants', async () => {
    api.candidates.mockResolvedValue([
      {
        ticketId: 't1',
        displayName: 'Linus T',
        ticketType: 'REGISTERED',
        checkedIn: true,
        entrant: false,
      },
      {
        ticketId: 't2',
        displayName: 'Ken T',
        ticketType: 'GUEST',
        checkedIn: false,
        entrant: false,
      },
      {
        ticketId: 't3',
        displayName: 'Ada Lovelace',
        ticketType: 'REGISTERED',
        checkedIn: true,
        entrant: true,
      },
    ]);
    api.addEntrants.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<CompetitionBoard eventId="e1" canManage />);
    await user.click(await screen.findByRole('button', { name: 'Katılımcı ekle' }));
    const drawer = await screen.findByRole('dialog', { name: 'Katılımcı ekle' });
    await user.click(await within(drawer).findByRole('checkbox', { name: /Linus T/ }));
    expect(within(drawer).queryByText('Ken T')).not.toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: '1 kişiyi ekle' }));
    expect(api.addEntrants).toHaveBeenCalledWith('c1', ['t1']);
  });

  it('moves the status with its own command', async () => {
    api.move.mockResolvedValue({ ...competition, status: 'closed' });
    const user = userEvent.setup();
    render(<CompetitionBoard eventId="e1" canManage />);
    await user.click(await screen.findByRole('button', { name: 'Kapat' }));
    expect(api.move).toHaveBeenCalledWith('c1', 'close');
    expect(await screen.findByText('Kapandı')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yeniden aç' })).toBeInTheDocument();
  });
});
