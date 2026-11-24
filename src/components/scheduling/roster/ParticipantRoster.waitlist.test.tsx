import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import type { Ticket } from '@/lib/api/tickets';
import { ParticipantRoster, type ParticipantRosterProps } from './ParticipantRoster';

jest.mock('@skylab-kulubu/skylcn-ui/charts', () => ({
  AreaChart: ({ title }: { title: React.ReactNode }) => <div>{title}</div>,
  DonutChart: ({ title }: { title: React.ReactNode }) => <div>{title}</div>,
}));

const guest = (id: string, first: string, extra: Partial<Ticket> = {}): Ticket => ({
  id,
  eventId: 'e1',
  ticketType: 'GUEST',
  guestFirstName: first,
  guestLastName: 'Kaya',
  guestEmail: `${id}@example.com`,
  checkIns: [],
  createdAt: '2026-11-20T10:00:00Z',
  updatedAt: '2026-11-20T10:00:00Z',
  status: 'active',
  ...extra,
});

const active = [guest('a1', 'Ali'), guest('a2', 'Ayşe')];
const waiting = [
  guest('w2', 'Zeynep', { status: 'waitlisted', waitlistedAt: '2026-11-23T10:00:00Z' }),
  guest('w1', 'Mert', { status: 'waitlisted', waitlistedAt: '2026-11-22T10:00:00Z' }),
];

function setup(overrides: Partial<ParticipantRosterProps> = {}) {
  const props: ParticipantRosterProps = {
    eventId: 'e1',
    tickets: active,
    waitlistedTickets: waiting,
    capacity: 2,
    people: new Map(),
    event: { id: 'e1' },
    sessions: [],
    openTicket: null,
    onOpenTicket: jest.fn(),
    onMail: jest.fn(),
    onPromote: jest.fn(),
    onCancel: jest.fn(),
    dialogs: null,
    ...overrides,
  };
  render(<ParticipantRoster {...props} />);
  return props;
}

describe('ParticipantRoster waiting list', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('says the capacity and how many wait', () => {
    setup();
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.getByText('Dolu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bekleme listesi, 2 kişi' })).toBeInTheDocument();
  });

  it('lists the waiting ones in their order, apart from the active ones', async () => {
    setup();
    expect(screen.queryByText('Mert Kaya')).not.toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Görünüm' })).getByText('Bekleme listesi'),
    );
    expect(screen.queryByText('Ali Kaya')).not.toBeInTheDocument();
    const names = screen.getAllByRole('link').map((link) => link.getAttribute('aria-label'));
    expect(names).toEqual(['Mert Kaya', 'Zeynep Kaya']);
    expect(screen.getAllByText(/^Sırada 1/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Sırada 2/).length).toBeGreaterThan(0);
  });

  it('offers Öne al and Listeden çıkar on a waiting ticket', async () => {
    const props = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Bekleme listesi, 2 kişi' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mert Kaya: öne al' }));
    expect(props.onPromote).toHaveBeenCalledWith(waiting[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Mert Kaya: eylemler' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Listeden çıkar' }));
    expect(props.onCancel).toHaveBeenCalledWith(waiting[1]);
  });

  it('shows no capacity strip for an Event without a bound or a list', () => {
    setup({ capacity: 0, waitlistedTickets: [] });
    expect(screen.queryByText('Kontenjan')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bekleme listesi,/ })).not.toBeInTheDocument();
  });
});
