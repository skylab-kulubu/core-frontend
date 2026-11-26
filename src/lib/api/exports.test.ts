import { dispositionName, exportFileName, exportSlug, exportsApi } from './exports';

const mockFetch = jest.fn();
jest.mock('./core', () => ({
  coreFetchResponse: (...args: unknown[]) => mockFetch(...args),
}));

describe('export file names', () => {
  it('folds the event name as core does', () => {
    expect(exportSlug('ARTLAB · Yıldız Çağı & İş Günü')).toBe('artlab-yildiz-cagi-is-gunu');
    expect(exportSlug('!!!')).toBe('etkinlik');
  });

  it('names the file by event, report and Istanbul time', () => {
    const now = new Date('2026-11-26T21:05:00Z');
    expect(exportFileName('ARTLAB Günü 2026', 'matrix', 'xlsx', now)).toBe(
      'artlab-gunu-2026-katilim-matrisi-20261127-0005.xlsx',
    );
  });

  it('reads the name core gives', () => {
    expect(dispositionName('attachment; filename=a-b.csv')).toBe('a-b.csv');
    expect(dispositionName('attachment; filename="a b.xlsx"')).toBe('a b.xlsx');
    expect(dispositionName("attachment; filename*=UTF-8''%C3%A7.csv")).toBe('ç.csv');
    expect(dispositionName(null)).toBeNull();
  });
});

describe('exportsApi.download', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    URL.createObjectURL = jest.fn(() => 'blob:x');
    URL.revokeObjectURL = jest.fn();
  });

  it('posts the request and saves the file under the name core gives, else its own', async () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({ 'Content-Disposition': 'attachment; filename=core.xlsx' }),
      blob: async () => new Blob(['x']),
    });
    await expect(
      exportsApi.download('e 1', 'ARTLAB', {
        report: 'attendees',
        format: 'xlsx',
        ticketIds: ['t2', 't1'],
      }),
    ).resolves.toBe('core.xlsx');
    expect(mockFetch).toHaveBeenCalledWith('/v1/events/e%201/exports', {
      method: 'POST',
      body: JSON.stringify({ report: 'attendees', format: 'xlsx', ticketIds: ['t2', 't1'] }),
    });
    mockFetch.mockResolvedValueOnce({ headers: new Headers(), blob: async () => new Blob(['x']) });
    const name = await exportsApi.download('e1', 'ARTLAB', { report: 'entries', format: 'csv' });
    expect(name).toMatch(/^artlab-alana-giris-\d{8}-\d{4}\.csv$/);
    expect(click).toHaveBeenCalledTimes(2);
    click.mockRestore();
  });
});
