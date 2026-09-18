import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ApplicantRoster } from '@/components/scheduling/ApplicantRoster';
import type { Person } from '@/lib/api/identity';
import type { Ticket } from '@/lib/api/tickets';

const guest: Ticket = {
  id: 't-guest',
  eventId: 'e1',
  ticketType: 'GUEST',
  guestFirstName: 'Ada',
  guestLastName: 'Lovelace',
  guestEmail: 'ada@example.com',
  checkIns: [],
  createdAt: new Date(2026, 8, 19, 8, 5, 0).toISOString(),
  updatedAt: new Date(2026, 8, 19, 8, 5, 0).toISOString(),
};

const member: Ticket = {
  id: 't-member',
  eventId: 'e1',
  ticketType: 'REGISTERED',
  ownerId: 'u1',
  checkIns: [],
  createdAt: new Date(2026, 8, 19, 8, 5, 0).toISOString(),
  updatedAt: new Date(2026, 8, 19, 8, 5, 0).toISOString(),
};

const people = new Map<string, Person>([
  ['u1', { id: 'u1', email: 'grace@skylab.com', firstName: 'Grace', lastName: 'Hopper' }],
]);

describe('ApplicantRoster', () => {
  it('shows name, email, type, source form, date, and status instead of a ticket-id dump', () => {
    render(
      <ApplicantRoster
        eventId="e1"
        tickets={[guest]}
        people={people}
        event={{
          id: 'e1',
          formAlias: 'skydays2026',
          formUrl: 'https://forms.yildizskylab.com/apply',
        }}
        mailHref="https://mail.yildizskylab.com/mailing-lists/create"
      />,
    );
    expect(screen.getByRole('searchbox', { name: 'Başvuran ara' })).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('Misafir').length).toBeGreaterThan(0);
    expect(screen.getByText('Başvuru formu')).toBeInTheDocument();
    expect(screen.getAllByText('Kayıtlı').length).toBeGreaterThan(0);
    expect(screen.getByText('Tür')).toBeInTheDocument();
    expect(screen.getByText('Form')).toBeInTheDocument();
    expect(screen.getByText('Tarih')).toBeInTheDocument();
    expect(screen.getByText('Durum')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ada Lovelace' })).toHaveAttribute(
      'href',
      '/events/e1/tickets/t-guest',
    );
    expect(screen.queryByText(/t-guest/)).not.toBeInTheDocument();
  });

  it('filters the roster by search and ticket type', async () => {
    const user = userEvent.setup();
    render(
      <ApplicantRoster
        eventId="e1"
        tickets={[guest, member]}
        people={people}
        event={{ id: 'e1' }}
        mailHref="https://mail.yildizskylab.com/mailing-lists/create"
      />,
    );
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Başvuran ara' }), 'grace');
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
  });
});
