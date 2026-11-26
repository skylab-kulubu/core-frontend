import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import type { Person } from '@/lib/api/identity';
import type { Ticket } from '@/lib/api/tickets';
import type { DoorSession } from '@/lib/door-check-in';
import { ParticipantRoster, type ParticipantRosterProps } from './ParticipantRoster';

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
  createdAt: '2026-11-21T10:00:00Z',
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

function setup(overrides: Partial<ParticipantRosterProps> = {}) {
  const props: ParticipantRosterProps = {
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
  render(<ParticipantRoster {...props} />);
  return props;
}

describe('ParticipantRoster', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('lists everyone and narrows to a view', async () => {
    setup();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    const views = screen.getByRole('group', { name: 'Görünüm' });
    await userEvent.click(within(views).getByText('Posta gitmedi'));
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument();
  });

  it('puts the search and the list above the charts, which fold away and stay folded', async () => {
    window.localStorage.clear();
    setup();
    const search = screen.getByRole('searchbox', { name: 'Katılımcı ara' });
    const fold = screen.getByRole('button', { name: 'Grafikler' });
    // The search comes first in the page, the charts after the list
    expect(search.compareDocumentPosition(fold) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const charts = () => document.getElementById(fold.getAttribute('aria-controls') ?? '');
    expect(fold).toHaveAttribute('aria-expanded', 'true');
    expect(charts()).toBeInTheDocument();

    await userEvent.click(fold);
    expect(fold).toHaveAttribute('aria-expanded', 'false');
    expect(charts()).toBeNull();

    cleanup();
    setup();
    expect(screen.getByRole('button', { name: 'Grafikler' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    window.localStorage.clear();
  });

  it('opens a registration beside the list on a plain click', async () => {
    const props = setup();
    await userEvent.click(screen.getByRole('link', { name: /Ada Lovelace/ }));
    expect(props.onOpenTicket).toHaveBeenCalledWith(guest);
  });

  it('mails the chosen ones only', async () => {
    const props = setup();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ada Lovelace seç' }));
    await userEvent.click(screen.getByRole('button', { name: 'E-posta' }));
    expect(props.onMail).toHaveBeenCalledWith([
      { ticketId: 't-guest', name: 'Ada Lovelace', email: 'ada@example.com' },
    ]);
  });

  it('says a refused entry in its row', async () => {
    const onMarkAttended = jest.fn().mockResolvedValue('Zaten girişi var');
    setup({ onMarkAttended });
    await userEvent.click(screen.getByRole('button', { name: 'Ada Lovelace: katıldı' }));
    expect(onMarkAttended).toHaveBeenCalledWith(guest, 's1');
    expect(await screen.findByRole('alert')).toHaveTextContent('Zaten girişi var');
  });

  it('offers to clear a filter that leaves nothing', async () => {
    setup();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Katılımcı ara' }), 'yokboyle');
    await userEvent.click(screen.getByRole('button', { name: 'Süzgeci temizle' }));
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });
});

describe('ParticipantRoster list', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('finds a registration by its ticket code, dashes or not', async () => {
    setup();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Katılımcı ara' }), 'ab12cd34');
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument();
  });

  it('sorts by name', async () => {
    setup();
    const first = () => screen.getAllByRole('link', { name: /Lovelace|Hopper/ })[0];
    expect(first()).toHaveAccessibleName('Grace Hopper');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sıralama' }), 'name');
    expect(first()).toHaveAccessibleName('Ada Lovelace');
  });

  it('keeps the view when the tab is opened again', async () => {
    setup();
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Görünüm' })).getByText('Posta gitmedi'),
    );
    cleanup();
    setup();
    expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument();
  });
});

it('shows the registration history in the panel', () => {
  setup({ openTicket: member });
  expect(screen.getByText('Giriş · Açılış')).toBeInTheDocument();
  expect(screen.getByText('Bilet gönderildi')).toBeInTheDocument();
});

describe('ParticipantRoster panel and gaps', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('says a refused Katıldı in the open panel, where it was pressed', async () => {
    const onMarkAttended = jest.fn().mockResolvedValue('Bu oturum iptal edildi.');
    setup({ openTicket: guest, onMarkAttended });
    const panel = screen.getByRole('dialog');
    await userEvent.click(within(panel).getByRole('button', { name: 'Katıldı' }));
    expect(onMarkAttended).toHaveBeenCalledWith(guest, 's1');
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Bu oturum iptal edildi.');
  });

  it('shows a registration that carries no entries and no date', () => {
    const bare = {
      ...guest,
      id: 't-bare',
      checkIns: undefined,
      createdAt: '',
    } as unknown as Ticket;
    setup({ tickets: [bare] });
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getAllByText('Gelmedi').length).toBeGreaterThan(0);
  });

  it('asks for a session when none is chosen, and stops asking once one is', async () => {
    const past = [
      {
        ...sessions[0],
        startTime: '2020-01-01T09:00:00+03:00',
        endTime: '2020-01-01T10:00:00+03:00',
      },
      {
        ...sessions[0],
        id: 's2',
        startTime: '2020-01-02T09:00:00+03:00',
        endTime: '2020-01-02T10:00:00+03:00',
      },
    ] as DoorSession[];
    setup({ sessions: past, onMarkAttended: jest.fn().mockResolvedValue(null) });
    expect(screen.getByText('Katıldı için oturum seç')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ada Lovelace: katıldı' })).toBeDisabled();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Giriş oturumu' }), 's2');
    expect(screen.queryByText('Katıldı için oturum seç')).not.toBeInTheDocument();
  });
});
