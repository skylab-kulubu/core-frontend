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

function setup(overrides: Partial<ParticipantRosterProps> = {}) {
  const props: ParticipantRosterProps = {
    eventId: 'e1',
    tickets: [guest('a1', 'Ali')],
    people: new Map(),
    event: { id: 'e1' },
    sessions: [],
    openTicket: null,
    onOpenTicket: jest.fn(),
    onMail: jest.fn(),
    onCancel: jest.fn(),
    dialogs: null,
    ...overrides,
  };
  render(<ParticipantRoster {...props} />);
  return props;
}

describe('ParticipantRoster form respondents', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('offers the two respondent views with their counts and shows their list in place', async () => {
    const user = userEvent.setup();
    const renderRespondents = jest.fn((view: string, query: string) => (
      <p>{`liste:${view}:${query}`}</p>
    ));
    setup({ respondentCounts: { unticketed: 3, formsPending: 1 }, renderRespondents });

    const pills = within(screen.getByRole('group', { name: 'Görünüm' }));
    await user.click(pills.getByText('Bilet gönderilmedi'));
    expect(screen.getByText('liste:unticketed:')).toBeInTheDocument();
    // Not Tickets: no mail, no sorting, no Ticket rows
    expect(screen.queryByRole('button', { name: 'E-posta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Sıralama' })).not.toBeInTheDocument();
    expect(screen.queryByText('Ali Kaya')).not.toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Katılımcı ara' }), 'ay');
    expect(screen.getByText('liste:unticketed:ay')).toBeInTheDocument();

    await user.click(pills.getByText('Forms’ta onay bekliyor'));
    expect(screen.getByText('liste:formsPending:ay')).toBeInTheDocument();
  });

  it('offers neither view to a core without respondents, nor one with none', () => {
    setup();
    expect(screen.queryByText('Bilet gönderilmedi')).not.toBeInTheDocument();
    window.sessionStorage.clear();
  });

  it('warns on a Ticket whose answer Forms declined, with its cancel one click away', async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    const rejected = guest('r1', 'Rana', {
      formsStatus: 'declined',
      formsRejectedAt: '2026-11-24T10:00:00Z',
    });
    const pending = guest('p1', 'Pelin', { formsStatus: 'pending' });
    setup({
      tickets: [rejected, pending, guest('a1', 'Ali', { formsStatus: 'accepted' })],
      onCancel,
    });

    expect(screen.getAllByText('Forms’ta reddedildi')).toHaveLength(1);
    expect(screen.getAllByText('Forms’ta yeniden onay bekliyor')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Rana Kaya: bileti iptal et' }));
    expect(onCancel).toHaveBeenCalledWith(rejected);
    expect(
      screen.queryByRole('button', { name: 'Ali Kaya: bileti iptal et' }),
    ).not.toBeInTheDocument();
  });

  it('warns on a waitlisted Ticket Forms declined too', async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    const waiting = guest('w1', 'Vural', {
      status: 'waitlisted',
      waitlistedAt: '2026-11-23T10:00:00Z',
      formsRejectedAt: '2026-11-24T10:00:00Z',
    });
    setup({ waitlistedTickets: [waiting], capacity: 1, onCancel });
    const pills = within(screen.getByRole('group', { name: 'Görünüm' }));
    await user.click(pills.getByText('Bekleme listesi'));
    expect(screen.getByText('Forms’ta reddedildi')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Vural Kaya: bileti iptal et' }));
    expect(onCancel).toHaveBeenCalledWith(waiting);
  });

  it('keeps the respondent views when they cannot be read now', () => {
    setup({
      respondentCounts: { unticketed: 0, formsPending: 0, failed: true },
      renderRespondents: () => null,
    });
    const pills = within(screen.getByRole('group', { name: 'Görünüm' }));
    expect(pills.getByText('Bilet gönderilmedi')).toBeInTheDocument();
  });
});
