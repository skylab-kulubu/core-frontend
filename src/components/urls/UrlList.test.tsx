import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { UrlList } from '@/components/urls/UrlList';
import type { ShortUrl } from '@/lib/api/urls';

const row: ShortUrl = {
  id: 'u1',
  alias: 'hack',
  url: 'https://example.com',
  clickCount: 3,
  createdAt: '2026-09-19T08:00:00.000Z',
  updatedAt: '2026-09-19T08:00:00.000Z',
};

const formRow: ShortUrl = {
  ...row,
  id: 'u2',
  alias: 'basvuru',
  url: 'https://forms.example.com/f/1',
  formId: '11111111-1111-1111-1111-111111111111',
  label: 'Hackathon başvurusu',
};

const eventRow: ShortUrl = {
  ...row,
  id: 'u3',
  alias: 'gecekodu',
  url: 'https://forms.example.com/f/2',
  formId: '22222222-2222-2222-2222-222222222222',
  eventId: '33333333-3333-3333-3333-333333333333',
};

const handlers = {
  onEdit: jest.fn(),
  onQr: jest.fn(),
  onDelete: jest.fn(),
};

function rowOf(alias: string): HTMLElement {
  const item = screen.getByText(`https://skyl.app/${alias}`).closest('[data-slot="list-item"]');
  if (!(item instanceof HTMLElement)) throw new Error(`no row for ${alias}`);
  return item;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('UrlList', () => {
  it('hides Tıklamalar on Linklerim when the operator cannot moderate URLs', () => {
    render(
      <UrlList title="Linklerim" items={[row]} loading={false} failed={false} {...handlers} />,
    );
    expect(screen.getByRole('button', { name: 'QR' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tıklamalar' })).not.toBeInTheDocument();
    expect(screen.queryByText(/tıklama/)).not.toBeInTheDocument();
  });

  it('shows Tıklamalar when a moderator opens the hit list', () => {
    render(
      <UrlList
        title="Tümü"
        items={[row]}
        loading={false}
        failed={false}
        onHits={jest.fn()}
        {...handlers}
      />,
    );
    expect(screen.getByRole('button', { name: 'Tıklamalar' })).toBeInTheDocument();
  });

  it('shows each row’s source as a badge, and its label when it has one', () => {
    render(
      <UrlList
        title="Tümü"
        items={[row, formRow, eventRow]}
        loading={false}
        failed={false}
        {...handlers}
      />,
    );
    expect(within(rowOf('hack')).getByText('Kişisel')).toBeInTheDocument();
    expect(within(rowOf('basvuru')).getByText('Form')).toBeInTheDocument();
    expect(within(rowOf('gecekodu')).getByText('Etkinlik')).toBeInTheDocument();
    expect(within(rowOf('basvuru')).getByText(/Hackathon başvurusu/)).toBeInTheDocument();
  });

  it('keeps a personal row editable and deletable without a note', async () => {
    const clicker = userEvent.setup();
    render(
      <UrlList title="Linklerim" items={[row]} loading={false} failed={false} {...handlers} />,
    );
    expect(screen.getByRole('button', { name: 'Düzenle' })).toBeEnabled();
    expect(screen.queryByText(/yönetiliyor/)).not.toBeInTheDocument();
    await clicker.click(screen.getByRole('button', { name: 'Sil' }));
    expect(handlers.onDelete).toHaveBeenCalledWith(row);
  });

  it('makes a bound row read-only here and says where it is managed', () => {
    render(
      <UrlList
        title="Linklerim"
        items={[formRow, eventRow]}
        loading={false}
        failed={false}
        {...handlers}
      />,
    );
    const form = within(rowOf('basvuru'));
    const event = within(rowOf('gecekodu'));
    expect(form.getByRole('button', { name: 'Düzenle' })).toBeDisabled();
    expect(form.getByText('Forms’ta yönetiliyor')).toBeInTheDocument();
    expect(event.getByRole('button', { name: 'Düzenle' })).toBeDisabled();
    expect(event.getByText('Etkinlikte yönetiliyor')).toBeInTheDocument();
  });

  it('does not let a non-moderator disable a bound row', () => {
    render(
      <UrlList
        title="Linklerim"
        items={[formRow, eventRow]}
        loading={false}
        failed={false}
        {...handlers}
      />,
    );
    for (const alias of ['basvuru', 'gecekodu']) {
      expect(within(rowOf(alias)).getByRole('button', { name: 'Sil' })).toBeDisabled();
    }
  });

  it('lets a moderator disable a bound row after confirming the form keeps no link', async () => {
    const clicker = userEvent.setup();
    const confirm = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    render(
      <UrlList
        title="Tümü"
        items={[formRow, eventRow]}
        loading={false}
        failed={false}
        canDisableManaged
        {...handlers}
      />,
    );
    const remove = within(rowOf('basvuru')).getByRole('button', { name: 'Sil' });
    expect(remove).toBeEnabled();

    await clicker.click(remove);
    expect(confirm).toHaveBeenLastCalledWith(expect.stringMatching(/form linksiz kalır/));
    expect(handlers.onDelete).not.toHaveBeenCalled();

    await clicker.click(remove);
    expect(handlers.onDelete).toHaveBeenCalledWith(formRow);

    await clicker.click(within(rowOf('gecekodu')).getByRole('button', { name: 'Sil' }));
    expect(confirm).toHaveBeenLastCalledWith(expect.stringMatching(/etkinlik linksiz kalır/));
    expect(handlers.onDelete).toHaveBeenLastCalledWith(eventRow);
    confirm.mockRestore();
  });

  it('calls an empty filtered list a non-match', () => {
    render(
      <UrlList
        title="Linklerim"
        items={[]}
        loading={false}
        failed={false}
        filtered
        {...handlers}
      />,
    );
    expect(screen.getByText('Eşleşen kısa URL yok.')).toBeInTheDocument();
  });
});
