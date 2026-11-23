import type { ShortUrl } from '@/lib/api/urls';
import {
  asLinkSort,
  asLinkView,
  dayLabel,
  linksInView,
  mostClicked,
  sortLinks,
  statsCharts,
  targetHost,
} from './short-link-list';

const base: ShortUrl = {
  id: 'a',
  alias: 'b-link',
  url: 'https://example.com',
  clickCount: 1,
  createdBy: 'me',
  createdAt: '2026-01-02T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};
const rows: ShortUrl[] = [
  base,
  { ...base, id: 'f', alias: 'a-form', formId: 'f1', createdBy: 'x', clickCount: 9 },
  {
    ...base,
    id: 'e',
    alias: 'c-event',
    formId: 'f2',
    eventId: 'e1',
    createdBy: 'x',
    clickCount: 0,
    createdAt: '2026-03-01T00:00:00Z',
  },
];

describe('short link list', () => {
  it('reads the view and sort from the address, closing what the reader may not use', () => {
    expect(asLinkView('all', false)).toBe('mine');
    expect(asLinkView('all', true)).toBe('all');
    expect(asLinkView('form', false)).toBe('form');
    expect(asLinkView('nonsense', true)).toBe('mine');
    expect(asLinkSort('clicks', false)).toBe('new');
    expect(asLinkSort('clicks', true)).toBe('clicks');
    expect(asLinkSort('alias', false)).toBe('alias');
  });

  it('narrows to the reader’s own links or one kind', () => {
    expect(linksInView(rows, 'mine', 'me').map((row) => row.id)).toEqual(['a']);
    expect(linksInView(rows, 'mine', undefined)).toEqual([]);
    expect(linksInView(rows, 'form', 'me').map((row) => row.id)).toEqual(['f']);
    expect(linksInView(rows, 'event', 'me').map((row) => row.id)).toEqual(['e']);
    expect(linksInView(rows, 'all', 'me')).toHaveLength(3);
  });

  it('sorts newest first, by clicks or by name', () => {
    expect(sortLinks(rows, 'new').map((row) => row.id)).toEqual(['e', 'a', 'f']);
    expect(sortLinks(rows, 'clicks').map((row) => row.id)).toEqual(['f', 'a', 'e']);
    expect(sortLinks(rows, 'alias').map((row) => row.id)).toEqual(['f', 'a', 'e']);
  });

  it('names the target by its site and the link clicked most', () => {
    expect(targetHost('https://www.skylab.com/a?b=c')).toBe('skylab.com');
    expect(targetHost('not a url')).toBe('not a url');
    expect(mostClicked(rows)?.id).toBe('f');
    expect(mostClicked([{ ...base, clickCount: 0 }])).toBeNull();
  });

  it('turns core’s summary into chart rows in Turkish', () => {
    expect(dayLabel('2026-11-23')).toBe('23 Kas');
    const charts = statsCharts({
      since: '',
      days: 30,
      total: 3,
      scans: 1,
      daily: [{ day: '2026-11-23', count: 3 }],
      sources: [
        { source: '', count: 1, scans: 0 },
        { source: 'qr', count: 1, scans: 1 },
        { source: 'other', count: 1, scans: 0 },
      ],
      referrers: [
        { name: '', count: 2 },
        { name: 'other', count: 1 },
      ],
      devices: [
        { name: 'bot', count: 1 },
        { name: 'mobile', count: 2 },
      ],
    });
    expect(charts.daily).toEqual([{ label: '23 Kas', count: 3 }]);
    expect(charts.sources.map((row) => row.label)).toEqual(['Etiketsiz', 'QR', 'Diğer']);
    expect(charts.referrers.map((row) => row.label)).toEqual(['Doğrudan', 'Diğer']);
    expect(charts.devices.map((row) => row.label)).toEqual(['Önizleme', 'Telefon']);
  });
});
