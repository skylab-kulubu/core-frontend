import { render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { DoorEventList } from '@/components/scheduling/DoorEventList';
import { eventDaysApi } from '@/lib/api/eventDays';
import { ticketsApi } from '@/lib/api/tickets';

const replace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

jest.mock('@/lib/api/tickets', () => ({
  ticketsApi: { listDoorEvents: jest.fn(), doorActivity: jest.fn(), venueEntries: jest.fn() },
}));
jest.mock('@/lib/api/eventDays', () => ({
  eventDaysApi: { listByEvent: jest.fn(), listSessions: jest.fn() },
}));

const door = (id: string, name: string) => ({
  id,
  name,
  location: 'B-112',
  ownerTeam: 'WEBLAB',
  active: true,
  startDate: '2026-12-03T18:00:00+03:00',
});

describe('DoorEventList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('goes straight to the one door the person staffs', async () => {
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([door('e1', 'SkyDays')]);
    render(<DoorEventList />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/events/e1/door'));
  });

  it('lists several doors, each opening its event’s door', async () => {
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([
      door('e1', 'SkyDays'),
      door('e2', 'SkySec'),
    ]);
    render(<DoorEventList />);
    expect(await screen.findByRole('link', { name: /SkySec/ })).toHaveAttribute(
      'href',
      '/events/e2/door',
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('says so when the person staffs no door', async () => {
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([]);
    render(<DoorEventList />);
    expect(await screen.findByText('Kapı görevin olan etkinlik yok')).toBeInTheDocument();
  });

  it('puts the door running now first, with its session, its count and a large way in', async () => {
    const hour = 3600_000;
    const iso = (offset: number) => new Date(Date.now() + offset).toISOString();
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([
      door('e2', 'SkySec'),
      { ...door('e1', 'SkyDays'), startDate: iso(-2 * hour), endDate: iso(5 * hour) },
    ]);
    (eventDaysApi.listByEvent as jest.Mock).mockResolvedValue([{ id: 'd1', eventId: 'e1' }]);
    (eventDaysApi.listSessions as jest.Mock).mockResolvedValue([
      { id: 's1', eventDayId: 'd1', title: 'Açılış', startTime: iso(-hour), endTime: iso(hour) },
    ]);
    (ticketsApi.doorActivity as jest.Mock).mockResolvedValue({ total: 17, items: [] });
    render(<DoorEventList />);
    const now = await screen.findByRole('region', { name: 'Şimdi' });
    expect(await within(now).findByText('17')).toBeInTheDocument();
    expect(within(now).getByText(/^Açılış · /)).toBeInTheDocument();
    expect(within(now).getByRole('link', { name: 'SkyDays: kapıyı aç' })).toHaveAttribute(
      'href',
      '/events/e1/door',
    );
    const later = screen.getByRole('region', { name: 'Sıradaki' });
    expect(within(later).getByRole('link', { name: /SkySec/ })).toBeInTheDocument();
    expect(eventDaysApi.listByEvent).toHaveBeenCalledTimes(1);
  });

  it('counts the day’s venue entries on an event run with one entry a day, not the session’s attendance', async () => {
    const hour = 3600_000;
    const iso = (offset: number) => new Date(Date.now() + offset).toISOString();
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([
      door('e2', 'SkySec'),
      {
        ...door('e1', 'ARTLAB'),
        startDate: iso(-2 * hour),
        endDate: iso(5 * hour),
        effectiveEntryMode: 'venue',
      },
    ]);
    (eventDaysApi.listByEvent as jest.Mock).mockResolvedValue([{ id: 'd1', eventId: 'e1' }]);
    (eventDaysApi.listSessions as jest.Mock).mockResolvedValue([
      { id: 's1', eventDayId: 'd1', title: 'Açılış', startTime: iso(-hour), endTime: iso(hour) },
    ]);
    (ticketsApi.venueEntries as jest.Mock).mockResolvedValue(
      Array.from({ length: 312 }, (_, i) => ({ id: `v${i}`, kind: 'entry' })),
    );
    (ticketsApi.doorActivity as jest.Mock).mockResolvedValue({ total: 0, items: [] });
    render(<DoorEventList />);
    const now = await screen.findByRole('region', { name: 'Şimdi' });
    expect(await within(now).findByText('312')).toBeInTheDocument();
    expect(within(now).getByText('bugün alana giren')).toBeInTheDocument();
    expect(within(now).getByText(/^Açılış · /)).toBeInTheDocument();
    expect(ticketsApi.venueEntries).toHaveBeenCalledWith('e1');
    expect(ticketsApi.doorActivity).not.toHaveBeenCalled();
  });

  it('counts the venue entries between sessions too', async () => {
    const hour = 3600_000;
    const iso = (offset: number) => new Date(Date.now() + offset).toISOString();
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([
      door('e2', 'SkySec'),
      {
        ...door('e1', 'ARTLAB'),
        startDate: iso(-2 * hour),
        endDate: iso(5 * hour),
        effectiveEntryMode: 'venue',
      },
    ]);
    (eventDaysApi.listByEvent as jest.Mock).mockResolvedValue([{ id: 'd1', eventId: 'e1' }]);
    (eventDaysApi.listSessions as jest.Mock).mockResolvedValue([
      {
        id: 's2',
        eventDayId: 'd1',
        title: '1. Oturum',
        startTime: iso(hour),
        endTime: iso(2 * hour),
      },
    ]);
    (ticketsApi.venueEntries as jest.Mock).mockResolvedValue([{ id: 'v1', kind: 'entry' }]);
    render(<DoorEventList />);
    const now = await screen.findByRole('region', { name: 'Şimdi' });
    expect(await within(now).findByText('bugün alana giren')).toBeInTheDocument();
    expect(within(now).getByText('1')).toBeInTheDocument();
    expect(within(now).getByText(/^Sıradaki: 1\. Oturum · /)).toBeInTheDocument();
  });

  it('keeps an event that is over out of Sıradaki, under Geçmiş', async () => {
    const day = 24 * 3600_000;
    const iso = (offset: number) => new Date(Date.now() + offset).toISOString();
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([
      { ...door('e1', 'SkyDays'), startDate: iso(-10 * day), endDate: iso(-9 * day) },
      { ...door('e2', 'SkySec'), startDate: iso(5 * day) },
    ]);
    render(<DoorEventList />);
    const later = await screen.findByRole('region', { name: 'Sıradaki' });
    expect(within(later).getByRole('link', { name: /SkySec/ })).toBeInTheDocument();
    expect(within(later).queryByRole('link', { name: /SkyDays/ })).not.toBeInTheDocument();
    const past = screen.getByRole('region', { name: 'Geçmiş' });
    expect(within(past).getByRole('link', { name: /SkyDays/ })).toHaveAttribute(
      'href',
      '/events/e1/door',
    );
  });
});
