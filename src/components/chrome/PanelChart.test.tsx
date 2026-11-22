import { render, screen } from '@testing-library/react';

jest.mock('@skylab-kulubu/skylcn-ui/charts', () => {
  throw new Error('chunk load failed');
});

import { BarChart, ChartBoundary, MixChart } from '@/components/chrome/PanelChart';

describe('PanelChart when the chart code cannot be fetched', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('shows one line in the chart’s place and keeps the page', async () => {
    render(
      <div>
        <h1>Katılımcılar</h1>
        <MixChart title="Başvuru türü" empty="Başvuru yok" data={[{ label: 'Üye', count: 1 }]} />
        <BarChart title="Aylara göre" empty="Etkinlik yok" data={[{ label: 'Eyl', count: 2 }]} />
      </div>,
    );

    expect(await screen.findAllByText('Grafik yüklenemedi.')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Katılımcılar' })).toBeInTheDocument();
  });

  it('keeps the page when the chart throws while it draws', () => {
    function Broken(): never {
      throw new Error('chunk load failed');
    }
    render(
      <div>
        <h1>Katılımcılar</h1>
        <ChartBoundary title="Başvuru türü">
          <Broken />
        </ChartBoundary>
      </div>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Grafik yüklenemedi.');
    expect(screen.getByText('Başvuru türü')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Katılımcılar' })).toBeInTheDocument();
  });
});
