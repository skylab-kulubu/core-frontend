import { render, screen, waitFor, within } from '@testing-library/react';
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
    finalize: jest.fn(),
    revoke: jest.fn(),
    reissue: jest.fn(),
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
    const confirm = await screen.findByRole('alertdialog', {
      name: '2 başarısız sertifika yeniden üretilsin mi?',
    });
    expect(api.retryBatch).not.toHaveBeenCalled();
    await user.dblClick(within(confirm).getByRole('button', { name: 'Yeniden dene' }));

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
  });

  it('does not retry when the confirmation is declined', async () => {
    const user = userEvent.setup();
    api.summary.mockResolvedValue(summary(1));
    api.listBatches.mockResolvedValue([batch('b1', 1, '2026-10-01T10:00:00Z')]);
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Yeniden dene' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Vazgeç' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(api.retryBatch).not.toHaveBeenCalled();
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
    api.summary.mockResolvedValue(summary(1));
    api.listBatches.mockResolvedValue([batch('b1', 1, '2026-10-01T10:00:00Z')]);
    api.retryBatch.mockRejectedValue(new ProblemError(409, 'Conflict'));
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Yeniden dene' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yeniden dene' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Conflict');
    expect(screen.getByRole('button', { name: 'Yeniden dene' })).toBeEnabled();
  });

  it('says how many people get a certificate and an e-mail before closing attendance', async () => {
    const user = userEvent.setup();
    api.summary.mockResolvedValue({
      ...summary(0),
      attendanceFinalizedAt: undefined,
      eligibleCount: 7,
    });
    api.listBatches.mockResolvedValue([]);
    api.finalize.mockResolvedValue(batch('b-new', 0, '2026-10-12T10:00:00Z'));
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Katılımı kapat ve üret' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Katılım kapatılıp sertifikalar üretilsin mi?',
    });
    expect(confirm).toHaveTextContent('7 kişiye sertifika üretilir ve e-postayla gönderilir');
    expect(confirm).toHaveTextContent('Geri alınamaz');
    expect(api.finalize).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Katılımı kapat ve üret' }));
    await waitFor(() => expect(api.finalize).toHaveBeenCalledWith('e1'));
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

describe('EventCertificatesPanel issued certificates', () => {
  const issued = {
    id: 'c1',
    eventId: 'e1',
    ticketId: 't1',
    serial: 'SKY-0001',
    recipientName: 'Ada Lovelace',
    recipientEmail: 'ada@example.com',
    eventName: 'GeceKodu',
    ownerTeam: 'GECEKODU',
    verifyUrl: 'https://example.com/v/SKY-0001',
    templateSource: 'clubDefault',
    issuedAt: '2026-10-10T10:00:00Z',
  };

  function renderIssued() {
    render(
      <EventCertificatesPanel
        eventId="e1"
        ownerTeam="GECEKODU"
        attendanceRule="once"
        eventActive={false}
        tickets={[]}
        canIssue
        canBind={false}
        canRevoke
        canReadIssued
      />,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    api.summary.mockResolvedValue(summary(0));
    api.templates.mockResolvedValue([]);
    api.listBatches.mockResolvedValue([]);
  });

  it('says the certificate was revoked', async () => {
    const user = userEvent.setup();
    api.listIssued.mockResolvedValue([issued]);
    api.revoke.mockResolvedValue(undefined);
    renderIssued();
    await user.click(await screen.findByRole('button', { name: 'İptal et' }));
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Ada Lovelace sertifikası iptal edilsin mi?',
    });
    expect(api.revoke).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Sertifikayı iptal et' }));
    await waitFor(() => expect(api.revoke).toHaveBeenCalledWith('SKY-0001'));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Ada Lovelace sertifikası iptal edildi.',
    );
  });

  it('shows why a revoke failed', async () => {
    const user = userEvent.setup();
    api.listIssued.mockResolvedValue([issued]);
    api.revoke.mockRejectedValue(new ProblemError(403, 'İptal yetkin yok'));
    renderIssued();
    await user.click(await screen.findByRole('button', { name: 'İptal et' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Sertifikayı iptal et',
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('İptal yetkin yok');
  });

  it('says the certificate was issued again', async () => {
    const user = userEvent.setup();
    api.listIssued.mockResolvedValue([{ ...issued, revokedAt: '2026-10-11T10:00:00Z' }]);
    api.reissue.mockResolvedValue(undefined);
    renderIssued();
    await user.click(await screen.findByRole('button', { name: 'Yeniden ver' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Ada Lovelace sertifikası yeniden üretim kuyruğuna alındı.',
    );
  });
});
