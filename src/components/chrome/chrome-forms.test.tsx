import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Inbox } from 'lucide-react';
import { FilterPills } from '@/components/chrome/ListToolbar';
import { ListPanel } from '@/components/chrome/ListPanel';
import { MixChart } from '@/components/chrome/PanelChart';
import { StateCard } from '@/components/chrome/StateCard';
import { StatusChip } from '@/components/chrome/StatusChip';

describe('Forms chrome primitives', () => {
  it('renders a status chip with the domain label', () => {
    render(<StatusChip kind="guest" />);
    expect(screen.getByText('Misafir')).toBeInTheDocument();
  });

  it('names an empty list with a title instead of a one-line dump', () => {
    render(
      <ListPanel
        status={{ kind: 'empty', message: 'Etkinlik yok' }}
        emptyIcon={Inbox}
        emptyDescription="Yeni etkinlik ekle."
      />,
    );
    expect(screen.getByText('Etkinlik yok')).toBeInTheDocument();
    expect(screen.getByText('Yeni etkinlik ekle.')).toBeInTheDocument();
  });

  it('lets a filter pill change the selected slice', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = React.useState<'all' | 'upcoming'>('all');
      return (
        <FilterPills
          ariaLabel="Etkinlik dilimi"
          value={value}
          onChange={setValue}
          options={[
            { value: 'all', label: 'Tümü' },
            { value: 'upcoming', label: 'Yaklaşan' },
          ]}
        />
      );
    }
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Yaklaşan' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await user.click(screen.getByRole('button', { name: 'Yaklaşan' }));
    expect(screen.getByRole('button', { name: 'Yaklaşan' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows mix percents for guest vs member', () => {
    render(
      <MixChart
        title="Başvuru türü"
        empty="Başvuru yok"
        data={[
          { label: 'Misafir', count: 2 },
          { label: 'Üye', count: 1 },
        ]}
      />,
    );
    expect(screen.getByText('Başvuru türü')).toBeInTheDocument();
    expect(screen.getByText('2 · 67%')).toBeInTheDocument();
    expect(screen.getByText('1 · 33%')).toBeInTheDocument();
  });

  it('shows a denied-state card', () => {
    render(
      <StateCard
        title="Bu özet paneli yetkili üyelere açık."
        description="YK veya ekip lideri rolü gerekir."
        tone="warning"
      />,
    );
    expect(screen.getByText('Bu özet paneli yetkili üyelere açık.')).toBeInTheDocument();
  });
});
