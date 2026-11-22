import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import type { Person } from '@/lib/api/identity';
import type { Ticket } from '@/lib/api/tickets';
import type { DoorSession } from '@/lib/door-check-in';
import { ParticipantsDesign, type ParticipantsDesignProps } from './ParticipantsDesign';

jest.mock('@skylab-kulubu/skylcn-ui/charts', () => ({
  AreaChart: ({ title }: { title: React.ReactNode }) => <div>{title}</div>,
  DonutChart: ({ title }: { title: React.ReactNode }) => <div>{title}</div>,
}));

const at = '2026-11-20T10:00:00Z';
const guest: Ticket = {
  id: 't-guest',
  eventId: 'e1',
  ticketType: 'GUEST',
  guestFirstName: 'Ada',
  guestLastName: 'Lovelace',
  guestEmail: 'ada@example.com',
  code: 'AB12-CD34',
  sent: false,
  checkIns: [],
  createdAt: at,
  updatedAt: at,
};
const member: Ticket = {
  id: 't-member',
  eventId: 'e1',
  ticketType: 'REGISTERED',
  ownerId: 'u1',
  sent: true,
  checkIns: [{ id: 'c1', ticketId: 't-member', sessionId: 's1', eventDayId: 'd1', createdAt: at }],
  createdAt: at,
  updatedAt: at,
};
const people = new Map<string, Person>([
  ['u1', { id: 'u1', email: 'grace@example.com', firstName: 'Grace', lastName: 'Hopper' }],
]);
const sessions: DoorSession[] = [
  {
    id: 's1',
    title: 'Açılış',
    startTime: '2026-11-22T09:00:00+03:00',
    endTime: '2026-11-22T10:00:00+03:00',
  } as DoorSession,
];

function setup(overrides: Partial<ParticipantsDesignProps> = {}) {
  const props: ParticipantsDesignProps = {
    variant: 'a',
    eventId: 'e1',
    tickets: [guest, member],
    people,
    event: { id: 'e1' },
    sessions,
    openTicket: null,
    onOpenTicket: jest.fn(),
    onMail: jest.fn(),
    dialogs: null,
    ...overrides,
  };
  render(<ParticipantsDesign {...props} />);
  return props;
}

describe.each(['a', 'b'] as const)('ParticipantsDesign %s', (variant) => {
  it('lists everyone and narrows to a view', async () => {
    setup({ variant });
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    const views = screen.getByRole(variant === 'a' ? 'group' : 'tablist', {
      name: 'Görünüm',
    });
    await userEvent.click(within(views).getByText('Bilet gitmedi'));
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument();
  });

  it('opens a registration beside the list on a plain click', async () => {
    const props = setup({ variant });
    await userEvent.click(screen.getByRole('link', { name: /Ada Lovelace/ }));
    expect(props.onOpenTicket).toHaveBeenCalledWith(guest);
  });

  it('mails the chosen ones only', async () => {
    const props = setup({ variant });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ada Lovelace seç' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mail' }));
    expect(props.onMail).toHaveBeenCalledWith([
      { ticketId: 't-guest', name: 'Ada Lovelace', email: 'ada@example.com' },
    ]);
  });

  it('says a refused entry in its row', async () => {
    const onMarkAttended = jest.fn().mockResolvedValue('Zaten girişi var');
    setup({ variant, onMarkAttended });
    await userEvent.click(screen.getByRole('button', { name: 'Ada Lovelace: katıldı' }));
    expect(onMarkAttended).toHaveBeenCalledWith(guest, 's1');
    expect(await screen.findByRole('alert')).toHaveTextContent('Zaten girişi var');
  });

  it('offers to clear a filter that leaves nothing', async () => {
    setup({ variant });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Katılımcı ara' }), 'yokboyle');
    await userEvent.click(screen.getByRole('button', { name: 'Süzgeci temizle' }));
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });
});

it('shows the registration history in the panel', () => {
  setup({ variant: 'a', openTicket: member });
  expect(screen.getByText('Giriş · Açılış')).toBeInTheDocument();
  expect(screen.getByText('Bilet gönderildi')).toBeInTheDocument();
});
