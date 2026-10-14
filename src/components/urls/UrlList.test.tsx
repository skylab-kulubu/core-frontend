import { render, screen } from '@testing-library/react';
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

const handlers = {
  onEdit: jest.fn(),
  onQr: jest.fn(),
  onDelete: jest.fn(),
};

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

  it('hides Düzenle and Sil on a row the caller may not change', () => {
    render(
      <UrlList
        title="Tümü"
        items={[row, { ...row, id: 'u2', alias: 'benim' }]}
        loading={false}
        failed={false}
        canChange={(r) => r.id === 'u2'}
        {...handlers}
      />,
    );
    expect(screen.getAllByRole('button', { name: 'QR' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Düzenle' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Sil' })).toHaveLength(1);
  });
});
