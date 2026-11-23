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
  ticketsApi: { listDoorEvents: jest.fn(), doorActivity: jest.fn() },
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
});
