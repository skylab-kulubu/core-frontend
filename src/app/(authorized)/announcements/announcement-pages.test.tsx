import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EditAnnouncementPage from '@/app/(authorized)/announcements/[id]/edit/page';
import NewAnnouncementPage from '@/app/(authorized)/announcements/new/page';
import { AUTOSAVE_DELAY_MS } from '@/components/announcements/NewsEditor';
import { newsApi } from '@/lib/api/cms';
import { ProblemError } from '@/lib/api/core';
import { mediaApi } from '@/lib/api/media';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useParams: () => ({ id: 'bahar-senligi' }),
  usePathname: () => '/announcements/bahar-senligi/edit',
}));
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'yk', groups: ['/UYELER/YK'], roles: [] } }),
}));
jest.mock('@/lib/api/cms', () => ({
  ...jest.requireActual('@/lib/api/cms'),
  newsApi: {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    restore: jest.fn(),
    saveDraft: jest.fn(),
    discardDraft: jest.fn(),
    savePendingDraft: jest.fn(),
    discardPendingDraft: jest.fn(),
  },
}));
jest.mock('@/lib/api/media', () => ({
  mediaApi: { upload: jest.fn(), list: jest.fn() },
}));
// Tiptap has its own test; here the body is a plain box writing HTML
jest.mock('@/components/announcements/RichTextEditor', () => ({
  RichTextEditor: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (html: string) => void;
  }) => (
    <textarea
      aria-label={label}
      value={value}
      onChange={(event) => {
        const text = event.target.value.replace(/<\/?p>/g, '');
        onChange(text ? `<p>${text}</p>` : '');
      }}
    />
  ),
  RichTextView: ({ html }: { html: string }) => <div data-testid="preview-body">{html}</div>,
}));

const item = {
  id: 'n1',
  collectionKey: 'news',
  slug: 'bahar-senligi',
  data: { title: 'Bahar şenliği', body: 'Gel.' },
  version: 3,
};

async function rest() {
  await act(async () => {
    jest.advanceTimersByTime(AUTOSAVE_DELAY_MS + 50);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (newsApi.get as jest.Mock).mockResolvedValue(item);
  (newsApi.list as jest.Mock).mockResolvedValue({ items: [], total: 0, offset: 0, limit: 1 });
  (newsApi.saveDraft as jest.Mock).mockResolvedValue(undefined);
  (newsApi.savePendingDraft as jest.Mock).mockResolvedValue(undefined);
  (newsApi.discardDraft as jest.Mock).mockResolvedValue(undefined);
  (newsApi.discardPendingDraft as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

function typist() {
  return userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
}

describe('New announcement', () => {
  it('keeps what is typed as a draft, then publishes and opens it', async () => {
    const user = typist();
    (newsApi.create as jest.Mock).mockResolvedValue(item);
    render(<NewAnnouncementPage />);
    await user.type(await screen.findByLabelText('Başlık'), 'Bahar şenliği');
    await user.type(screen.getByLabelText('İçerik'), 'Gel.');
    expect(newsApi.savePendingDraft).not.toHaveBeenCalled();
    await rest();
    await waitFor(() =>
      expect(newsApi.savePendingDraft).toHaveBeenLastCalledWith({
        title: 'Bahar şenliği',
        body: '<p>Gel.</p>',
      }),
    );
    expect(await screen.findByText('Taslak yalnız sana görünür')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yayınla' }));
    await waitFor(() =>
      expect(newsApi.create).toHaveBeenCalledWith({ title: 'Bahar şenliği', body: '<p>Gel.</p>' }),
    );
    expect(mockPush).toHaveBeenCalledWith('/announcements/bahar-senligi/edit');
    expect(await screen.findByText('Duyuru yayınlandı')).toBeInTheDocument();
  });

  it('opens on the draft the writer left', async () => {
    (newsApi.list as jest.Mock).mockResolvedValue({
      items: [],
      total: 0,
      offset: 0,
      limit: 1,
      virtualItems: [{ origin: 'pending', data: {}, draftData: { title: 'Yarım kalan' } }],
    });
    render(<NewAnnouncementPage />);
    expect(await screen.findByDisplayValue('Yarım kalan')).toBeInTheDocument();
    expect(screen.getByText('Taslak yalnız sana görünür')).toBeInTheDocument();
  });

  it('asks for a title and a body before publishing', async () => {
    const user = typist();
    render(<NewAnnouncementPage />);
    await user.click(await screen.findByRole('button', { name: 'Yayınla' }));
    expect(await screen.findByText('Başlık yaz')).toBeInTheDocument();
    expect(newsApi.create).not.toHaveBeenCalled();
  });

  it('shows the announcement as it will read', async () => {
    const user = typist();
    render(<NewAnnouncementPage />);
    await user.type(await screen.findByLabelText('Başlık'), 'Önizleme başlığı');
    await user.click(screen.getByRole('button', { name: 'Önizle' }));
    const preview = screen.getByRole('article', { name: 'Önizleme' });
    expect(within(preview).getByRole('heading', { name: 'Önizleme başlığı' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Başlık')).not.toBeInTheDocument();
  });

  it('says why a draft could not be kept', async () => {
    const user = typist();
    (newsApi.savePendingDraft as jest.Mock).mockRejectedValue(new Error('503'));
    render(<NewAnnouncementPage />);
    await user.type(await screen.findByLabelText('Başlık'), 'X');
    await rest();
    expect(await screen.findByText('Taslak kaydedilemedi')).toBeInTheDocument();
  });
});

describe('Edit announcement', () => {
  it('opens a plain-text body as paragraphs and publishes the change with its version', async () => {
    const user = typist();
    (newsApi.update as jest.Mock).mockResolvedValue(item);
    render(<EditAnnouncementPage />);
    const body = await screen.findByLabelText('İçerik');
    expect(body).toHaveValue('<p>Gel.</p>');
    // Nothing changed: nothing to publish
    expect(screen.getByRole('button', { name: 'Güncelle' })).toBeDisabled();
    expect(screen.getByText('Yayında')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Özet'), 'Kampüste');
    expect(screen.getByText('Yayınlanmamış değişiklik')).toBeInTheDocument();
    await rest();
    await waitFor(() =>
      expect(newsApi.saveDraft).toHaveBeenCalledWith('bahar-senligi', {
        title: 'Bahar şenliği',
        body: '<p>Gel.</p>',
        summary: 'Kampüste',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Güncelle' }));
    await waitFor(() =>
      expect(newsApi.update).toHaveBeenCalledWith(
        'bahar-senligi',
        { title: 'Bahar şenliği', body: '<p>Gel.</p>', summary: 'Kampüste' },
        3,
      ),
    );
    expect(await screen.findByText('Duyuru güncellendi')).toBeInTheDocument();
  });

  it('opens on the writer’s draft and throws it away on request', async () => {
    const user = typist();
    (newsApi.get as jest.Mock).mockResolvedValue({
      ...item,
      draftData: { ...item.data, title: 'Taslak başlık' },
    });
    render(<EditAnnouncementPage />);
    expect(await screen.findByDisplayValue('Taslak başlık')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Değişiklikleri at' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Yayınlanmamış değişiklikler atılsın mı?',
    });
    await user.click(within(confirm).getByRole('button', { name: 'Değişiklikleri at' }));
    await waitFor(() => expect(newsApi.discardDraft).toHaveBeenCalledWith('bahar-senligi'));
    expect(await screen.findByDisplayValue('Bahar şenliği')).toBeInTheDocument();
  });

  it('says a version conflict in Turkish and keeps the text', async () => {
    const user = typist();
    (newsApi.update as jest.Mock).mockRejectedValue(new ProblemError(409, 'Conflict'));
    render(<EditAnnouncementPage />);
    await user.type(await screen.findByLabelText('Başlık'), '!');
    await user.click(screen.getByRole('button', { name: 'Güncelle' }));
    expect(
      await screen.findByText(/sen açtıktan sonra başka biri tarafından değiştirildi/),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bahar şenliği!')).toBeInTheDocument();
  });

  it('stops autosaving an item deleted meanwhile and says so', async () => {
    const user = typist();
    (newsApi.saveDraft as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { fields: { reason: 'archived' } }),
    );
    render(<EditAnnouncementPage />);
    await user.type(await screen.findByLabelText('Başlık'), '!');
    await rest();
    expect(
      (await screen.findAllByText('Bu duyuru bu arada başka biri tarafından silindi.')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Güncelle' })).toBeDisabled();
  });

  it('deletes after asking and offers it back', async () => {
    const user = typist();
    (newsApi.remove as jest.Mock).mockResolvedValue({});
    (newsApi.restore as jest.Mock).mockResolvedValue(item);
    render(<EditAnnouncementPage />);
    await user.click(await screen.findByRole('button', { name: 'Sil' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: '"Bahar şenliği" duyurusu silinsin mi?',
    });
    expect(newsApi.remove).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Duyuruyu sil' }));
    await waitFor(() => expect(newsApi.remove).toHaveBeenCalledWith('bahar-senligi', 3));
    expect(mockPush).toHaveBeenCalledWith('/announcements');
    await user.click(await screen.findByRole('button', { name: 'Geri al' }));
    await waitFor(() => expect(newsApi.restore).toHaveBeenCalledWith('bahar-senligi', 3));
  });

  it('announces a refused delete inside the question', async () => {
    const user = typist();
    (newsApi.remove as jest.Mock).mockRejectedValue(new Error('x'));
    render(<EditAnnouncementPage />);
    await user.click(await screen.findByRole('button', { name: 'Sil' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Duyuruyu sil' }));
    expect(await within(confirm).findByRole('alert')).toHaveTextContent('Duyuru silinemedi');
  });

  it('offers an archived announcement back', async () => {
    const user = typist();
    (newsApi.get as jest.Mock).mockResolvedValueOnce({ ...item, isArchived: true });
    (newsApi.restore as jest.Mock).mockResolvedValue(item);
    render(<EditAnnouncementPage />);
    expect(await screen.findByText('Bu duyuru silindi')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Geri getir' }));
    await waitFor(() => expect(newsApi.restore).toHaveBeenCalledWith('bahar-senligi', 3));
    expect(await screen.findByLabelText('Başlık')).toHaveValue('Bahar şenliği');
  });
});

describe('Cover', () => {
  it('uploads a cover and shows it whole', async () => {
    const user = typist();
    (mediaApi.upload as jest.Mock).mockResolvedValue({
      id: 'm1',
      url: 'https://cdn.example/a.png',
    });
    render(<NewAnnouncementPage />);
    const input = await screen.findByLabelText('Kapak görseli dosyası');
    await user.upload(input, new File(['x'], 'a.png', { type: 'image/png' }));
    const img = await screen.findByAltText('Kapak önizlemesi');
    expect(img).toHaveAttribute('src', 'https://cdn.example/a.png');
    expect(img).toHaveClass('object-contain');
    expect(mediaApi.upload).toHaveBeenCalledWith(expect.any(File));
  });

  it('picks a cover from the media library, only pictures that stay', async () => {
    const user = typist();
    (mediaApi.list as jest.Mock).mockResolvedValue([
      {
        id: 'a',
        name: 'afis.png',
        type: 'image/png',
        url: 'https://cdn.example/afis.png',
        purpose: 'legacy',
      },
      {
        id: 'b',
        name: 'gecici.png',
        type: 'image/png',
        url: 'https://cdn.example/g.png',
        purpose: 'event_cover',
        status: 'pending',
      },
      { id: 'c', name: 'belge.pdf', type: 'application/pdf', url: 'https://cdn.example/b.pdf' },
    ]);
    render(<NewAnnouncementPage />);
    await user.click(await screen.findByRole('button', { name: 'Kütüphaneden seç' }));
    const drawer = await screen.findByRole('dialog', { name: 'Medya kütüphanesi' });
    expect(await within(drawer).findByText('afis.png')).toBeInTheDocument();
    expect(within(drawer).queryByText('gecici.png')).not.toBeInTheDocument();
    expect(within(drawer).queryByText('belge.pdf')).not.toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: /afis\.png/ }));
    expect(await screen.findByAltText('Kapak önizlemesi')).toHaveAttribute(
      'src',
      'https://cdn.example/afis.png',
    );
  });
});
