import { act, renderHook } from '@testing-library/react';
import { listParamsHref, readListParams, useListParams } from '@/lib/ui/use-list-params';

const replace = jest.fn(); // the router must not be used
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

  it('writes the address with the history API: no server request, no scroll', () => {
    window.history.replaceState(null, '', '/announcements?page=4&view=featured');
    search = 'page=4&view=featured';
    const replaceState = jest.spyOn(window.history, 'replaceState');
    const { result } = renderHook(() => useListParams());
    expect(result.current[0].page).toBe(4);
    act(() => result.current[1]({ q: 'bahar' }));
    expect(replaceState).toHaveBeenLastCalledWith(null, '', '/announcements?q=bahar&view=featured');
    act(() => result.current[1]({ page: 5 }));
    expect(window.location.search).toBe('?q=bahar&view=featured&page=5');
    expect(replace).not.toHaveBeenCalled();
    replaceState.mockRestore();
  });

  it('keeps both of two quick changes made before the page draws again', () => {
    window.history.replaceState(null, '', '/announcements');
    const { result } = renderHook(() => useListParams());
    act(() => {
      result.current[1]({ q: 'bahar' });
      // The same setter, before the address change reached the hook
      result.current[1]({ view: 'featured' });
    });
    expect(window.location.search).toBe('?q=bahar&view=featured');
  });

  it('opens a panel as a history entry, so Geri closes it, and closes it by going back', () => {
    window.history.replaceState(null, '', '/announcements?view=featured');
    const { result } = renderHook(() => useListParams());
    const before = window.history.length;
    act(() => result.current[1]({ panel: 'n1' }));
    expect(window.history.length).toBe(before + 1);
    expect(window.location.search).toBe('?view=featured&panel=n1');
    // Stepping to the next row stays on the same entry
    act(() => result.current[1]({ panel: 'n2' }));
    expect(window.history.length).toBe(before + 1);
    const back = jest.spyOn(window.history, 'back').mockImplementation(() => undefined);
    act(() => result.current[1]({ panel: null }));
    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });

  it('keeps a search of spaces as typed', () => {
    expect(
      listParamsHref(
        '/x',
        new URLSearchParams(''),
        { q: '  ', view: 'all', sort: '', page: 1, panel: null },
        DEFAULTS,
      ),
    ).toBe('/x?q=++');
  });
});
