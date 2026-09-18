import { emptyListCopy, matchesQuery, paginateRows } from './list-query';

describe('matchesQuery', () => {
  it('matches any haystack case-insensitively and ignores blank queries', () => {
    expect(matchesQuery('', 'Ada')).toBe(true);
    expect(matchesQuery('  ada  ', 'Ada Lovelace', 'ytü')).toBe(true);
    expect(matchesQuery('grace', 'Ada Lovelace')).toBe(false);
    expect(matchesQuery('42', undefined, 42)).toBe(true);
  });
});

describe('emptyListCopy', () => {
  it('uses the none-match line when search or filters are on', () => {
    expect(emptyListCopy({ none: 'Etkinlik yok', noneMatch: 'Eşleşen etkinlik yok' })).toBe(
      'Etkinlik yok',
    );
    expect(
      emptyListCopy({
        none: 'Etkinlik yok',
        noneMatch: 'Eşleşen etkinlik yok',
        query: 'jam',
      }),
    ).toBe('Eşleşen etkinlik yok');
    expect(
      emptyListCopy({
        none: 'Oturum yok',
        noneMatch: 'Eşleşen oturum yok',
        filtered: true,
      }),
    ).toBe('Eşleşen oturum yok');
  });
});

describe('paginateRows', () => {
  it('clamps the page and slices ten at a time', () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];
    expect(paginateRows(rows, 1)).toEqual({
      page: 1,
      totalPages: 2,
      total: 11,
      slice: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
    });
    expect(paginateRows(rows, 99).page).toBe(2);
    expect(paginateRows([], 1)).toEqual({ page: 1, totalPages: 1, total: 0, slice: [] });
  });
});
