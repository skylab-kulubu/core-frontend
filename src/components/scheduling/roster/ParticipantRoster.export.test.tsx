import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import type { Ticket } from '@/lib/api/tickets';
import { ParticipantRoster } from './ParticipantRoster';

jest.mock('@skylab-kulubu/skylcn-ui/charts', () => ({
  AreaChart: ({ title }: { title: React.ReactNode }) => <div>{title}</div>,
  DonutChart: ({ title }: { title: React.ReactNode }) => <div>{title}</div>,
}));

const at = '2026-11-20T10:00:00Z';
const ticket = (id: string, first: string, sent: boolean, createdAt = at): Ticket => ({
  id,
  eventId: 'e1',
  ticketType: 'GUEST',
  guestFirstName: first,
  guestLastName: 'Kaya',
  guestEmail: `${id}@example.com`,
  sent,
  checkIns: [],
  createdAt,
  updatedAt: at,
});

// "İndir" gets what the list shows: every row of the view (not just the page), in its order,
// and whether a search or a view narrows it.
it('hands the export the rows the list shows', async () => {
  window.sessionStorage.clear();
  const renderExport = jest.fn(() => <span>İndir menüsü</span>);
  render(
    <ParticipantRoster
      eventId="e1"
      tickets={[
        ticket('t1', 'Ali', false, '2026-11-20T10:00:00Z'),
        ticket('t2', 'Berk', true, '2026-11-21T10:00:00Z'),
        ticket('t3', 'Cem', false, '2026-11-22T10:00:00Z'),
      ]}
      people={new Map()}
      sessions={[]}
      openTicket={null}
      onOpenTicket={jest.fn()}
      onMail={jest.fn()}
      dialogs={null}
      renderExport={renderExport}
    />,
  );
  expect(screen.getByText('İndir menüsü')).toBeInTheDocument();
  expect(renderExport).toHaveBeenLastCalledWith({ ticketIds: ['t3', 't2', 't1'], filtered: false });
  await userEvent.click(
    within(screen.getByRole('group', { name: 'Görünüm' })).getByText('Posta gitmedi'),
  );
  expect(renderExport).toHaveBeenLastCalledWith({ ticketIds: ['t3', 't1'], filtered: true });
});
