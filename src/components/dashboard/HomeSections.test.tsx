import { render, screen, within } from '@testing-library/react';
import { WeekCard } from '@/components/dashboard/HomeSections';
import type { WeekDay } from '@/lib/dashboard/home';

const days: WeekDay[] = [
  {
    date: '2026-11-23',
    label: 'Bugün',
    rows: [
      {
        key: 'e-live',
        href: '/events/e-live',
        time: '09:00',
        title: 'Yıldız Hackathon 2026',
        subtitle: 'GECEKODU',
        live: true,
        ended: false,
        eventId: 'e-live',
      },
      {
        key: 'e-next',
        href: '/events/e-next',
        time: '18:00',
        title: 'Robotik Takım Seçmeleri',
        subtitle: 'ROBOTLAB',
        live: false,
        ended: false,
        eventId: 'e-next',
      },
    ],
  },
];

describe('WeekCard', () => {
  it('says a running event once, where its time goes, and leaves only the door at the end', () => {
    render(<WeekCard days={days} loading={false} />);
    const live = screen
      .getAllByText('Yıldız Hackathon 2026')[0]!
      .closest('[data-slot="list-item"]');
    if (!(live instanceof HTMLElement)) throw new Error('no live row');
    expect(within(live).getAllByText('Sürüyor')).toHaveLength(1);
    expect(within(live).queryByText('09:00')).not.toBeInTheDocument();
    expect(within(live).getByRole('link', { name: 'Kapı' })).toHaveAttribute(
      'href',
      '/events/e-live/door',
    );
    const next = screen
      .getAllByText('Robotik Takım Seçmeleri')[0]!
      .closest('[data-slot="list-item"]');
    if (!(next instanceof HTMLElement)) throw new Error('no next row');
    expect(within(next).getByText('18:00')).toBeInTheDocument();
    expect(within(next).queryByRole('link', { name: 'Kapı' })).not.toBeInTheDocument();
  });
});
