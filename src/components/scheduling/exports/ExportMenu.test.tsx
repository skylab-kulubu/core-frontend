import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProblemError } from '@/lib/api/core';
import { CertificateListDownload, ExportMenu } from './ExportMenu';

const mockDownload = jest.fn();
const mockSuccess = jest.fn();
jest.mock('@/lib/api/exports', () => ({
  exportsApi: { download: (...args: unknown[]) => mockDownload(...args) },
}));
jest.mock('@/lib/ui/use-notify', () => ({ useNotify: () => ({ success: mockSuccess }) }));

beforeEach(() => {
  mockDownload.mockReset().mockResolvedValue('file.xlsx');
  mockSuccess.mockReset();
  window.localStorage.clear();
});

async function openMenu() {
  await userEvent.click(screen.getByRole('button', { name: /İndir/ }));
  await screen.findByRole('menuitem', { name: /Katılımcılar/ });
}

describe('ExportMenu', () => {
  it('offers the reports and downloads one as Excel by default', async () => {
    render(
      <ExportMenu
        eventId="e1"
        eventName="ARTLAB"
        sessions={[{ id: 's1', label: 'Açılış · 27.11 10:00' }]}
        certificates
      />,
    );
    await openMenu();
    expect(screen.getByRole('menuitem', { name: /Katılım matrisi/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Alana giriş/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Sertifikalar/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Ekrandakiler/ })).toBeNull();
    await userEvent.click(screen.getByRole('menuitem', { name: /Katılımcılar/ }));
    await waitFor(() =>
      expect(mockDownload).toHaveBeenCalledWith('e1', 'ARTLAB', {
        report: 'attendees',
        format: 'xlsx',
      }),
    );
    expect(mockSuccess).toHaveBeenCalledWith('İndirildi', 'file.xlsx');
  });

  it('downloads the rows the list shows, as CSV once picked, and remembers the format', async () => {
    render(<ExportMenu eventId="e1" eventName="ARTLAB" shownTicketIds={['t2', 't1']} filtered />);
    await openMenu();
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'CSV' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Ekrandakiler (2)' }));
    await waitFor(() =>
      expect(mockDownload).toHaveBeenCalledWith('e1', 'ARTLAB', {
        report: 'attendees',
        format: 'csv',
        ticketIds: ['t2', 't1'],
      }),
    );
    expect(window.localStorage.getItem('skylab.admin.export.format')).toBe('csv');
  });

  it('leaves the certificate report out without the right, and says why a download failed', async () => {
    mockDownload.mockRejectedValueOnce(new ProblemError(403, 'Forbidden'));
    render(<ExportMenu eventId="e1" eventName="ARTLAB" />);
    await openMenu();
    expect(screen.queryByRole('menuitem', { name: /Sertifikalar/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Oturum katılımı/ })).toBeNull();
    await userEvent.click(screen.getByRole('menuitem', { name: /Alana giriş/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Bu listeyi indirmeye yetkin yok.');
    expect(mockSuccess).not.toHaveBeenCalled();
  });
});

describe('CertificateListDownload', () => {
  it('downloads the certificate report in the format picked last', async () => {
    window.localStorage.setItem('skylab.admin.export.format', 'csv');
    render(<CertificateListDownload eventId="e1" eventName="ARTLAB" />);
    await userEvent.click(screen.getByRole('button', { name: 'Listeyi indir' }));
    await waitFor(() =>
      expect(mockDownload).toHaveBeenCalledWith('e1', 'ARTLAB', {
        report: 'certificates',
        format: 'csv',
      }),
    );
  });
});
