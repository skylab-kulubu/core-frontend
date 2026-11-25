import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventTicketImageFields } from '@/components/scheduling/EventTicketImageFields';
import { ProblemError } from '@/lib/api/core';
import { mediaApi } from '@/lib/api/media';
import { ticketImageApi } from '@/lib/api/ticket-image';

jest.mock('@/lib/api/ticket-image', () => ({
  ticketImageApi: { get: jest.fn(), save: jest.fn() },
}));

jest.mock('@/lib/api/media', () => ({
  mediaApi: { upload: jest.fn() },
}));

const get = ticketImageApi.get as jest.Mock;
const save = ticketImageApi.save as jest.Mock;
const upload = mediaApi.upload as jest.Mock;

const band = { widthMm: 182, heightMm: 24 };
const cover = { id: 'kapak', url: 'images/kapak.jpg' };

/** The band's image reports its size, as the browser does once it loads. */
function loadImage(width: number, height: number) {
  const img = document.querySelector('[data-slot="ticket-band"] img') as HTMLImageElement;
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  fireEvent.load(img);
  return img;
}

beforeEach(() => {
  get.mockReset();
  save.mockReset();
  upload.mockReset();
});

describe('EventTicketImageFields', () => {
  it('says a new Event chooses once it is saved', async () => {
    get.mockRejectedValue(new ProblemError(404, 'Not Found'));
    render(<EventTicketImageFields eventId="yeni" coverImageId="" />);
    expect(await screen.findByText('Etkinlik kaydedilince seçilir.')).toBeInTheDocument();
  });

  it('shows the cover’s middle by default and saves a region of the cover', async () => {
    get.mockResolvedValue({ source: 'auto', coverChanged: false, band });
    save.mockImplementation((_id, body) => Promise.resolve({ ...body, coverChanged: false, band }));
    render(<EventTicketImageFields eventId="e1" coverImageId="kapak" knownMedia={[cover]} />);
    const select = await screen.findByLabelText('Bilet görseli kaynağı');
    const img = loadImage(1000, 1500);
    expect(img.getAttribute('src')).toContain('images/kapak.jpg');
    expect(screen.getByRole('button', { name: 'Bilet görselini kaydet' })).toBeDisabled();

    await userEvent.selectOptions(select, 'cover');
    loadImage(1000, 1500);
    fireEvent.change(screen.getByLabelText('Yakınlaştır'), { target: { value: '2' } });
    await userEvent.click(screen.getByRole('button', { name: 'Bilet görselini kaydet' }));

    await waitFor(() => expect(save).toHaveBeenCalled());
    const [id, body] = save.mock.calls[0];
    expect(id).toBe('e1');
    expect(body.source).toBe('cover');
    expect(body.coverMediaId).toBe('kapak');
    expect(body.crop.w).toBeCloseTo(0.5, 6);
    expect((body.crop.w * 1000) / (body.crop.h * 1500)).toBeCloseTo(182 / 24, 4);
    expect(await screen.findByText('Kaydedildi.')).toBeInTheDocument();
  });

  it('uploads an image of its own and saves it with its region', async () => {
    get.mockResolvedValue({ source: 'auto', coverChanged: false, band });
    upload.mockResolvedValue({ id: 'logo', url: 'images/logo.png', name: 'logo.png' });
    save.mockImplementation((_id, body) =>
      Promise.resolve({ ...body, mediaUrl: 'images/logo.png', coverChanged: false, band }),
    );
    render(<EventTicketImageFields eventId="e1" coverImageId="" />);
    await userEvent.selectOptions(await screen.findByLabelText('Bilet görseli kaynağı'), 'upload');
    await userEvent.upload(
      screen.getByLabelText('Bilet görseli seç'),
      new File(['x'], 'logo.png', { type: 'image/png' }),
    );
    await waitFor(() => expect(upload).toHaveBeenCalledWith(expect.any(File), 'event_cover'));
    loadImage(2000, 400);
    await userEvent.click(screen.getByRole('button', { name: 'Bilet görselini kaydet' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    const [, body] = save.mock.calls[0];
    expect(body).toMatchObject({ source: 'upload', mediaId: 'logo' });
    expect(body.crop.w).toBe(1);
  });

  it('says when the cover changed under a cover region', async () => {
    get.mockResolvedValue({
      source: 'cover',
      coverMediaId: 'eski',
      crop: { x: 0, y: 0, w: 1, h: 0.1 },
      coverChanged: true,
      band,
    });
    render(<EventTicketImageFields eventId="e1" coverImageId="eski" knownMedia={[cover]} />);
    expect(await screen.findByText(/Kapak değişti/)).toBeInTheDocument();
  });
});
