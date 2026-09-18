import { render, screen } from '@testing-library/react';
import React from 'react';
import { TicketDetailView } from '@/components/scheduling/TicketDetailView';
import type { Ticket } from '@/lib/api/tickets';

describe('TicketDetailView', () => {
  it('shows labeled ticket fields instead of a raw dump', () => {
    const ticket: Ticket = {
      id: 't-guest',
      eventId: 'e1',
      ticketType: 'GUEST',
      guestFirstName: 'Ada',
      guestLastName: 'Lovelace',
      guestEmail: 'ada@example.com',
      guestPhoneNumber: '555',
      guestUniversity: 'YTÜ',
      checkIns: [],
      createdAt: new Date(2026, 8, 19, 8, 5, 0).toISOString(),
      updatedAt: new Date(2026, 8, 19, 8, 5, 0).toISOString(),
    };
    render(
      <TicketDetailView
        ticket={ticket}
        people={new Map()}
        event={{ id: 'e1', name: 'SkyDays', formAlias: 'skydays2026' }}
      />,
    );
    expect(screen.getByText('Ad')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('E-posta')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('Telefon')).toBeInTheDocument();
    expect(screen.getByText('Bilet türü')).toBeInTheDocument();
    expect(screen.getByText('Misafir')).toBeInTheDocument();
    expect(screen.getByText('Kaynak form')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Başvuru formu' })).toHaveAttribute(
      'href',
      'https://skyl.app/skydays2026',
    );
    expect(screen.getByText('Üniversite')).toBeInTheDocument();
    expect(screen.queryByText('guestFirstName')).not.toBeInTheDocument();
  });
});
