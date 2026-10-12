import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EditAnnouncementPage from '@/app/(authorized)/announcements/[id]/edit/page';
import NewAnnouncementPage from '@/app/(authorized)/announcements/new/page';
import { newsApi } from '@/lib/api/cms';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: 'bahar-senligi' }),
}));
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'yk', groups: ['/UYELER/YK'], roles: [] } }),
}));
jest.mock('@/lib/api/cms', () => ({
  ...jest.requireActual('@/lib/api/cms'),
  newsApi: { get: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() },
}));

const item = {
  id: 'n1',
  collectionKey: 'news',
  slug: 'bahar-senligi',
  data: { title: 'Bahar şenliği', body: 'Gel.' },
  version: 3,
};

describe('Announcement pages feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (newsApi.get as jest.Mock).mockResolvedValue(item);
  });

  it('says the announcement was published', async () => {
    const user = userEvent.setup();
    (newsApi.create as jest.Mock).mockResolvedValue(item);
    render(<NewAnnouncementPage />);
    await user.type(screen.getByLabelText('Başlık'), 'Bahar şenliği');
    await user.type(screen.getByLabelText('İçerik'), 'Gel.');
    await user.click(screen.getByRole('button', { name: 'Yayınla' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/announcements'));
    expect(await screen.findByText('Duyuru yayınlandı')).toBeInTheDocument();
  });

  it('says the announcement was updated and deleted', async () => {
    const user = userEvent.setup();
    (newsApi.update as jest.Mock).mockResolvedValue(item);
    (newsApi.remove as jest.Mock).mockResolvedValue({});
    render(<EditAnnouncementPage />);
    await user.click(await screen.findByRole('button', { name: 'Güncelle' }));
    expect(await screen.findByText('Duyuru güncellendi')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sil' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: '"Bahar şenliği" duyurusu silinsin mi?',
    });
    expect(newsApi.remove).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Duyuruyu sil' }));
    await waitFor(() => expect(newsApi.remove).toHaveBeenCalledWith('bahar-senligi', 3));
    expect(await screen.findByText('Duyuru silindi')).toBeInTheDocument();
  });

  it('announces a refused delete', async () => {
    const user = userEvent.setup();
    (newsApi.remove as jest.Mock).mockRejectedValue(new Error('x'));
    render(<EditAnnouncementPage />);
    await user.click(await screen.findByRole('button', { name: 'Sil' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Duyuruyu sil' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Silinemedi');
  });
});
