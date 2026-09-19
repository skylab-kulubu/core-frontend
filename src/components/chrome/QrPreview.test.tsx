import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QrPreview } from '@/components/chrome/QrPreview';
import { downloadBlob } from '@/lib/api/core';
import { shortQrFileName, shortQrPath, shortQrUrl } from '@/lib/api/urls';

jest.mock('@/lib/api/core', () => {
  const actual = jest.requireActual('@/lib/api/core') as typeof import('@/lib/api/core');
  return { ...actual, downloadBlob: jest.fn() };
});

describe('QrPreview', () => {
  it('renders a logo QR and downloads the PNG through an authenticated blob', async () => {
    const user = userEvent.setup();
    const imageUrl = shortQrUrl('hack');
    const downloadPath = shortQrPath('hack', { size: 1024 });
    render(
      <QrPreview
        imageUrl={imageUrl}
        downloadPath={downloadPath}
        label="QR hack"
        fileName={shortQrFileName('hack')}
      />,
    );
    expect(imageUrl).toContain('logo=1');
    expect(screen.getByLabelText('QR hack')).toHaveAttribute('data', imageUrl);
    expect(screen.queryByRole('link', { name: 'İndir' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'İndir' }));
    expect(downloadBlob).toHaveBeenCalledWith(downloadPath, 'skylapp-hack.png');
    expect(downloadPath).toContain('logo=1');
    expect(downloadPath).toContain('size=1024');
  });
});
