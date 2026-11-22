import { render, screen } from '@testing-library/react';
import AppLoading from '@/app/(authorized)/loading';
import EventLoading from '@/app/(authorized)/events/[id]/loading';
import DoorLoading from '@/app/(authorized)/events/[id]/door/loading';
import TicketLoading from '@/app/(authorized)/events/[id]/tickets/[ticketId]/loading';

/** The event's outline has a tab strip (its header's badges and tabs); a record's has none. */
function hasTabStrip(container: HTMLElement): boolean {
  return container.querySelector('.border-b') !== null;
}

describe('loading pages', () => {
  it.each([
    ['pages', AppLoading],
    ['an event', EventLoading],
    ['the door', DoorLoading],
    ['a ticket', TicketLoading],
  ])('say "Yükleniyor" once for %s', (_, Loading) => {
    render(<Loading />);
    expect(screen.getByRole('status')).toHaveTextContent(/^Yükleniyor$/);
  });

  it("outlines the event's header and tabs only for the event itself", () => {
    expect(hasTabStrip(render(<EventLoading />).container)).toBe(true);
    expect(hasTabStrip(render(<DoorLoading />).container)).toBe(false);
    expect(hasTabStrip(render(<TicketLoading />).container)).toBe(false);
  });
});
