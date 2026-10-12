import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {
  EventCertificatesPanel,
  failedBatches,
} from '@/components/certificates/EventCertificatesPanel';
import { certificatesApi, type CertificateBatch } from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';

jest.mock('@/lib/api/certificates', () => ({
  certificatesApi: {
    summary: jest.fn(),
    templates: jest.fn(),
    listIssued: jest.fn(),
    listBatches: jest.fn(),
    retryBatch: jest.fn(),
  },
}));

const api = certificatesApi as unknown as Record<string, jest.Mock>;

function batch(id: string, failedCount: number, createdAt: string): CertificateBatch {
  return {
    id,
    eventId: 'e1',
    templateVersionId: 'v1',
    templateSource: 'clubDefault',
    reason: 'finalization',
    status: failedCount ? 'partial' : 'completed',
    totalCount: 10,
    queuedCount: 0,
    issuedCount: 10 - failedCount,
    failedCount,
    createdAt,
  };
}

function summary(failedCount: number) {
  return {
    eventId: 'e1',
    attendanceFinalizedAt: '2026-10-10T10:00:00Z',
    eligibleCount: 10,
    issuedCount: 10 - failedCount,
    queuedCount: 0,
    failedCount,
    revokedCount: 0,
    resolution: {
      source: 'clubDefault',
      template: { id: 't1', name: 'SKY LAB' },
      version: { version: 1 },
    },
  };
}

function renderPanel(canIssue = true) {
  render(
    <EventCertificatesPanel
      eventId="e1"
      ownerTeam="GECEKODU"
      attendanceRule="once"
      eventActive={false}
      tickets={[]}
      canIssue={canIssue}
      canBind={false}
      canRevoke={false}
      canReadIssued={false}
    />,
  );
}

describe('EventCertificatesPanel failed batches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.templates.mockResolvedValue([]);
    api.listIssued.mockResolvedValue([]);
  });

  it('lists only batches with failures, newest first', () => {
    const rows = failedBatches([
      batch('old', 1, '2026-10-01T10:00:00Z'),
      batch('ok', 0, '2026-10-03T10:00:00Z'),
      batch('new', 2, '2026-10-02T10:00:00Z'),
    ]);
    expect(rows.map((row) => row.id)).toEqual(['new', 'old']);
  });

  it('retries a failed batch once, after confirming, even on a double click', async () => {
    const user = userEvent.setup();
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    api.summary.mockResolvedValueOnce(summary(2)).mockResolvedValue(summary(0));
    api.listBatches.mockResolvedValue([
      batch('b-ok', 0, '2026-10-02T10:00:00Z'),
      batch('b-failed', 2, '2026-10-01T10:00:00Z'),
    ]);
    let finish: (value: CertificateBatch) => void = () => undefined;
    api.retryBatch.mockImplementation(
      () => new Promise<CertificateBatch>((resolve) => (finish = resolve)),
    );
    renderPanel();

    const retry = await screen.findByRole('button', { name: 'Yeniden dene' });
    expect(screen.getAllByRole('button', { name: 'Yeniden dene' })).toHaveLength(1);
    await user.dblClick(retry);

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(api.retryBatch).toHaveBeenCalledTimes(1);
    expect(api.retryBatch).toHaveBeenCalledWith('b-failed');
    expect(retry).toBeDisabled();

    finish(batch('b-failed', 0, '2026-10-01T10:00:00Z'));
    expect(await screen.findByRole('status')).toHaveTextContent(
      '2 başarısız sertifika yeniden kuyruğa alındı.',
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Yeniden dene' })).not.toBeInTheDocument(),
    );
    confirm.mockRestore();
  });

  it('does not retry when the confirmation is declined', async () => {
    const user = userEvent.setup();
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    api.summary.mockResolvedValue(summary(1));
    api.listBatches.mockResolvedValue([batch('b1', 1, '2026-10-01T10:00:00Z')]);
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Yeniden dene' }));
    expect(api.retryBatch).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('keeps the tab when the failed batches cannot be read', async () => {
    api.summary.mockResolvedValue(summary(2));
    api.listBatches.mockRejectedValue(new Error('down'));
    renderPanel();
    expect(await screen.findByText('SKY LAB')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Başarısız üretim işleri okunamadı');
    expect(screen.getByText('Başarısız')).toBeInTheDocument();
  });

  it('shows why a retry failed', async () => {
    const user = userEvent.setup();
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    api.summary.mockResolvedValue(summary(1));
    api.listBatches.mockResolvedValue([batch('b1', 1, '2026-10-01T10:00:00Z')]);
    api.retryBatch.mockRejectedValue(new ProblemError(409, 'Conflict'));
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Yeniden dene' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Conflict');
    expect(screen.getByRole('button', { name: 'Yeniden dene' })).toBeEnabled();
    confirm.mockRestore();
  });

  it.each([
    ['nothing failed', 0, true],
    ['the reader cannot issue', 3, false],
  ])('reads no batches when %s', async (_case, failedCount, canIssue) => {
    api.summary.mockResolvedValue(summary(failedCount));
    renderPanel(canIssue);
    expect(await screen.findByText('SKY LAB')).toBeInTheDocument();
    expect(api.listBatches).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Yeniden dene' })).not.toBeInTheDocument();
  });
});
