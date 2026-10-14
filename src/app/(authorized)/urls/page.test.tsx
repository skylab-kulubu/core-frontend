import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import UrlsPage from '@/app/(authorized)/urls/page';
import { ProblemError } from '@/lib/api/core';
import { urlsApi, type AliasAvailability, type ShortUrl } from '@/lib/api/urls';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { useAuth } from '@/context/AuthContext';
import type { UserDto } from '@/types/api';

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
      availability: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      restore: jest.fn(),
    },
  };
});

beforeEach(() => {
  // No capabilities answer: the group rule stands in, as before core sent one
  (capabilitiesApi.get as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'));
});

const short = {
  id: 'u1',
  alias: 'hack',
  url: 'https://skylab.com',
  clickCount: 3,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function user(partial: Partial<UserDto> & Pick<UserDto, 'roles' | 'groups'>): UserDto {
  return {
    id: 'u1',
    username: 'op',
    email: 'op@example.com',
    firstName: 'O',
    lastName: 'P',
    ...partial,
  };
}

describe('Kısa URL hit list', () => {
  beforeEach(() => {
    (urlsApi.listMine as jest.Mock).mockResolvedValue([short]);
    (urlsApi.listAll as jest.Mock).mockResolvedValue([short]);
    (urlsApi.listHits as jest.Mock).mockResolvedValue([]);
  });

  it('hides Tıklamalar for url:create alone', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: user({
        roles: ['url:create'],
        groups: ['/UYELER/ARGE/WEBLAB'],
      }),
    });
    render(<UrlsPage />);
    await waitFor(() => expect(screen.getByText(/skyl\.app\/hack/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Tıklamalar' })).not.toBeInTheDocument();
    expect(screen.queryByText('En çok tıklanan')).not.toBeInTheDocument();
    expect(screen.queryByText(/tıklama/)).not.toBeInTheDocument();
    expect(urlsApi.listHits).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'url:moderator',
      roles: ['url:moderator'],
      groups: ['/UYELER/ARGE/WEBLAB'],
    },
    {
      name: 'Privileged',
      roles: [],
      groups: ['/UYELER/YK'],
    },
  ])('shows Tıklamalar for $name', async ({ roles, groups }) => {
    (useAuth as jest.Mock).mockReturnValue({
      user: user({ roles, groups }),
    });
    render(<UrlsPage />);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Tıklamalar' }).length).toBeGreaterThan(0),
    );
  });

  it('renders a hit with createdAt, and a null hits body as empty', async () => {
    const clicker = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({
      user: user({ roles: [], groups: ['/UYELER/YK'] }),
    });
    (urlsApi.listHits as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce([
      {
        id: 'h1',
        urlId: 'u1',
        alias: 'hack',
        createdAt: (() => {
          const when = new Date();
          when.setHours(8, 5, 0, 0);
          return when.toISOString();
        })(),
        ip: '203.0.113.9',
        userAgent: 'Safari/18',
        referer: '',
      },
    ]);
    render(<UrlsPage />);
    const buttons = await screen.findAllByRole('button', { name: 'Tıklamalar' });
    await clicker.click(buttons[0]);
    expect(await screen.findByText('Henüz tıklama yok.')).toBeInTheDocument();
    await clicker.click(buttons[0]);
    expect(await screen.findByText('Bugün, 08:05')).toBeInTheDocument();
    expect(screen.getByText(/203\.0\.113\.9/)).toBeInTheDocument();
  });
});

describe('Kısa URL feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (urlsApi.listMine as jest.Mock).mockResolvedValue([short]);
    (urlsApi.listAll as jest.Mock).mockResolvedValue([]);
    (useAuth as jest.Mock).mockReturnValue({
      user: user({ roles: ['url:create'], groups: ['/UYELER/ARGE/WEBLAB'] }),
    });
  });

  it('says the link was shortened', async () => {
    const clicker = userEvent.setup();
    (urlsApi.create as jest.Mock).mockResolvedValue({ ...short, id: 'u2', alias: 'yeni' });
    render(<UrlsPage />);
    await clicker.type(await screen.findByLabelText('Hedef adres'), 'https://skylab.com/yeni');
    await clicker.click(screen.getByRole('button', { name: 'Kısalt' }));
    expect(await screen.findByText('Kısa link oluşturuldu')).toBeInTheDocument();
  });

  it('copies in place with a tick, not a toast', async () => {
    const clicker = userEvent.setup();
    render(<UrlsPage />);
    await clicker.click(await screen.findByRole('button', { name: 'Kopyala' }));
    expect(await screen.findByRole('button', { name: 'Kopyalandı' })).toBeInTheDocument();
    await expect(navigator.clipboard.readText()).resolves.toBe('https://skyl.app/hack');
    expect(screen.queryByText('Kısa link kopyalandı')).not.toBeInTheDocument();
  });

  it('keeps the question open while deleting and says a refusal inside it, in Turkish', async () => {
    const clicker = userEvent.setup();
    let refuse: (err: unknown) => void = () => {};
    (urlsApi.remove as jest.Mock).mockReturnValue(
      new Promise((_, reject) => {
        refuse = reject;
      }),
    );
    render(<UrlsPage />);
    await clicker.click(await screen.findByRole('button', { name: 'Sil' }));
    const dialog = await screen.findByRole('alertdialog');
    await clicker.click(within(dialog).getByRole('button', { name: 'Linki sil' }));
    expect(within(dialog).getByRole('button', { name: 'Linki sil' })).toBeDisabled();

    refuse(
      new ProblemError(409, 'Conflict', {
        detail: 'short url is referenced by event e-hack and cannot be deleted',
      }),
    );
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Kısa link şu an silinemiyor.');
    expect(document.body).not.toHaveTextContent(/referenced by event|Conflict/);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.queryByText('Kısa link silindi')).not.toBeInTheDocument();
  });

  it('says the link was deleted', async () => {
    const clicker = userEvent.setup();
    (urlsApi.remove as jest.Mock).mockResolvedValue(undefined);
    render(<UrlsPage />);
    await clicker.click(await screen.findByRole('button', { name: 'Sil' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: 'https://skyl.app/hack silinsin mi?',
    });
    expect(urlsApi.remove).not.toHaveBeenCalled();
    await clicker.click(within(confirm).getByRole('button', { name: 'Linki sil' }));
    await waitFor(() => expect(urlsApi.remove).toHaveBeenCalledWith('u1'));
    expect(await screen.findByText('Kısa link silindi')).toBeInTheDocument();
  });

  it('brings a deleted link back with Geri al', async () => {
    const clicker = userEvent.setup();
    (urlsApi.remove as jest.Mock).mockResolvedValue(undefined);
    (urlsApi.restore as jest.Mock).mockResolvedValue(short);
    render(<UrlsPage />);
    await clicker.click(await screen.findByRole('button', { name: 'Sil' }));
    await clicker.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Linki sil' }),
    );
    await clicker.click(await screen.findByRole('button', { name: 'Geri al' }));
    await waitFor(() => expect(urlsApi.restore).toHaveBeenCalledWith('u1'));
    expect(await screen.findByText('Kısa link geri alındı')).toBeInTheDocument();
    // First load, after the delete, after Geri al
    await waitFor(() => expect(urlsApi.listMine).toHaveBeenCalledTimes(3));
  });

  it('shows an edit error inside the open drawer', async () => {
    const clicker = userEvent.setup();
    (urlsApi.update as jest.Mock).mockRejectedValue(new ProblemError(409, 'Conflict'));
    render(<UrlsPage />);
    await clicker.click(await screen.findByRole('button', { name: 'Düzenle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Kısa URL düzenle' });
    await clicker.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Bu kısa ad alınmış; başka bir ad seç.',
    );
  });
});

describe('Kısa URL moderation buttons', () => {
  const others = { ...short, id: 'o1', alias: 'baskasi', createdBy: 'someone-else' };
  const own = { ...short, id: 'm1', alias: 'benim', createdBy: 'me' };
  const get = capabilitiesApi.get as jest.Mock;

  beforeEach(() => {
    (urlsApi.listMine as jest.Mock).mockResolvedValue([]);
    (urlsApi.listAll as jest.Mock).mockResolvedValue([others, own]);
  });

  async function tumuRows() {
    await waitFor(() => expect(screen.getByText(/skyl\.app\/baskasi/)).toBeInTheDocument());
    const row = (alias: string) =>
      screen
        .getByText(new RegExp(`skyl\\.app/${alias}$`))
        .closest('[data-slot="list-item"]') as HTMLElement;
    return { others: row('baskasi'), own: row('benim') };
  }

  it("hides edit and delete on someone else's link for DK (url.moderateWrite false)", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: user({ id: 'me', roles: [], groups: ['/UYELER/DK'] }),
    });
    get.mockResolvedValue({ can: { 'url.moderate': true, 'url.moderateWrite': false } });
    render(<UrlsPage />);
    const rows = await tumuRows();
    await waitFor(() => expect(get).toHaveBeenCalled());
    // Let the answer land, so the check below is the read answer, not loading
    await act(async () => {
      await Promise.resolve();
    });
    // Reading everyone's links stays: clicks and the list itself
    expect(within(rows.others).getByRole('button', { name: 'Tıklamalar' })).toBeInTheDocument();
    expect(within(rows.others).queryByRole('button', { name: 'Düzenle' })).not.toBeInTheDocument();
    expect(within(rows.others).queryByRole('button', { name: 'Sil' })).not.toBeInTheDocument();
    // Their own link they still change
    expect(within(rows.own).getByRole('button', { name: 'Düzenle' })).toBeInTheDocument();
    expect(within(rows.own).getByRole('button', { name: 'Sil' })).toBeInTheDocument();
  });

  it("shows edit and delete on someone else's link for YK (url.moderateWrite true)", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: user({ id: 'me', roles: [], groups: ['/UYELER/YK'] }),
    });
    get.mockResolvedValue({ can: { 'url.moderate': true, 'url.moderateWrite': true } });
    render(<UrlsPage />);
    const rows = await tumuRows();
    await waitFor(() =>
      expect(within(rows.others).getByRole('button', { name: 'Düzenle' })).toBeInTheDocument(),
    );
    expect(within(rows.others).getByRole('button', { name: 'Sil' })).toBeInTheDocument();
  });

  it('falls back to url.moderate when an older core sends no url.moderateWrite', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: user({ id: 'me', roles: [], groups: ['/UYELER/DK'] }),
    });
    get.mockResolvedValue({ can: { 'url.moderate': true } });
    render(<UrlsPage />);
    const rows = await tumuRows();
    await waitFor(() =>
      expect(within(rows.others).getByRole('button', { name: 'Düzenle' })).toBeInTheDocument(),
    );
    expect(within(rows.others).getByRole('button', { name: 'Sil' })).toBeInTheDocument();
  });
});

const formRow: ShortUrl = {
  ...short,
  id: 'u2',
  alias: 'basvuru',
  formId: '11111111-1111-1111-1111-111111111111',
};

const eventRow: ShortUrl = {
  ...short,
  id: 'u3',
  alias: 'gecekodu',
  formId: '22222222-2222-2222-2222-222222222222',
  eventId: '33333333-3333-3333-3333-333333333333',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const creator = () => user({ roles: ['url:create'], groups: ['/UYELER/ARGE/WEBLAB'] });
const moderator = () => user({ roles: ['url:moderator'], groups: ['/UYELER/ARGE/WEBLAB'] });
const managed = () => new ProblemError(409, 'Conflict', { code: 'managed' });

describe('Kısa URL kind filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (urlsApi.listMine as jest.Mock).mockResolvedValue([short]);
    (urlsApi.listAll as jest.Mock).mockResolvedValue([short]);
  });

  it('lists every link with Tümü, and asks both lists for the chosen kind', async () => {
    const clicker = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({ user: moderator() });
    render(<UrlsPage />);
    await waitFor(() => expect(urlsApi.listAll).toHaveBeenCalled());
    expect(urlsApi.listMine).toHaveBeenLastCalledWith('all');
    expect(urlsApi.listAll).toHaveBeenLastCalledWith('all');
    const filter = screen.getByRole('group', { name: 'Link türü' });
    expect(within(filter).getByRole('button', { name: 'Tümü' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    (urlsApi.listMine as jest.Mock).mockResolvedValue([formRow]);
    (urlsApi.listAll as jest.Mock).mockResolvedValue([formRow]);
    await clicker.click(within(filter).getByRole('button', { name: 'Form' }));

    await waitFor(() => expect(urlsApi.listAll).toHaveBeenLastCalledWith('form'));
    expect(urlsApi.listMine).toHaveBeenLastCalledWith('form');
    expect((await screen.findAllByText(/skyl\.app\/basvuru/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/skyl\.app\/hack/)).not.toBeInTheDocument();
  });

  it('does not reload when the chosen kind is clicked again', async () => {
    const clicker = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    render(<UrlsPage />);
    await screen.findByText(/skyl\.app\/hack/);
    const filter = screen.getByRole('group', { name: 'Link türü' });
    await clicker.click(within(filter).getByRole('button', { name: 'Tümü' }));
    expect(screen.getByText(/skyl\.app\/hack/)).toBeInTheDocument();
    expect(urlsApi.listMine).toHaveBeenCalledTimes(1);
  });

  it('reloads after a create with the kind chosen while it was pending', async () => {
    const clicker = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    (urlsApi.listMine as jest.Mock).mockImplementation(async (kind: string) =>
      kind === 'form' ? [formRow] : [short],
    );
    const creation = deferred<ShortUrl>();
    (urlsApi.create as jest.Mock).mockReturnValue(creation.promise);
    render(<UrlsPage />);
    await clicker.type(await screen.findByLabelText('Hedef adres'), 'https://skylab.com/yeni');
    await clicker.click(screen.getByRole('button', { name: 'Kısalt' }));
    const filter = screen.getByRole('group', { name: 'Link türü' });
    await clicker.click(within(filter).getByRole('button', { name: 'Form' }));
    await screen.findByText(/skyl\.app\/basvuru/);

    await act(async () => creation.resolve({ ...short, id: 'u9', alias: 'yeni' }));

    await waitFor(() => expect(urlsApi.listMine).toHaveBeenCalledTimes(3));
    expect(urlsApi.listMine).toHaveBeenLastCalledWith('form');
    expect(screen.getByText(/skyl\.app\/basvuru/)).toBeInTheDocument();
    expect(screen.queryByText(/skyl\.app\/hack/)).not.toBeInTheDocument();
  });

  it('shows only the answer for the latest kind', async () => {
    const clicker = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    render(<UrlsPage />);
    await screen.findByText(/skyl\.app\/hack/);
    const forms = deferred<ShortUrl[]>();
    const events = deferred<ShortUrl[]>();
    (urlsApi.listMine as jest.Mock)
      .mockReturnValueOnce(forms.promise)
      .mockReturnValueOnce(events.promise);
    const filter = screen.getByRole('group', { name: 'Link türü' });
    await clicker.click(within(filter).getByRole('button', { name: 'Form' }));
    await clicker.click(within(filter).getByRole('button', { name: 'Etkinlik' }));

    await act(async () => events.resolve([eventRow]));
    await act(async () => forms.resolve([formRow]));

    expect(screen.getByText(/skyl\.app\/gecekodu/)).toBeInTheDocument();
    expect(screen.queryByText(/skyl\.app\/basvuru/)).not.toBeInTheDocument();
  });
});

describe('Kısa URL form and event links', () => {
  const get = capabilitiesApi.get as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (urlsApi.listAll as jest.Mock).mockResolvedValue([]);
  });

  it('lets a URL moderator delete a form link after warning the form keeps no link', async () => {
    const clicker = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({
      user: user({ roles: [], groups: ['/UYELER/YK'] }),
    });
    get.mockResolvedValue({ can: { 'url.moderate': true, 'url.moderateWrite': true } });
    (urlsApi.listMine as jest.Mock).mockResolvedValue([formRow]);
    (urlsApi.remove as jest.Mock).mockResolvedValue(undefined);
    render(<UrlsPage />);
    await screen.findByText(/skyl\.app\/basvuru/);
    const remove = screen.getByRole('button', { name: 'Sil' });
    await waitFor(() => expect(remove).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Düzenle' })).toBeDisabled();
    await clicker.click(remove);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Bu link bir formun linki; silersen form linksiz kalır.');
    await clicker.click(within(dialog).getByRole('button', { name: 'Linki sil' }));
    await waitFor(() => expect(urlsApi.remove).toHaveBeenCalledWith('u2'));
  });

  it('keeps Sil off on a form link for anyone without url.moderateWrite', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: user({ roles: [], groups: ['/UYELER/DK'] }),
    });
    get.mockResolvedValue({ can: { 'url.moderate': true, 'url.moderateWrite': false } });
    (urlsApi.listMine as jest.Mock).mockResolvedValue([formRow]);
    render(<UrlsPage />);
    await screen.findByText(/skyl\.app\/basvuru/);
    await waitFor(() => expect(get).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Sil' })).toBeDisabled();
    expect(screen.getByText('Forms’ta yönetiliyor')).toBeInTheDocument();
  });

  it('explains a managed refusal of a delete from a stale list and reloads it', async () => {
    const clicker = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    (urlsApi.listMine as jest.Mock).mockResolvedValue([short]);
    (urlsApi.remove as jest.Mock).mockRejectedValue(managed());
    render(<UrlsPage />);
    await clicker.click(await screen.findByRole('button', { name: 'Sil' }));
    const dialog = await screen.findByRole('alertdialog');
    (urlsApi.listMine as jest.Mock).mockResolvedValue([formRow]);
    await clicker.click(within(dialog).getByRole('button', { name: 'Linki sil' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Forms’ta ya da etkinlikte yönetiliyor; buradan değiştirilemez.',
    );
    expect(document.body).not.toHaveTextContent('Conflict');
    await waitFor(() => expect(urlsApi.listMine).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/skyl\.app\/basvuru/)).toBeInTheDocument();
  });

  it('explains a managed refusal of an edit from a stale list and reloads it', async () => {
    const clicker = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    (urlsApi.listMine as jest.Mock).mockResolvedValue([short]);
    (urlsApi.update as jest.Mock).mockRejectedValue(managed());
    render(<UrlsPage />);
    await clicker.click(await screen.findByRole('button', { name: 'Düzenle' }));
    const drawer = await screen.findByRole('dialog', { name: 'Kısa URL düzenle' });
    (urlsApi.listMine as jest.Mock).mockResolvedValue([eventRow]);
    await clicker.click(within(drawer).getByRole('button', { name: 'Kaydet' }));

    expect(await within(drawer).findByRole('alert')).toHaveTextContent(
      'Forms’ta ya da etkinlikte yönetiliyor; buradan değiştirilemez.',
    );
    await waitFor(() => expect(urlsApi.listMine).toHaveBeenCalledTimes(2));
  });
});

describe('Kısa URL hit source', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (urlsApi.listMine as jest.Mock).mockResolvedValue([short]);
    (urlsApi.listAll as jest.Mock).mockResolvedValue([short]);
  });

  it('shows the channel a hit came from by its utm source', async () => {
    const clicker = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({
      user: user({ roles: [], groups: ['/UYELER/YK'] }),
    });
    (urlsApi.listHits as jest.Mock).mockResolvedValue([
      {
        id: 'h1',
        urlId: 'u1',
        alias: 'hack',
        createdAt: '2026-01-01T08:05:00Z',
        ip: '203.0.113.9',
        userAgent: 'Safari/18',
        referer: '',
        utm: { source: 'instagram', medium: '', campaign: '', term: '', content: '' },
      },
      {
        id: 'h2',
        urlId: 'u1',
        alias: 'hack',
        createdAt: '2026-01-01T08:06:00Z',
        ip: '203.0.113.10',
        userAgent: 'Safari/18',
        referer: '',
        utm: { source: '' },
      },
    ]);
    render(<UrlsPage />);
    const buttons = await screen.findAllByRole('button', { name: 'Tıklamalar' });
    await clicker.click(buttons[0]);
    expect(await screen.findByText(/^instagram · 203\.0\.113\.9 · /)).toBeInTheDocument();
    expect(screen.getByText(/^203\.0\.113\.10 · Safari/)).toBeInTheDocument();
  });
});

describe('Kısa ad availability', () => {
  const available = (alias: string): AliasAvailability => ({ alias, available: true });
  const refused = (alias: string, reason: string): AliasAvailability => ({
    alias,
    available: false,
    reason,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    (urlsApi.listMine as jest.Mock).mockResolvedValue([short]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function setup() {
    return userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  }

  async function settle(ms = 400) {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  }

  async function renderPage() {
    render(<UrlsPage />);
    await screen.findByText(/skyl\.app\/hack/);
    return screen.getByPlaceholderText('opsiyonel');
  }

  it('asks once for the alias typed, after a pause, and says Uygun', async () => {
    const typist = setup();
    (urlsApi.availability as jest.Mock).mockResolvedValue(available('yeni-ad'));
    const alias = await renderPage();
    await typist.type(alias, 'yeni-ad');
    expect(urlsApi.availability).not.toHaveBeenCalled();
    await settle();

    expect(urlsApi.availability).toHaveBeenCalledTimes(1);
    expect(urlsApi.availability).toHaveBeenCalledWith('yeni-ad');
    expect(await screen.findByText('Uygun')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kısalt' })).toBeEnabled();
  });

  it('does not ask for an empty alias and shows no hint', async () => {
    const typist = setup();
    const alias = await renderPage();
    await typist.type(alias, '  ');
    await settle();
    expect(urlsApi.availability).not.toHaveBeenCalled();
    expect(screen.queryByText('Uygun')).not.toBeInTheDocument();
  });

  it.each([
    ['invalid', /^Geçersiz ad/],
    ['reserved', /^Bu ad ayrılmış/],
    ['taken', /^Bu ad kullanılıyor/],
  ])('blocks a new link whose alias is %s', async (reason, hint) => {
    const typist = setup();
    (urlsApi.availability as jest.Mock).mockResolvedValue(refused('go', reason));
    const alias = await renderPage();
    await typist.type(screen.getByPlaceholderText('https://…'), 'https://example.com');
    await typist.type(alias, 'go');
    await settle();

    expect(await screen.findByText(hint)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kısalt' })).toBeDisabled();
  });

  it('ignores an answer for an alias typed past', async () => {
    const typist = setup();
    const first = deferred<AliasAvailability>();
    const second = deferred<AliasAvailability>();
    (urlsApi.availability as jest.Mock)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const alias = await renderPage();
    await typist.type(alias, 'ab');
    await settle();
    await typist.type(alias, 'c');
    await settle();
    expect(urlsApi.availability).toHaveBeenNthCalledWith(1, 'ab');
    expect(urlsApi.availability).toHaveBeenNthCalledWith(2, 'abc');

    await act(async () => second.resolve(available('abc')));
    await act(async () => first.resolve(refused('ab', 'taken')));

    expect(screen.getByText('Uygun')).toBeInTheDocument();
    expect(screen.queryByText(/Bu ad kullanılıyor/)).not.toBeInTheDocument();
  });

  it('shows no hint and blocks nothing when the check fails', async () => {
    const typist = setup();
    (urlsApi.availability as jest.Mock).mockRejectedValue(new ProblemError(403, 'Forbidden'));
    const alias = await renderPage();
    await typist.type(screen.getByPlaceholderText('https://…'), 'https://example.com');
    await typist.type(alias, 'yeni');
    await settle();

    expect(urlsApi.availability).toHaveBeenCalledWith('yeni');
    expect(screen.queryByText('Forbidden')).not.toBeInTheDocument();
    expect(screen.queryByText('Uygun')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kısalt' })).toBeEnabled();
  });

  async function openEditor(typist: ReturnType<typeof setup>) {
    await renderPage();
    await typist.click(screen.getByRole('button', { name: 'Düzenle' }));
    const drawer = await screen.findByRole('dialog', { name: 'Kısa URL düzenle' });
    return {
      drawer,
      alias: within(drawer).getByDisplayValue('hack'),
      save: within(drawer).getByRole('button', { name: 'Kaydet' }),
    };
  }

  it('does not check the link’s own alias while editing, whatever its case', async () => {
    const typist = setup();
    const { alias } = await openEditor(typist);
    await typist.clear(alias);
    await typist.type(alias, 'HACK');
    await settle();
    expect(urlsApi.availability).not.toHaveBeenCalled();
  });

  it('only warns about a taken alias while editing, and lets the save decide', async () => {
    const typist = setup();
    (urlsApi.availability as jest.Mock).mockResolvedValue(refused('eski', 'taken'));
    (urlsApi.update as jest.Mock).mockResolvedValue({ ...short, alias: 'eski' });
    const { drawer, alias, save } = await openEditor(typist);
    await typist.clear(alias);
    await typist.type(alias, 'eski');
    await settle();

    expect(await within(drawer).findByText(/^Bu ad kullanılıyor/)).toBeInTheDocument();
    expect(save).toBeEnabled();
    await typist.click(save);
    expect(urlsApi.update).toHaveBeenCalledWith('u1', { url: 'https://skylab.com', alias: 'eski' });
  });

  it('blocks saving an invalid alias while editing', async () => {
    const typist = setup();
    (urlsApi.availability as jest.Mock).mockResolvedValue(refused('-x', 'invalid'));
    const { drawer, alias, save } = await openEditor(typist);
    await typist.clear(alias);
    await typist.type(alias, '-x');
    await settle();

    expect(await within(drawer).findByText(/^Geçersiz ad/)).toBeInTheDocument();
    expect(save).toBeDisabled();
  });
});
