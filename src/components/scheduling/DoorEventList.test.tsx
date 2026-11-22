import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { DoorEventList } from '@/components/scheduling/DoorEventList';
import { ticketsApi } from '@/lib/api/tickets';

const replace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

jest.mock('@/lib/api/tickets', () => ({
  ticketsApi: { listDoorEvents: jest.fn() },
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
});
