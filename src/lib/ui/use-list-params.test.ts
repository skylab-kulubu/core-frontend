import { act, renderHook } from '@testing-library/react';
import { listParamsHref, readListParams, useListParams } from '@/lib/ui/use-list-params';

const replace = jest.fn();
let search = '';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/announcements',
  useSearchParams: () => new URLSearchParams(search),
}));

const DEFAULTS = { view: 'all', sort: '' };

describe('list params in the address', () => {
  beforeEach(() => {
    replace.mockClear();
    search = '';
  });

  it('reads the defaults from an empty address', () => {
    expect(readListParams(new URLSearchParams(''), DEFAULTS)).toEqual({
      q: '',
      view: 'all',
      sort: '',
      page: 1,
      panel: null,
    });
  });

  it('reads a shared view back, and ignores a page that is not a page', () => {
    const params = new URLSearchParams('q=bahar&view=featured&page=3&panel=n1');
    expect(readListParams(params, DEFAULTS)).toMatchObject({
      q: 'bahar',
      view: 'featured',
      page: 3,
      panel: 'n1',
    });
    expect(readListParams(new URLSearchParams('page=-2'), DEFAULTS).page).toBe(1);
    expect(readListParams(new URLSearchParams('page=x'), DEFAULTS).page).toBe(1);
  });

  it('writes only what differs from the defaults and keeps other params', () => {
    expect(
      listParamsHref(
        '/events',
        new URLSearchParams('tab=list&q=old'),
        { q: '', view: 'all', sort: '', page: 1, panel: null },
        DEFAULTS,
      ),
    ).toBe('/events?tab=list');
    expect(
      listParamsHref(
        '/events',
        new URLSearchParams(''),
        { q: 'ş ç', view: 'past', sort: 'name', page: 2, panel: 'e1' },
        DEFAULTS,
      ),
    ).toBe('/events?q=%C5%9F+%C3%A7&view=past&sort=name&page=2&panel=e1');
  });

  it('goes back to page 1 on a new search or view, without scrolling', () => {
    search = 'page=4&view=featured';
    const { result } = renderHook(() => useListParams());
    expect(result.current[0].page).toBe(4);
    act(() => result.current[1]({ q: 'bahar' }));
    expect(replace).toHaveBeenLastCalledWith('/announcements?q=bahar&view=featured', {
      scroll: false,
    });
    act(() => result.current[1]({ page: 5 }));
    expect(replace).toHaveBeenLastCalledWith('/announcements?view=featured&page=5', {
      scroll: false,
    });
    act(() => result.current[1]({ panel: 'n1' }));
    expect(replace).toHaveBeenLastCalledWith('/announcements?view=featured&page=4&panel=n1', {
      scroll: false,
    });
  });
});
