import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { EventMediaFields } from '@/components/scheduling/EventMediaFields';
import { ProblemError } from '@/lib/api/core';
import { mediaApi } from '@/lib/api/media';

jest.mock('@/lib/api/media', () => ({
  mediaApi: { upload: jest.fn() },
}));

jest.mock('@/lib/api/events', () => ({
  eventsApi: { list: jest.fn().mockResolvedValue([]) },
}));

const upload = mediaApi.upload as jest.Mock;

function photo(name: string) {
  return new File(['x'], name, { type: 'image/png' });
}

function uploaded(id: string) {
  return { id, name: `${id}.png`, type: 'image/png', url: `images/${id}`, size: 1, kind: 'image' };
}

function renderFields(props: Partial<React.ComponentProps<typeof EventMediaFields>> = {}) {
  const onCover = jest.fn();
  const onGallery = jest.fn();
  render(
    <EventMediaFields
      ownerTeam=""
      coverImageId=""
      imageIds={[]}
      onCover={onCover}
      onGallery={onGallery}
      {...props}
    />,
  );
  return { onCover, onGallery };
}

function rateLimited(retryAfterSeconds: number) {
  return new ProblemError(429, 'Too Many Requests', {
    code: 'media_rate_limited',
    detail: "The person's upload limit is reached; retry after the given seconds.",
    fields: {
      limit: 'uploads',
      maxUploads: 100,
      uploadWindowSeconds: 600,
      maxDailyBytes: 2147483648,
      retryAfterSeconds,
    },
  });
}

/** The Event editor around the fields: it keeps the gallery the fields hand back. */
function Gallery({ initial = [] as string[], onChange = (_ids: string[]) => {} }) {
  const [imageIds, setImageIds] = useState(initial);
  return (
    <EventMediaFields
      ownerTeam=""
      coverImageId=""
      imageIds={imageIds}
      onCover={() => {}}
      onGallery={(ids) => {
        setImageIds(ids);
        onChange(ids);
      }}
    />
  );
}

/** Like EventEditor: each change patches the whole form from the value it rendered with. */
function EventForm({
  onChange,
}: {
  onChange: (form: { name: string; imageIds: string[] }) => void;
}) {
  const [form, setForm] = useState({ name: 'Gecekodu', imageIds: ['g0'] });
  const patch = (partial: Partial<typeof form>) => {
    const next = { ...form, ...partial };
    setForm(next);
    onChange(next);
  };
  return (
    <>
      <input aria-label="Ad" value={form.name} onChange={(e) => patch({ name: e.target.value })} />
      <EventMediaFields
        ownerTeam=""
        coverImageId=""
        imageIds={form.imageIds}
        onCover={() => {}}
        onGallery={(imageIds) => patch({ imageIds })}
      />
    </>
  );
}

describe('EventMediaFields', () => {
  beforeEach(() => {
    upload.mockReset();
  });

  it('uploads a cover as an Event cover', async () => {
    upload.mockResolvedValue(uploaded('c1'));
    const { onCover } = renderFields();

    await userEvent.upload(screen.getByLabelText('Kapak görseli seç'), photo('kapak.png'));

    await waitFor(() => expect(onCover).toHaveBeenCalledWith('c1', expect.any(String)));
    expect(upload).toHaveBeenCalledWith(expect.any(File), 'event_cover');
  });

  it('uploads gallery photos as Event gallery and adds them after the existing ones', async () => {
    upload.mockResolvedValueOnce(uploaded('g2')).mockResolvedValueOnce(uploaded('g3'));
    const { onGallery } = renderFields({ imageIds: ['g1'] });

    await userEvent.upload(screen.getByLabelText('Galeri görselleri seç'), [
      photo('a.png'),
      photo('b.png'),
    ]);

    await waitFor(() =>
      expect(onGallery).toHaveBeenCalledWith(['g1', 'g2', 'g3'], expect.any(Object)),
    );
    expect(upload.mock.calls.map((call) => call[1])).toEqual(['event_gallery', 'event_gallery']);
  });

  it('skips a photo core refuses for itself and uploads the others', async () => {
    upload
      .mockResolvedValueOnce(uploaded('g1'))
      .mockRejectedValueOnce(
        new ProblemError(415, 'Unsupported Media Type', {
          code: 'media_type_not_allowed',
          fields: {
            purpose: 'event_gallery',
            allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          },
        }),
      )
      .mockResolvedValueOnce(uploaded('g3'));
    const gallery = jest.fn();
    render(<Gallery onChange={gallery} />);

    await userEvent.upload(screen.getByLabelText('Galeri görselleri seç'), [
      photo('a.png'),
      photo('b.heic'),
      photo('c.png'),
    ]);

    await waitFor(() => expect(gallery).toHaveBeenLastCalledWith(['g1', 'g3']));
    expect(
      screen.getByText(
        'b.heic: Bu dosya türü Etkinlik galerisi için kabul edilmiyor. Kabul edilenler: JPEG, PNG, WebP, GIF.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Kalan/ })).not.toBeInTheDocument();
  });

  it('skips a file core refuses with a bare 413 and uploads the rest', async () => {
    upload
      .mockResolvedValueOnce(uploaded('g1'))
      .mockRejectedValueOnce(new ProblemError(413, 'Request Entity Too Large'))
      .mockResolvedValueOnce(uploaded('g3'));
    const gallery = jest.fn();
    render(<Gallery onChange={gallery} />);

    await userEvent.upload(screen.getByLabelText('Galeri görselleri seç'), [
      photo('a.png'),
      photo('dev.png'),
      photo('c.png'),
    ]);

    await waitFor(() => expect(gallery).toHaveBeenLastCalledWith(['g1', 'g3']));
    expect(
      screen.getByText('dev.png: Dosya çok büyük: sunucu tek seferde en fazla 20 MB kabul ediyor.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Kalan/ })).not.toBeInTheDocument();
  });

  it('never sends a file above what core takes in one request', async () => {
    upload.mockResolvedValueOnce(uploaded('g1'));
    const gallery = jest.fn();
    render(<Gallery onChange={gallery} />);
    const huge = photo('video.png');
    Object.defineProperty(huge, 'size', { value: 21 * 1024 * 1024 });

    await userEvent.upload(screen.getByLabelText('Galeri görselleri seç'), [huge, photo('a.png')]);

    await waitFor(() => expect(gallery).toHaveBeenLastCalledWith(['g1']));
    expect(upload).toHaveBeenCalledTimes(1);
    expect((upload.mock.calls[0][0] as File).name).toBe('a.png');
    expect(
      screen.getByText(
        'video.png: Dosya çok büyük: sunucu tek seferde en fazla 20 MB kabul ediyor.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Kalan/ })).not.toBeInTheDocument();
  });

  it('keeps the uploaded photos when the connection fails mid-gallery and offers the rest', async () => {
    upload
      .mockResolvedValueOnce(uploaded('g1'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const gallery = jest.fn();
    render(<Gallery onChange={gallery} />);

    await userEvent.upload(screen.getByLabelText('Galeri görselleri seç'), [
      photo('a.png'),
      photo('b.png'),
      photo('c.png'),
    ]);

    await waitFor(() => expect(gallery).toHaveBeenLastCalledWith(['g1']));
    expect(await screen.findByRole('button', { name: 'Kalan 2 görseli yükle' })).toBeEnabled();
    expect(screen.getByText('Yüklenemedi')).toBeInTheDocument();
  });

  it('keeps the edits made while a gallery upload runs', async () => {
    let finish: (media: ReturnType<typeof uploaded>) => void = () => {};
    upload.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const changed = jest.fn();
    render(<EventForm onChange={changed} />);

    await userEvent.upload(screen.getByLabelText('Galeri görselleri seç'), [photo('a.png')]);
    await userEvent.type(screen.getByLabelText('Ad'), ' 2026');
    await userEvent.click(screen.getByRole('button', { name: 'Kaldır' }));
    await act(async () => finish(uploaded('g1')));

    await waitFor(() =>
      expect(changed).toHaveBeenLastCalledWith({ name: 'Gecekodu 2026', imageIds: ['g1'] }),
    );
  });

  describe('when the upload limit stops a bulk gallery upload', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('keeps what uploaded, shows the wait, and uploads the rest once it passes', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      upload
        .mockResolvedValueOnce(uploaded('g1'))
        .mockRejectedValueOnce(rateLimited(240))
        .mockResolvedValueOnce(uploaded('g2'))
        .mockResolvedValueOnce(uploaded('g3'));
      const gallery = jest.fn();
      render(<Gallery onChange={gallery} />);

      await user.upload(screen.getByLabelText('Galeri görselleri seç'), [
        photo('a.png'),
        photo('b.png'),
        photo('c.png'),
      ]);

      expect(
        await screen.findByText(
          'Yükleme sınırına ulaştın: 10 dakikada en fazla 100 dosya. 4 dakika sonra tekrar dene.',
        ),
      ).toBeInTheDocument();
      expect(gallery).toHaveBeenLastCalledWith(['g1']);
      expect(upload).toHaveBeenCalledTimes(2);
      const resume = screen.getByRole('button', { name: 'Kalan 2 görseli yükle' });
      expect(resume).toBeDisabled();

      act(() => {
        jest.advanceTimersByTime(240_000);
      });
      await waitFor(() => expect(resume).toBeEnabled());
      await user.click(resume);

      await waitFor(() => expect(gallery).toHaveBeenLastCalledWith(['g1', 'g2', 'g3']));
      expect(upload.mock.calls.slice(2).map((call) => [(call[0] as File).name, call[1]])).toEqual([
        ['b.png', 'event_gallery'],
        ['c.png', 'event_gallery'],
      ]);
      expect(screen.queryByRole('button', { name: /Kalan/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/Yükleme sınırına ulaştın/)).not.toBeInTheDocument();
    });

    it('keeps the waiting photos when the organizer picks more before continuing', async () => {
      upload
        .mockRejectedValueOnce(rateLimited(60))
        .mockRejectedValueOnce(rateLimited(30))
        .mockResolvedValue(uploaded('later'));
      render(<Gallery />);

      await userEvent.upload(screen.getByLabelText('Galeri görselleri seç'), [
        photo('a.png'),
        photo('b.png'),
      ]);
      expect(await screen.findByRole('button', { name: 'Kalan 2 görseli yükle' })).toBeDisabled();

      await userEvent.upload(screen.getByLabelText('Galeri görselleri seç'), [photo('c.png')]);

      expect(await screen.findByRole('button', { name: 'Kalan 3 görseli yükle' })).toBeDisabled();
      expect(
        screen.getByText(
          'Yükleme sınırına ulaştın: 10 dakikada en fazla 100 dosya. 30 saniye sonra tekrar dene.',
        ),
      ).toBeInTheDocument();
    });

    it('keeps the wait running when a later batch stops for another reason', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      upload
        .mockRejectedValueOnce(rateLimited(240))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'));
      render(<Gallery />);

      await user.upload(screen.getByLabelText('Galeri görselleri seç'), [
        photo('a.png'),
        photo('b.png'),
      ]);
      expect(await screen.findByRole('button', { name: 'Kalan 2 görseli yükle' })).toBeDisabled();

      await user.upload(screen.getByLabelText('Galeri görselleri seç'), [photo('c.png')]);
      const resume = await screen.findByRole('button', { name: 'Kalan 3 görseli yükle' });
      expect(screen.getByText('Yüklenemedi')).toBeInTheDocument();
      expect(resume).toBeDisabled();

      act(() => {
        jest.advanceTimersByTime(240_000);
      });
      await waitFor(() => expect(resume).toBeEnabled());
    });
  });
});
