import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { useEventCopy } from '@/components/scheduling/EventCopyDialog';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { ProblemError } from '@/lib/api/core';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { teamsApi } from '@/lib/api/teams';
import { copySkippedStorageKey } from '@/lib/event-copy';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));
jest.mock('@/lib/api/events', () => ({
  eventsApi: { copy: jest.fn(), listCompetitions: jest.fn() },
}));
jest.mock('@/lib/api/teams', () => ({ teamsApi: { list: jest.fn() } }));
jest.mock('@/lib/api/capabilities', () => ({ capabilitiesApi: { get: jest.fn() } }));

// jsdom has no PointerEvent; base-ui's Checkbox sends one to its hidden input on a click
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
  }
});

const source: CoreEvent = {
  id: 'e1',
  name: 'Gecekodu 2026',
  description: '',
  location: 'YTÜ',
  ownerTeam: 'GECEKODU',
  capacity: 0,
  active: true,
  ranked: false,
  status: 'published',
  startDate: new Date(2099, 2, 14, 19, 0).toISOString(),
  endDate: new Date(2099, 2, 15, 3, 0).toISOString(),
  doorStaffIds: ['u2', 'u3', 'u4'],
  createdAt: '',
  updatedAt: '',
};

function Harness({ event = source }: { event?: CoreEvent }) {
  const copy = useEventCopy();
  return (
    <>
      {copy.canCopy(event) ? (
        <button type="button" onClick={() => copy.askCopy(event)}>
          Kopyala…
        </button>
      ) : (
        <p>Kopya yok</p>
      )}
      {copy.dialog}
    </>
  );
}

function capabilities(teams: Array<{ team: string; can: Record<string, boolean> }>) {
  (capabilitiesApi.get as jest.Mock).mockResolvedValue({ teams });
}

const LEADER = [
  {
    team: 'GECEKODU',
    can: { 'event.create': true, 'event.update': true, 'event.assignDoorStaff': true },
  },
];

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Kopyala…' }));
  return screen.findByRole('dialog', { name: 'Etkinliği kopyala' });
}

describe('Kopya diyaloğu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    (eventsApi.listCompetitions as jest.Mock).mockResolvedValue([]);
    (teamsApi.list as jest.Mock).mockResolvedValue([]);
    (eventsApi.copy as jest.Mock).mockResolvedValue({
      event: { ...source, id: 'c1', status: 'draft' },
      skipped: [],
    });
  });

  it('asks only the name, the start and what the reader may copy, with no explanation', async () => {
    capabilities(LEADER);
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    expect(within(dialog).getByDisplayValue('Gecekodu 2026 (kopya)')).toBeInTheDocument();
    expect(within(dialog).getByText(/^Bitiş:/)).toHaveTextContent('2100');
    expect(
      within(dialog).getByRole('checkbox', { name: 'Kapı görevlilerini de kopyala (3 kişi)' }),
    ).not.toBeChecked();
    // One team: no team select; no competitions: no competitions box
    expect(within(dialog).queryByText('Ekip')).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Yarışmaları da kopyala/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/taslak/i)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Kopyala' })).toBeInTheDocument();
  });

  it('offers the competitions with their count, off by default', async () => {
    capabilities(LEADER);
    (eventsApi.listCompetitions as jest.Mock).mockResolvedValue([
      { id: 'k1', name: 'CTF' },
      { id: 'k2', name: 'Hackathon' },
    ]);
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    const box = await within(dialog).findByRole('checkbox', {
      name: 'Yarışmaları da kopyala (2 yarışma)',
    });
    expect(box).not.toBeChecked();
    await user.click(box);
    await user.click(within(dialog).getByRole('button', { name: 'Kopyala' }));
    expect(eventsApi.copy).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ includeCompetitions: true, includeDoorStaff: false }),
    );
  });

  it('hides the door staff box from who may not assign them', async () => {
    capabilities([{ team: 'GECEKODU', can: { 'event.create': true, 'event.update': true } }]);
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    expect(within(dialog).queryByText(/Kapı görevlilerini/)).not.toBeInTheDocument();
  });

  it('lists the teams core lets the reader create in, and sends the chosen one', async () => {
    capabilities([...LEADER, { team: 'AIRLAB', can: { 'event.create': true } }]);
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    const select = await within(dialog).findByRole('combobox');
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['GECEKODU', 'AIRLAB']);
    await user.selectOptions(select, 'AIRLAB');
    await user.click(within(dialog).getByRole('button', { name: 'Kopyala' }));
    expect(eventsApi.copy).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ ownerTeam: 'AIRLAB', name: 'Gecekodu 2026 (kopya)' }),
    );
  });

  it('shows the door staff box as it will be sent after a round trip through another team', async () => {
    // AIRLAB: creates there, may not assign door staff
    capabilities([...LEADER, { team: 'AIRLAB', can: { 'event.create': true } }]);
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    const doorBox = () =>
      within(dialog).queryByRole('checkbox', { name: 'Kapı görevlilerini de kopyala (3 kişi)' });
    await user.click(await within(dialog).findByRole('checkbox', { name: /Kapı görevlilerini/ }));
    const select = await within(dialog).findByRole('combobox');
    await user.selectOptions(select, 'AIRLAB');
    expect(doorBox()).not.toBeInTheDocument();
    await user.selectOptions(select, 'GECEKODU');
    expect(doorBox()).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Kopyala' }));
    expect(eventsApi.copy).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ includeDoorStaff: true }),
    );
  });

  it('leaves the Owner team out for a copy in the source team', async () => {
    capabilities(LEADER);
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Kopyala' }));
    const body = (eventsApi.copy as jest.Mock).mock.calls[0][1];
    expect(body).not.toHaveProperty('ownerTeam');
    expect(body.startDate).toBe(new Date(2100, 2, 14, 19, 0).toISOString());
  });

  it('sends the same id again after a failure, and a new one for the next dialog', async () => {
    capabilities(LEADER);
    (eventsApi.copy as jest.Mock)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({ event: { ...source, id: 'c1' }, skipped: [] });
    const user = userEvent.setup();
    render(<Harness />);
    let dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Kopyala' }));
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Kopyala' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/events/c1'));
    const [first, second] = (eventsApi.copy as jest.Mock).mock.calls.map((call) => call[1].id);
    expect(first).toBeTruthy();
    expect(second).toBe(first);

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Etkinliği kopyala' })).not.toBeInTheDocument(),
    );
    dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Kopyala' }));
    await waitFor(() => expect(eventsApi.copy).toHaveBeenCalledTimes(3));
    expect((eventsApi.copy as jest.Mock).mock.calls[2][1].id).not.toBe(first);
  });

  it('sends one request for a double click', async () => {
    capabilities(LEADER);
    let answer: (value: unknown) => void = () => undefined;
    (eventsApi.copy as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    const button = within(dialog).getByRole('button', { name: 'Kopyala' });
    await user.dblClick(button);
    answer({ event: { ...source, id: 'c1' }, skipped: [] });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(eventsApi.copy).toHaveBeenCalledTimes(1);
  });

  it('keeps what core left out for the copy page and opens it', async () => {
    capabilities(LEADER);
    (eventsApi.copy as jest.Mock).mockResolvedValue({
      event: { ...source, id: 'c1' },
      skipped: ['certificateTemplate'],
    });
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Kopyala' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/events/c1'));
    expect(sessionStorage.getItem(copySkippedStorageKey('c1'))).toBe('["certificateTemplate"]');
  });

  it('says a refusal in the dialog', async () => {
    capabilities(LEADER);
    (eventsApi.copy as jest.Mock).mockRejectedValue(new ProblemError(403, 'Forbidden'));
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Kopyala' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Bu ekipte etkinlik oluşturma yetkin yok.',
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('offers no copy to a reader core lets create nothing (DK)', async () => {
    capabilities([{ team: 'GECEKODU', can: { 'event.create': false, 'event.update': false } }]);
    render(<Harness />);
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(await screen.findByText('Kopya yok')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kopyala…' })).not.toBeInTheDocument();
  });
});
