import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import UrlsPage from '@/app/(authorized)/urls/page';
import { ProblemError } from '@/lib/api/core';
import { urlsApi, type AliasAvailability, type ShortUrl, type ShortUrlStats } from '@/lib/api/urls';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { useAuth } from '@/context/AuthContext';
import type { UserDto } from '@/types/api';
import { sceneTitle } from '@/test/error-scenes';

// The address is the list's state: the hook writes history, and this reads it back
const mockListeners = new Set<() => void>();
function mockSubscribe(listener: () => void) {
  mockListeners.add(listener);
  return () => mockListeners.delete(listener);
}
for (const method of ['pushState', 'replaceState'] as const) {
  const original = window.history[method].bind(window.history);
  window.history[method] = (...args: Parameters<History['pushState']>) => {
    original(...args);
    mockListeners.forEach((listener) => listener());
  };
}
window.addEventListener('popstate', () => mockListeners.forEach((listener) => listener()));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/urls',
  useSearchParams: () => {
    const { useSyncExternalStore } = jest.requireActual('react') as typeof import('react');
    const text = useSyncExternalStore(
      mockSubscribe,
      () => window.location.search,
      () => '',
    );
    return new URLSearchParams(text);
  },
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn() },
}));

jest.mock('@/lib/api/urls', () => {
  const actual = jest.requireActual('@/lib/api/urls') as typeof import('@/lib/api/urls');
  return {
    ...actual,
    urlsApi: {
      listMine: jest.fn(),
      listAll: jest.fn(),
      listHits: jest.fn(),
      stats: jest.fn(),
      availability: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      restore: jest.fn(),
    },
  };
});

const short: ShortUrl = {
  id: 'u1',
  alias: 'hack',
  url: 'https://www.skylab.com/hackathon',
  clickCount: 3,
  createdBy: 'me',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
const others: ShortUrl = {
  ...short,
  id: 'o1',
  alias: 'baskasi',
  createdBy: 'someone-else',
  clickCount: 40,
  createdAt: '2026-02-01T00:00:00Z',
};
const formRow: ShortUrl = {
  ...short,
  id: 'f1',
  alias: 'basvuru',
  createdBy: 'someone-else',
  formId: '11111111-1111-1111-1111-111111111111',
  label: 'Başvuru formu',
};
const eventRow: ShortUrl = {
  ...short,
  id: 'e1',
  alias: 'gecekodu',
  createdBy: 'someone-else',
  formId: '22222222-2222-2222-2222-222222222222',
  eventId: '33333333-3333-3333-3333-333333333333',
};

const stats: ShortUrlStats = {
  since: '2026-10-25T21:00:00Z',
  days: 30,
  total: 5,
  scans: 2,
  daily: [
    { day: '2026-11-22', count: 2 },
    { day: '2026-11-23', count: 3 },
  ],
  sources: [
    { source: 'instagram', count: 3, scans: 0 },
    { source: 'qr', count: 2, scans: 2 },
  ],
  referrers: [
    { name: 'instagram.com', count: 3 },
    { name: '', count: 2 },
  ],
  devices: [
    { name: 'mobile', count: 4 },
    { name: 'desktop', count: 1 },
  ],
};

function user(partial: Partial<UserDto> & Pick<UserDto, 'roles' | 'groups'>): UserDto {
  return {
    id: 'me',
    username: 'op',
    email: 'op@example.com',
    firstName: 'O',
    lastName: 'P',
    ...partial,
  };
}

const creator = () => user({ roles: ['url:access'], groups: ['/UYELER/ARGE/WEBLAB'] });
const moderator = () => user({ roles: ['url:moderator'], groups: ['/UYELER/ARGE/WEBLAB'] });
const managed = () => new ProblemError(409, 'Conflict', { code: 'managed' });

function at(query: string) {
  window.history.replaceState(null, '', query ? `/urls?${query}` : '/urls');
}

function row(alias: string): HTMLElement {
  return screen
    .getByText(alias, { selector: 'span' })
    .closest('[data-slot="data-list-row"]') as HTMLElement;
}

async function openMenu(alias: string) {
  const pointer = userEvent.setup();
  await pointer.click(await screen.findByRole('button', { name: `${alias}: eylemler` }));
  // The menu's items land a frame after it opens
  await screen.findAllByRole('menuitem');
  return pointer;
}

/** The list's row of a link, by the name the row button carries. */
function listed(alias: string) {
  return screen.queryByRole('button', { name: `https://skyl.app/${alias}` });
}

beforeEach(() => {
  jest.clearAllMocks();
  at('');
  window.localStorage.clear();
  // No capabilities answer: the group rule stands in, as before core sent one
  (capabilitiesApi.get as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'));
  (urlsApi.listMine as jest.Mock).mockResolvedValue([short]);
  (urlsApi.listAll as jest.Mock).mockResolvedValue([short, others, formRow, eventRow]);
  (urlsApi.stats as jest.Mock).mockResolvedValue(stats);
});

describe('Kısa link list', () => {
  it('draws one list, the alias big and the target site under it', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    render(<UrlsPage />);
    expect(await screen.findByText('hack', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('skylab.com')).toBeInTheDocument();
    expect(screen.getAllByText('hack', { selector: 'span' })).toHaveLength(1);
    expect(urlsApi.listAll).not.toHaveBeenCalled();
    // Clicks stay with URL moderators, as before
    expect(screen.queryByText(/tıklama/i)).not.toBeInTheDocument();
  });

  it('keeps one written action on the row and the rest behind its menu', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    render(<UrlsPage />);
    const line = row(await screen.findByText('hack', { selector: 'span' }).then(() => 'hack'));
    expect(within(line).getByRole('button', { name: 'hack: kopyala' })).toBeInTheDocument();
    expect(within(line).queryByRole('button', { name: 'Sil' })).not.toBeInTheDocument();
    await openMenu('hack');
    expect(screen.getByRole('menuitem', { name: 'QR kodu' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Düzenle' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Sil' })).toBeInTheDocument();
  });

  it('copies in place with a tick, not a toast', async () => {
    const pointer = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    render(<UrlsPage />);
    await pointer.click(await screen.findByRole('button', { name: 'hack: kopyala' }));
    await expect(navigator.clipboard.readText()).resolves.toBe('https://skyl.app/hack');
    expect(screen.queryByText('Kısa link kopyalandı')).not.toBeInTheDocument();
  });

  it('gives a URL moderator one list of every link with their own, form and event views', async () => {
    const pointer = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({ user: moderator() });
    render(<UrlsPage />);
    expect(await screen.findByText('hack', { selector: 'span' })).toBeInTheDocument();
    expect(urlsApi.listAll).toHaveBeenCalledTimes(1);
    expect(urlsApi.listMine).not.toHaveBeenCalled();
    // "Benim" first: their own link only
    expect(listed('baskasi')).not.toBeInTheDocument();
    await pointer.click(screen.getByRole('button', { name: /^Tümü/ }));
    await waitFor(() => expect(listed('baskasi')).toBeInTheDocument());
    expect(window.location.search).toBe('?view=all');
    await pointer.click(screen.getByRole('button', { name: /^Form/ }));
    await waitFor(() => expect(listed('basvuru')).toBeInTheDocument());
    expect(listed('gecekodu')).not.toBeInTheDocument();
    expect(listed('hack')).not.toBeInTheDocument();
  });

  it('sums the clicks for a URL moderator and names the link clicked most', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: moderator() });
    render(<UrlsPage />);
    const summary = await screen.findByRole('group', { name: 'Özet' });
    expect(within(summary).getByText('4')).toBeInTheDocument();
    expect(within(summary).getByText('49')).toBeInTheDocument();
    expect(within(summary).getByText('baskasi')).toBeInTheDocument();
  });

  it('says a failed read, and a retry', async () => {
    const pointer = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    (urlsApi.listMine as jest.Mock).mockRejectedValueOnce(new Error('503'));
    render(<UrlsPage />);
    expect(await screen.findByText('Kısa linkler yüklenemedi')).toBeInTheDocument();
    await pointer.click(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(await screen.findByText('hack', { selector: 'span' })).toBeInTheDocument();
  });

  it('says no access the one way', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: user({ roles: [], groups: [] }) });
    render(<UrlsPage />);
    expect(screen.getByRole('heading', { name: sceneTitle('forbidden') })).toBeInTheDocument();
    expect(urlsApi.listMine).not.toHaveBeenCalled();
  });
});

describe('Kısa link side panel', () => {
  it('opens a row beside the list with its address, QR code and click summary, no raw click', async () => {
    const pointer = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({ user: moderator() });
    render(<UrlsPage />);
    await pointer.click(await screen.findByRole('button', { name: 'https://skyl.app/hack' }));
    const panel = await screen.findByRole('dialog', { name: 'hack' });
    expect(window.location.search).toBe('?panel=u1');
    expect(within(panel).getByText('https://skyl.app/hack')).toBeInTheDocument();
    expect(within(panel).getByText('https://www.skylab.com/hackathon')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'İndir' })).toBeInTheDocument();
    await waitFor(() => expect(urlsApi.stats).toHaveBeenCalledWith('u1', 30));
    expect(await within(panel).findByText('5 tıklama · 2 QR')).toBeInTheDocument();
    expect(within(panel).getByText('Instagram')).toBeInTheDocument();
    expect(within(panel).getByText('Doğrudan')).toBeInTheDocument();
    expect(urlsApi.listHits).not.toHaveBeenCalled();
  });

  it('says in the panel when the summary cannot be read', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: moderator() });
    (urlsApi.stats as jest.Mock).mockRejectedValue(new ProblemError(404, 'Not Found'));
    at('panel=u1');
    render(<UrlsPage />);
    const panel = await screen.findByRole('dialog', { name: 'hack' });
    expect(await within(panel).findByRole('alert')).toBeInTheDocument();
  });

  it('shows the click summary of their own link to the person who made it', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    at('panel=u1');
    render(<UrlsPage />);
    const panel = await screen.findByRole('dialog', { name: 'hack' });
    await waitFor(() => expect(urlsApi.stats).toHaveBeenCalledWith('u1', 30));
    expect(await within(panel).findByText('5 tıklama · 2 QR')).toBeInTheDocument();
    // The totals over every link stay with URL moderators
    expect(screen.queryByRole('group', { name: 'Özet' })).not.toBeInTheDocument();
  });

  it('reads no summary of a link someone else made, for a reader who is no moderator', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    (urlsApi.listMine as jest.Mock).mockResolvedValue([{ ...short, createdBy: 'someone-else' }]);
    at('panel=u1');
    render(<UrlsPage />);
    await screen.findByRole('dialog', { name: 'hack' });
    expect(urlsApi.stats).not.toHaveBeenCalled();
  });

  it('adds a link in the panel and opens it', async () => {
    const pointer = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    const made = { ...short, id: 'u2', alias: 'yeni' };
    (urlsApi.create as jest.Mock).mockResolvedValue(made);
    render(<UrlsPage />);
    await screen.findByText('hack', { selector: 'span' });
    (urlsApi.listMine as jest.Mock).mockResolvedValue([short, made]);
    await pointer.click(screen.getByRole('button', { name: 'Kısa link ekle' }));
    const panel = await screen.findByRole('dialog', { name: 'Kısa link ekle' });
    await pointer.type(within(panel).getByLabelText('Hedef adres'), 'https://skylab.com/yeni');
    await pointer.click(within(panel).getByRole('button', { name: 'Kısalt' }));
    expect(await screen.findByText('Kısa link oluşturuldu')).toBeInTheDocument();
    expect(urlsApi.create).toHaveBeenCalledWith({
      url: 'https://skylab.com/yeni',
      alias: undefined,
    });
    expect(await screen.findByRole('dialog', { name: 'yeni' })).toBeInTheDocument();
  });

  it('shows an edit refusal inside the open panel', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    (urlsApi.update as jest.Mock).mockRejectedValue(new ProblemError(409, 'Conflict'));
    const pointer = await (async () => {
      render(<UrlsPage />);
      return openMenu('hack');
    })();
    await pointer.click(screen.getByRole('menuitem', { name: 'Düzenle' }));
    const panel = await screen.findByRole('dialog', { name: 'Kısa linki düzenle' });
    await pointer.click(within(panel).getByRole('button', { name: 'Kaydet' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      'Bu kısa ad alınmış; başka bir ad seç.',
    );
  });

  it('explains a managed refusal of an edit from a stale list and reloads it', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    (urlsApi.update as jest.Mock).mockRejectedValue(managed());
    render(<UrlsPage />);
    const pointer = await openMenu('hack');
    await pointer.click(screen.getByRole('menuitem', { name: 'Düzenle' }));
    const panel = await screen.findByRole('dialog', { name: 'Kısa linki düzenle' });
    await pointer.click(within(panel).getByRole('button', { name: 'Kaydet' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      'Formda ya da etkinlikte yönetiliyor; buradan değiştirilemez.',
    );
    await waitFor(() => expect(urlsApi.listMine).toHaveBeenCalledTimes(2));
  });

  it('does not save an edit whose alias the check blocks', async () => {
    jest.useFakeTimers();
    try {
      const pointer = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      (useAuth as jest.Mock).mockReturnValue({ user: creator() });
      (urlsApi.availability as jest.Mock).mockResolvedValue({
        alias: '-x',
        available: false,
        reason: 'invalid',
      } satisfies AliasAvailability);
      at('panel=u1');
      render(<UrlsPage />);
      const panel = await screen.findByRole('dialog', { name: 'hack' });
      await pointer.click(within(panel).getByRole('button', { name: 'Düzenle' }));
      const form = await screen.findByRole('dialog', { name: 'Kısa linki düzenle' });
      const alias = within(form).getByLabelText('Kısa ad');
      await pointer.clear(alias);
      await pointer.type(alias, '-x');
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      expect(await within(form).findByText(/^Geçersiz ad/)).toBeInTheDocument();
      expect(within(form).getByRole('button', { name: 'Kaydet' })).toBeDisabled();
      expect(urlsApi.update).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Kısa link delete', () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
  });

  async function askDelete() {
    render(<UrlsPage />);
    const pointer = await openMenu('hack');
    await pointer.click(screen.getByRole('menuitem', { name: 'Sil' }));
    return { pointer, dialog: await screen.findByRole('alertdialog') };
  }

  it('asks first, deletes, and brings the link back with Geri al', async () => {
    (urlsApi.remove as jest.Mock).mockResolvedValue(undefined);
    (urlsApi.restore as jest.Mock).mockResolvedValue(short);
    const { pointer, dialog } = await askDelete();
    expect(dialog).toHaveAccessibleName('https://skyl.app/hack silinsin mi?');
    expect(urlsApi.remove).not.toHaveBeenCalled();
    await pointer.click(within(dialog).getByRole('button', { name: 'Linki sil' }));
    await waitFor(() => expect(urlsApi.remove).toHaveBeenCalledWith('u1'));
    expect(await screen.findByText('Kısa link silindi')).toBeInTheDocument();
    await pointer.click(await screen.findByRole('button', { name: 'Geri al' }));
    await waitFor(() => expect(urlsApi.restore).toHaveBeenCalledWith('u1'));
    expect(await screen.findByText('Kısa link geri alındı')).toBeInTheDocument();
  });

  it('keeps the question open and says a refusal inside it, in Turkish', async () => {
    (urlsApi.remove as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { detail: 'short url is referenced by event e-hack' }),
    );
    const { pointer, dialog } = await askDelete();
    await pointer.click(within(dialog).getByRole('button', { name: 'Linki sil' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Kısa link şu an silinemiyor.',
    );
    expect(document.body).not.toHaveTextContent(/referenced by event/);
  });
});

describe('Kısa link rights', () => {
  it("closes someone else's link to a DK member (url.moderateWrite false), not their own", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: user({ roles: [], groups: ['/UYELER/DK'] }),
    });
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'url.moderate': true, 'url.moderateWrite': false },
    });
    at('view=all');
    render(<UrlsPage />);
    await waitFor(() => expect(listed('baskasi')).toBeInTheDocument());
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    let pointer = await openMenu('baskasi');
    expect(screen.queryByRole('menuitem', { name: 'Düzenle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Sil' })).not.toBeInTheDocument();
    await pointer.keyboard('{Escape}');
    pointer = await openMenu('hack');
    expect(screen.getByRole('menuitem', { name: 'Düzenle' })).toBeInTheDocument();
  });

  it('lets a URL moderator delete a form link after warning the form keeps no link', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: moderator() });
    (urlsApi.remove as jest.Mock).mockResolvedValue(undefined);
    at('view=form');
    render(<UrlsPage />);
    const pointer = await openMenu('basvuru');
    expect(screen.getByRole('menuitem', { name: /Düzenle/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await pointer.click(screen.getByRole('menuitem', { name: 'Sil' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Bu link bir formun linki; silersen form linksiz kalır.');
  });

  it('keeps Sil closed on an event link for anyone without url.moderateWrite', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    (urlsApi.listMine as jest.Mock).mockResolvedValue([{ ...eventRow, createdBy: 'me' }]);
    render(<UrlsPage />);
    await openMenu('gecekodu');
    expect(screen.getByRole('menuitem', { name: /Sil/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: /Sil/ })).toHaveTextContent(
      'Etkinlikte yönetiliyor',
    );
  });
});
