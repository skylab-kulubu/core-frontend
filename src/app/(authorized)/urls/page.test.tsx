import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import UrlsPage from '@/app/(authorized)/urls/page';
import { ProblemError } from '@/lib/api/core';
import { urlsApi, type AliasAvailability, type ShortUrl } from '@/lib/api/urls';
import { useAuth } from '@/context/AuthContext';
import type { UserDto } from '@/types/api';

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
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
    },
  };
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
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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

  it('keeps the list when the chosen filter is clicked again', async () => {
    const clicker = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    render(<UrlsPage />);
    await screen.findByText(/skyl\.app\/hack/);
    const filter = screen.getByRole('group', { name: 'Link türü' });
    await clicker.click(within(filter).getByRole('button', { name: 'Tümü' }));
    expect(screen.getByText(/skyl\.app\/hack/)).toBeInTheDocument();
    expect(urlsApi.listMine).toHaveBeenCalledTimes(1);
  });

  it('reloads after a change with the filter chosen while it was pending', async () => {
    const clicker = userEvent.setup();
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    (urlsApi.listMine as jest.Mock).mockImplementation(async (kind: string) =>
      kind === 'form' ? [formRow] : [short],
    );
    const removal = deferred<void>();
    (urlsApi.remove as jest.Mock).mockReturnValue(removal.promise);
    render(<UrlsPage />);
    await clicker.click(await screen.findByRole('button', { name: 'Sil' }));
    const filter = screen.getByRole('group', { name: 'Link türü' });
    await clicker.click(within(filter).getByRole('button', { name: 'Form' }));
    await screen.findByText(/skyl\.app\/basvuru/);

    await act(async () => removal.resolve());

    await waitFor(() => expect(urlsApi.listMine).toHaveBeenCalledTimes(3));
    expect(urlsApi.listMine).toHaveBeenLastCalledWith('form');
    expect(screen.getByText(/skyl\.app\/basvuru/)).toBeInTheDocument();
    expect(screen.queryByText(/skyl\.app\/hack/)).not.toBeInTheDocument();
  });

  it('shows only the answer for the latest filter', async () => {
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

describe('Kısa URL managed refusals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: creator() });
    (urlsApi.listMine as jest.Mock).mockResolvedValue([short]);
  });

  it('explains a managed refusal of an edit and reloads the list', async () => {
    const clicker = userEvent.setup();
    (urlsApi.update as jest.Mock).mockRejectedValue(managed());
    render(<UrlsPage />);
    await clicker.click(await screen.findByRole('button', { name: 'Düzenle' }));
    (urlsApi.listMine as jest.Mock).mockResolvedValue([formRow]);
    await clicker.click(await screen.findByRole('button', { name: 'Kaydet' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Forms’ta ya da etkinlikte yönetiliyor',
    );
    expect(screen.queryByText('Conflict')).not.toBeInTheDocument();
    expect(urlsApi.listMine).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/skyl\.app\/basvuru/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kaydet' })).not.toBeInTheDocument();
  });

  it('explains a managed refusal of a delete and reloads the list', async () => {
    const clicker = userEvent.setup();
    (urlsApi.remove as jest.Mock).mockRejectedValue(managed());
    render(<UrlsPage />);
    await clicker.click(await screen.findByRole('button', { name: 'Sil' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Forms’ta ya da etkinlikte yönetiliyor',
    );
    expect(screen.queryByText('Conflict')).not.toBeInTheDocument();
    await waitFor(() => expect(urlsApi.listMine).toHaveBeenCalledTimes(2));
  });

  it('clears the managed notice when the filter changes', async () => {
    const clicker = userEvent.setup();
    (urlsApi.remove as jest.Mock).mockRejectedValue(managed());
    render(<UrlsPage />);
    await clicker.click(await screen.findByRole('button', { name: 'Sil' }));
    await screen.findByRole('status');

    const filter = screen.getByRole('group', { name: 'Link türü' });
    await clicker.click(within(filter).getByRole('button', { name: 'Kişisel' }));

    await waitFor(() => expect(urlsApi.listMine).toHaveBeenLastCalledWith('personal'));
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('clears the managed notice after a later successful reload', async () => {
    const clicker = userEvent.setup();
    (urlsApi.remove as jest.Mock).mockRejectedValueOnce(managed()).mockResolvedValueOnce(undefined);
    render(<UrlsPage />);
    await clicker.click(await screen.findByRole('button', { name: 'Sil' }));
    await screen.findByRole('status');

    await clicker.click(screen.getByRole('button', { name: 'Sil' }));

    await waitFor(() => expect(urlsApi.listMine).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('still shows any other refusal by its title', async () => {
    const clicker = userEvent.setup();
    (urlsApi.remove as jest.Mock).mockRejectedValue(new ProblemError(403, 'Forbidden'));
    render(<UrlsPage />);
    await clicker.click(await screen.findByRole('button', { name: 'Sil' }));
    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
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
    [
      'invalid',
      'Geçersiz ad: harf ya da rakamla başlar; harf, rakam, - ve _; en fazla 64 karakter',
    ],
    ['reserved', 'Bu ad ayrılmış'],
    ['taken', 'Bu ad kullanılıyor (eski adlar da dolu sayılır)'],
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

  it('ignores an answer for an alias the operator has typed past', async () => {
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
    (urlsApi.availability as jest.Mock).mockRejectedValue(new ProblemError(500, 'Boom'));
    const alias = await renderPage();
    await typist.type(screen.getByPlaceholderText('https://…'), 'https://example.com');
    await typist.type(alias, 'yeni');
    await settle();

    expect(urlsApi.availability).toHaveBeenCalledWith('yeni');
    expect(screen.queryByText('Boom')).not.toBeInTheDocument();
    expect(screen.queryByText('Uygun')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kısalt' })).toBeEnabled();
  });

  async function openEditor(typist: ReturnType<typeof setup>) {
    await renderPage();
    await typist.click(screen.getByRole('button', { name: 'Düzenle' }));
    const drawer = await screen.findByRole('dialog');
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

    expect(
      await within(drawer).findByText('Bu ad kullanılıyor (eski adlar da dolu sayılır)'),
    ).toBeInTheDocument();
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

    expect(await within(drawer).findByText(/Geçersiz ad/)).toBeInTheDocument();
    expect(save).toBeDisabled();
  });
});
