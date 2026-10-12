import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { NewsForm } from '@/app/(authorized)/announcements/NewsForm';
import { ProblemError } from '@/lib/api/core';
import { mediaApi } from '@/lib/api/media';

jest.mock('@/lib/api/media', () => ({ mediaApi: { upload: jest.fn() } }));

const upload = mediaApi.upload as jest.Mock;
const photo = () => new File(['x'], 'kapak.png', { type: 'image/png' });

function renderForm(initial = {}) {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  render(<NewsForm initial={initial} submitLabel="Yayınla" onSubmit={onSubmit} />);
  return onSubmit;
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Başlık'), 'Duyuru');
  await user.type(screen.getByLabelText('İçerik'), 'Metin');
}

describe('NewsForm cover image', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uploads the cover without leaving the form, previews it and saves its address', async () => {
    const user = userEvent.setup();
    upload.mockResolvedValue({ id: 'm1', url: 'https://cdn.example.test/images/m1' });
    const onSubmit = renderForm();
    await fillRequired(user);

    await user.upload(screen.getByLabelText('Kapak görseli dosyası'), photo());

    expect(upload).toHaveBeenCalledWith(expect.any(File));
    expect(upload.mock.calls[0]).toHaveLength(1);
    expect(await screen.findByAltText('Kapak önizlemesi')).toHaveAttribute(
      'src',
      'https://cdn.example.test/images/m1',
    );
    expect(screen.getByLabelText('Kapak görseli adresi')).toHaveValue(
      'https://cdn.example.test/images/m1',
    );
    expect(screen.getByLabelText('Başlık')).toHaveValue('Duyuru');
    expect(screen.getByRole('button', { name: 'Görseli değiştir' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Yayınla' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ heroImage: 'https://cdn.example.test/images/m1' }),
      ),
    );
  });

  it('removes the cover', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm({ heroImage: 'https://cdn.example.test/images/old' });
    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Kapağı kaldır' }));
    expect(screen.queryByAltText('Kapak önizlemesi')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yayınla' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('heroImage');
  });

  it('keeps the form and shows why an upload failed', async () => {
    const user = userEvent.setup();
    upload.mockRejectedValue(new ProblemError(413, 'Payload Too Large'));
    renderForm();
    await fillRequired(user);
    await user.upload(screen.getByLabelText('Kapak görseli dosyası'), photo());
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('Başlık')).toHaveValue('Duyuru');
    expect(screen.queryByAltText('Kapak önizlemesi')).not.toBeInTheDocument();
  });
});
