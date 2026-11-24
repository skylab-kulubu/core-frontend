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
    issue: jest.fn(),
    // An older core: no rule editor
    rule: jest.fn(() => Promise.reject(new Error('404'))),
    setRule: jest.fn(),
    // An older core: no attendance list
    attendance: jest.fn(() => {
      const { ProblemError: Problem } = jest.requireActual('@/lib/api/core');
      return Promise.reject(new Problem(404, 'Not Found'));
    }),
    rescan: jest.fn(),
    resendMail: jest.fn(),
    resendEventMails: jest.fn(),
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
      finalizeOpen
      tickets={[]}
      canIssue={canIssue}
      canBind={false}
      canRevoke={false}
      canReadIssued={false}
    />,
  );
}

describe('EventCertificatesPanel finalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.summary.mockResolvedValue({ ...summary(0), attendanceFinalizedAt: undefined });
    api.templates.mockResolvedValue([]);
    api.listIssued.mockResolvedValue([]);
    api.listBatches.mockResolvedValue([]);
  });

  function renderFinalize(finalizeOpen: boolean) {
    render(
      <EventCertificatesPanel
        eventId="e1"
        ownerTeam="GECEKODU"
        attendanceRule="once"
        finalizeOpen={finalizeOpen}
        tickets={[]}
        canIssue
        canBind={false}
        canRevoke={false}
        canReadIssued={false}
      />,
    );
  }

  it('offers Katılımı kapat when core would open finalization', async () => {
    renderFinalize(true);
    expect(await screen.findByRole('button', { name: /Katılımı kapat/ })).toBeEnabled();
  });

  it('keeps Katılımı kapat disabled until core would open finalization', async () => {
    renderFinalize(false);
    expect(await screen.findByRole('button', { name: /Katılımı kapat/ })).toBeDisabled();
  });
});

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
    expect(screen.getByText('Üretim: sırada · başarısız')).toBeInTheDocument();
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
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kayıt şu anki durumunda buna uygun değil',
    );
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
    const confirm = await screen.findByRole('alertdialog', { name: 'Katılım kapatılsın mı?' });
    expect(confirm).toHaveTextContent('7 kişiye sertifika üretilip e-postayla gönderilecek');
    expect(confirm).toHaveTextContent('Katılım yeniden açılmaz');
    expect(api.finalize).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Kapat ve üret' }));
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

/** Opens Ada's row menu and picks the item: revoke and reissue live there now. */
async function choose(user: ReturnType<typeof userEvent.setup>, item: string) {
  await user.click(await screen.findByRole('button', { name: 'Ada Lovelace: eylemler' }));
  await user.click(await screen.findByRole('menuitem', { name: item }));
}

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
        finalizeOpen
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
    await choose(user, 'İptal et');
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Ada Lovelace sertifikası iptal edilsin mi?',
    });
    expect(api.revoke).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Sertifikayı iptal et' }));
    await waitFor(() => expect(api.revoke).toHaveBeenCalledWith('SKY-0001'));
    // A finished write is a toast; the dialog closes
    expect(await screen.findByText('Ada Lovelace sertifikası iptal edildi')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('shows why a revoke failed', async () => {
    const user = userEvent.setup();
    api.listIssued.mockResolvedValue([issued]);
    api.revoke.mockRejectedValue(
      new ProblemError(403, 'Forbidden', { detail: 'missing role certificate:revoke' }),
    );
    renderIssued();
    await choose(user, 'İptal et');
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Sertifikayı iptal et' }));
    // Inside the dialog, which stays open, in Turkish
    expect(await within(confirm).findByRole('alert')).toHaveTextContent(
      'Bu işlem için yetkin yok.',
    );
    expect(confirm).not.toHaveTextContent(/Forbidden|missing role/);
  });

  it('drops an earlier error once a write goes through', async () => {
    const user = userEvent.setup();
    api.listIssued.mockResolvedValue([{ ...issued, revokedAt: '2026-10-11T10:00:00Z' }]);
    api.reissue
      .mockRejectedValueOnce(new ProblemError(403, 'Forbidden'))
      .mockResolvedValueOnce(undefined);
    renderIssued();
    await choose(user, 'Yeniden ver');
    expect(await screen.findByRole('alert')).toHaveTextContent('Bu işlem için yetkin yok.');

    await choose(user, 'Yeniden ver');
    expect(
      await screen.findByText('Ada Lovelace sertifikası yeniden üretim kuyruğuna alındı'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Bu işlem için yetkin yok.')).not.toBeInTheDocument();
  });

  it('says the certificate was issued again', async () => {
    const user = userEvent.setup();
    api.listIssued.mockResolvedValue([{ ...issued, revokedAt: '2026-10-11T10:00:00Z' }]);
    api.reissue.mockResolvedValue(undefined);
    renderIssued();
    await choose(user, 'Yeniden ver');
    expect(
      await screen.findByText('Ada Lovelace sertifikası yeniden üretim kuyruğuna alındı'),
    ).toBeInTheDocument();
  });

  it('finds a certificate by name or code and narrows to the revoked', async () => {
    const user = userEvent.setup();
    api.listIssued.mockResolvedValue([
      issued,
      {
        ...issued,
        id: 'c2',
        serial: 'SKY-0002',
        recipientName: 'Grace Hopper',
        revokedAt: '2026-10-11T10:00:00Z',
      },
    ]);
    renderIssued();
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^İptal/ }));
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
  });

  it('issues by hand from a searchable list of who has none yet', async () => {
    const user = userEvent.setup();
    api.listIssued.mockResolvedValue([issued]);
    api.issue.mockResolvedValue(undefined);
    render(
      <EventCertificatesPanel
        eventId="e1"
        ownerTeam="GECEKODU"
        attendanceRule="once"
        finalizeOpen
        tickets={
          [
            { id: 't1', guestFirstName: 'Ada', guestLastName: 'Lovelace' },
            {
              id: 't2',
              guestFirstName: 'Grace',
              guestLastName: 'Hopper',
              guestEmail: 'g@example.com',
            },
          ] as never
        }
        canIssue
        canBind={false}
        canRevoke
        canReadIssued
      />,
    );
    await user.click(await screen.findByRole('button', { name: 'Elle ver' }));
    const drawer = await screen.findByRole('dialog', { name: 'Elle sertifika ver' });
    expect(within(drawer).queryByText('Ada Lovelace')).not.toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: /Grace Hopper/ }));
    await waitFor(() => expect(api.issue).toHaveBeenCalledWith('e1', 't2'));
  });
});

describe('EventCertificatesPanel rule card', () => {
  const sessions = [
    { id: 's1', title: 'Açılış', required: true },
    { id: 's2', title: 'Atölye 1' },
    { id: 's3', title: 'Atölye 2' },
    { id: 's4', title: 'Networking', counted: false, sessionType: 'NETWORKING' },
  ].map((row) => ({
    dayId: 'd1',
    sessionType: 'WORKSHOP',
    cancelled: false,
    counted: true,
    required: false,
    ...row,
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    api.summary.mockResolvedValue({ ...summary(0), attendanceFinalizedAt: undefined });
    api.templates.mockResolvedValue([]);
    api.listIssued.mockResolvedValue([]);
    api.listBatches.mockResolvedValue([]);
  });

  function renderRule(ruleHref?: string) {
    render(
      <EventCertificatesPanel
        eventId="e1"
        ownerTeam="GECEKODU"
        attendanceRule="count"
        finalizeOpen
        tickets={[]}
        canIssue={false}
        canBind={false}
        canRevoke={false}
        canReadIssued={false}
        ruleHref={ruleHref}
        days={[{ id: 'd1', eventId: 'e1', name: '1. gün' }]}
      />,
    );
  }

  it('says the rule as N of M with the required and uncounted Sessions', async () => {
    api.rule.mockResolvedValueOnce({
      rule: 'count',
      minCount: null,
      effectiveMin: 3,
      countedTotal: 3,
      sessions,
    });
    renderRule();
    expect(
      await screen.findByText('3 oturumdan en az 3 (%100) · Zorunlu: Açılış · 1 oturum sayılmıyor'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kuralı düzenle' })).not.toBeInTheDocument();
  });

  it('opens the rule editor here for who may edit the event', async () => {
    const user = userEvent.setup();
    api.rule.mockResolvedValueOnce({
      rule: 'count',
      minCount: 2,
      effectiveMin: 2,
      countedTotal: 3,
      sessions,
    });
    renderRule('/events/e1/edit#sertifika');
    await user.click(await screen.findByRole('button', { name: 'Kuralı düzenle' }));
    const sheet = await screen.findByRole('dialog', { name: 'Sertifika kuralı' });
    expect(within(sheet).getByRole('spinbutton', { name: 'En az kaç oturum' })).toHaveValue(2);
    expect(within(sheet).getByText('(%67)')).toBeInTheDocument();
  });

  it('keeps the link to the edit page on an older core', async () => {
    renderRule('/events/e1/edit#sertifika');
    expect(await screen.findByRole('link', { name: 'Kuralı değiştir' })).toHaveAttribute(
      'href',
      '/events/e1/edit#sertifika',
    );
    expect(screen.getByText('Oturum sayısı')).toBeInTheDocument();
  });
});

describe('EventCertificatesPanel attendance list', () => {
  const year = new Date().getFullYear();
  const opening = { id: 's1', title: 'Açılış' };
  const row = (
    ticketId: string,
    name: string,
    status: string,
    attended: number,
    extra: Record<string, unknown> = {},
  ) => ({
    ticketId,
    name,
    ticketType: 'REGISTERED',
    attended,
    missingRequired: [],
    status,
    certificate: null,
    ...extra,
  });
  const people = {
    countedTotal: 8,
    effectiveMin: 6,
    rule: 'count',
    required: [opening],
    rows: [
      row('t1', 'Ayşe Yılmaz', 'eligible', 7),
      row('t2', 'Burak Demir', 'below', 4),
      row('t3', 'Can Aydın', 'issued', 8, {
        certificate: { serial: 'S1', issuedAt: `${year}-11-20T10:00:00Z` },
      }),
      row('t4', 'Deniz Kaya', 'below', 7, { missingRequired: [opening] }),
      row('t5', 'Ece Şahin', 'queued', 6),
    ],
  };
  const open = {
    ...summary(0),
    attendanceFinalizedAt: undefined,
    eligibleCount: 1,
    countedTotal: 8,
    effectiveMin: 6,
    belowCount: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    api.summary.mockResolvedValue(open);
    api.templates.mockResolvedValue([]);
    api.listIssued.mockResolvedValue([]);
    api.listBatches.mockResolvedValue([]);
    api.attendance.mockResolvedValue(people);
  });

  function renderList(props: { finalizeOpen?: boolean; lastSessionEnded?: boolean } = {}) {
    render(
      <EventCertificatesPanel
        eventId="e1"
        ownerTeam="GECEKODU"
        attendanceRule="count"
        finalizeOpen={props.finalizeOpen ?? true}
        lastSessionEnded={props.lastSessionEnded}
        tickets={[]}
        canIssue
        canBind={false}
        canRevoke={false}
        canReadIssued={false}
      />,
    );
  }

  const list = () => screen.findByRole('region', { name: 'Katılımcılar' });

  it('lists who attended how much, what required Session they missed and where they stand', async () => {
    renderList();
    const section = await list();
    expect(within(section).getAllByText('7/8').length).toBeGreaterThan(0);
    expect(within(section).getAllByText('Açılış').length).toBeGreaterThan(0);
    expect(within(section).getByText('Sırada')).toBeInTheDocument();
    // The person picker is gone: giving by hand is in the row menu
    expect(screen.queryByRole('button', { name: 'Elle ver' })).not.toBeInTheDocument();
  });

  it('narrows to a view and searches by name', async () => {
    const user = userEvent.setup();
    renderList();
    const section = await list();
    await user.click(within(section).getByRole('button', { name: /^Eşik altı/ }));
    expect(within(section).queryByText('Ayşe Yılmaz')).not.toBeInTheDocument();
    expect(within(section).getByText('Burak Demir')).toBeInTheDocument();
    expect(within(section).getByText('Deniz Kaya')).toBeInTheDocument();
    await user.type(within(section).getByRole('searchbox', { name: 'Katılımcı ara' }), 'deniz');
    expect(within(section).queryByText('Burak Demir')).not.toBeInTheDocument();
    expect(within(section).getByText('Deniz Kaya')).toBeInTheDocument();
  });

  it('asks why below the threshold and sends nothing without it', async () => {
    const user = userEvent.setup();
    api.issue.mockResolvedValue(batch('b1', 0, `${year}-11-24T10:00:00Z`));
    renderList();
    await list();
    await user.click(screen.getByRole('button', { name: 'Burak Demir: eylemler' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Elle ver' }));
    const dialog = await screen.findByRole('dialog', { name: 'Elle sertifika ver' });
    await user.click(within(dialog).getByRole('button', { name: 'Ver' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Gerekçe yaz.');
    expect(api.issue).not.toHaveBeenCalled();
    await user.type(within(dialog).getByRole('textbox', { name: 'Gerekçe' }), 'Raporlu');
    expect(within(dialog).getByText('7/500')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Ver' }));
    await waitFor(() => expect(api.issue).toHaveBeenCalledWith('e1', 't2', 'Raporlu'));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Elle sertifika ver' })).not.toBeInTheDocument(),
    );
  });

  it('gives an eligible row without asking why', async () => {
    const user = userEvent.setup();
    api.issue.mockResolvedValue(batch('b1', 0, `${year}-11-24T10:00:00Z`));
    renderList();
    await list();
    await user.click(screen.getByRole('button', { name: 'Ayşe Yılmaz: eylemler' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Elle ver' }));
    const dialog = await screen.findByRole('dialog', { name: 'Elle sertifika ver' });
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Ver' }));
    await waitFor(() => expect(api.issue).toHaveBeenCalledWith('e1', 't1', undefined));
  });

  it("shows core's justification refusal under the field", async () => {
    const user = userEvent.setup();
    api.issue.mockRejectedValue(
      new ProblemError(400, 'Bad Request', { code: 'justification_too_long' }),
    );
    renderList();
    await list();
    await user.click(screen.getByRole('button', { name: 'Deniz Kaya: eylemler' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Elle ver' }));
    const dialog = await screen.findByRole('dialog', { name: 'Elle sertifika ver' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Gerekçe' }), 'Uzun');
    await user.click(within(dialog).getByRole('button', { name: 'Ver' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Gerekçe en çok 500 karakter olabilir.',
    );
  });

  it('counts as eligible and closes for only who has no certificate yet', async () => {
    const user = userEvent.setup();
    // Core counts Can's issued certificate in eligibleCount; closing queues Ayşe and Ece
    api.summary.mockResolvedValue({ ...open, eligibleCount: 3 });
    renderList();
    await list();
    const [card] = screen.getAllByRole('button', { name: /^Uygun/ });
    expect(card).toHaveTextContent('2');
    expect(card).not.toHaveTextContent('3');
    await user.click(screen.getByRole('button', { name: 'Katılımı kapat ve üret' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Katılım kapatılsın mı?' });
    expect(confirm).toHaveTextContent('2 kişiye sertifika üretilip e-postayla gönderilecek');
  });

  it('counts the below threshold beside the eligible, a filter of the list', async () => {
    const user = userEvent.setup();
    renderList();
    const section = await list();
    // The summary card comes first, the view chip under it
    const [card] = screen.getAllByRole('button', { name: /Eşik altı/ });
    expect(card).toHaveTextContent('2');
    await user.click(card);
    expect(within(section).queryByText('Ayşe Yılmaz')).not.toBeInTheDocument();
    expect(within(section).getByText('Burak Demir')).toBeInTheDocument();
  });

  describe('closing line', () => {
    it('says when attendance closes by itself, with Şimdi kapat beside it', async () => {
      api.summary.mockResolvedValue({ ...open, autoFinalizeAt: `${year}-11-24T16:00:00Z` });
      renderList();
      expect(
        await screen.findByText("Katılım 24 Kasım 19:00'da kendiliğinden kapanacak"),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Şimdi kapat ve üret' })).toBeEnabled();
    });

    it('shows the button alone without a time', async () => {
      renderList();
      expect(await screen.findByRole('button', { name: 'Katılımı kapat ve üret' })).toBeEnabled();
      expect(screen.queryByText(/kendiliğinden kapanacak/)).not.toBeInTheDocument();
    });

    it.each([
      ['auto', 'kendiliğinden'],
      ['manual', 'elle'],
    ])('says it closed (%s) and offers the rescan', async (source, word) => {
      api.summary.mockResolvedValue({
        ...open,
        attendanceFinalizedAt: `${year}-11-24T16:01:00Z`,
        finalizedSource: source,
      });
      renderList();
      expect(
        await screen.findByText(`Katılım kapandı · ${word} · 24 Kasım 19:01`),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /kapat ve üret/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Uygunları yeniden tara' })).toBeEnabled();
    });

    it('opens finalization once the last Session is over, before the Event ends', async () => {
      renderList({ finalizeOpen: false, lastSessionEnded: true });
      expect(await screen.findByRole('button', { name: 'Katılımı kapat ve üret' })).toBeEnabled();
    });

    it('keeps it closed on an older core until the Event ends', async () => {
      api.attendance.mockRejectedValue(new ProblemError(404, 'Not Found'));
      renderList({ finalizeOpen: false, lastSessionEnded: true });
      expect(await screen.findByRole('button', { name: 'Katılımı kapat ve üret' })).toBeDisabled();
      // and the person picker stays
      expect(screen.getByRole('button', { name: 'Elle ver' })).toBeInTheDocument();
    });
  });

  describe('rescan', () => {
    const closed = {
      ...open,
      attendanceFinalizedAt: `${year}-11-24T16:01:00Z`,
      finalizedSource: 'auto',
    };

    it('says how many get a certificate, counted from the list, and queues them', async () => {
      const user = userEvent.setup();
      api.summary.mockResolvedValue(closed);
      api.rescan.mockResolvedValue({ queued: 1 });
      renderList();
      await user.click(await screen.findByRole('button', { name: 'Uygunları yeniden tara' }));
      const confirm = await screen.findByRole('alertdialog', {
        name: 'Uygunlar yeniden taransın mı?',
      });
      // Ayşe alone: Can has one, Ece is queued, Burak and Deniz are below
      expect(confirm).toHaveTextContent('1 kişiye sertifika üretilip e-postayla gönderilecek');
      await user.click(within(confirm).getByRole('button', { name: 'Yeniden tara' }));
      await waitFor(() => expect(api.rescan).toHaveBeenCalledWith('e1'));
      expect(await screen.findByText('1 sertifika üretim kuyruğuna alındı.')).toBeInTheDocument();
    });

    it('is off when no one is left', async () => {
      api.summary.mockResolvedValue(closed);
      api.attendance.mockResolvedValue({ ...people, rows: people.rows.slice(1) });
      renderList();
      expect(await screen.findByRole('button', { name: 'Uygunları yeniden tara' })).toBeDisabled();
    });
  });

  it('pages the list 25 at a time', async () => {
    const user = userEvent.setup();
    api.attendance.mockResolvedValue({
      ...people,
      rows: Array.from({ length: 30 }, (_, i) =>
        row(`t${i}`, `Kişi ${String(i + 1).padStart(2, '0')}`, 'below', 2),
      ),
    });
    renderList();
    const section = await list();
    expect(within(section).getAllByText('1–25 / 30').length).toBeGreaterThan(0);
    expect(within(section).queryByText('Kişi 26')).not.toBeInTheDocument();
    await user.click(within(section).getAllByRole('button', { name: /^(Sayfa|Page) 2$/ })[0]);
    expect(within(section).getByText('Kişi 26')).toBeInTheDocument();
  });
});

describe('EventCertificatesPanel certificate mail', () => {
  const certificate = (serial: string, name: string, mail?: Record<string, unknown>) => ({
    id: serial,
    eventId: 'e1',
    ticketId: `t-${serial}`,
    serial,
    recipientName: name,
    recipientEmail: 'x@example.com',
    eventName: 'GeceKodu',
    ownerTeam: 'GECEKODU',
    verifyUrl: `https://skyl.app/c/${serial}`,
    templateSource: 'clubDefault',
    issuedAt: '2026-11-24T17:00:00Z',
    mail,
  });
  const withMail = { ...summary(0), issuedCount: 3, mailQueuedCount: 0, mailFailedCount: 1 };

  function renderMail(canIssue = true) {
    render(
      <EventCertificatesPanel
        eventId="e1"
        ownerTeam="GECEKODU"
        attendanceRule="once"
        finalizeOpen
        tickets={[]}
        canIssue={canIssue}
        canBind={false}
        canRevoke={false}
        canReadIssued
      />,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    api.summary.mockResolvedValue(withMail);
    api.templates.mockResolvedValue([]);
    api.listBatches.mockResolvedValue([]);
    api.listIssued.mockResolvedValue([
      certificate('S1', 'Ada Lovelace', {
        status: 'failed',
        attempts: 10,
        errorCode: 'skymail_unreachable',
        updatedAt: '2026-11-24T21:00:00Z',
      }),
      certificate('S2', 'Grace Hopper', {
        status: 'sent',
        attempts: 1,
        sentAt: '2026-11-24T17:01:00Z',
        updatedAt: '2026-11-24T17:01:00Z',
      }),
      certificate('S3', 'Alan Turing'),
    ]);
  });

  it("shows each certificate's mail and counts the failed", async () => {
    renderMail();
    const list = await screen.findByRole('region', { name: 'Verilen sertifikalar' });
    expect(within(list).getAllByText('Gönderilemedi').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('Gönderildi').length).toBeGreaterThan(0);
    // Why, in words, never the code
    expect(within(list).getAllByText("SkyMail'e ulaşılamadı").length).toBeGreaterThan(0);
    expect(screen.queryByText(/skymail_/)).not.toBeInTheDocument();
    expect(screen.getByText('1 gönderilemedi')).toBeInTheDocument();
  });

  it('resends the failed after confirming, and says what was queued', async () => {
    const user = userEvent.setup();
    api.resendEventMails.mockResolvedValue({ queued: 1, alreadyQueued: 0 });
    renderMail();
    await user.click(await screen.findByRole('button', { name: 'Diğer sertifika eylemleri' }));
    await user.click(
      await screen.findByRole('menuitem', {
        name: 'Postayı gönderilemeyenlere yeniden gönder (1)',
      }),
    );
    const confirm = await screen.findByRole('alertdialog', {
      name: '1 kişiye sertifika postası yeniden gönderilsin mi?',
    });
    expect(api.resendEventMails).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Yeniden gönder' }));
    await waitFor(() => expect(api.resendEventMails).toHaveBeenCalledWith('e1', 'failed'));
    expect(await screen.findByText('1 posta sıraya alındı.')).toBeInTheDocument();
  });

  it('resends everyone on its own command', async () => {
    const user = userEvent.setup();
    api.resendEventMails.mockResolvedValue({ queued: 2, alreadyQueued: 1 });
    renderMail();
    await user.click(await screen.findByRole('button', { name: 'Diğer sertifika eylemleri' }));
    await user.click(
      await screen.findByRole('menuitem', { name: 'Postayı herkese yeniden gönder' }),
    );
    const confirm = await screen.findByRole('alertdialog', {
      name: '3 kişiye sertifika postası yeniden gönderilsin mi?',
    });
    await user.click(within(confirm).getByRole('button', { name: 'Yeniden gönder' }));
    await waitFor(() => expect(api.resendEventMails).toHaveBeenCalledWith('e1', 'all'));
    expect(
      await screen.findByText('2 posta sıraya alındı. 1 kişinin postası zaten sırada.'),
    ).toBeInTheDocument();
  });

  it("resends one person's mail from the row", async () => {
    const user = userEvent.setup();
    api.resendMail.mockResolvedValue({ queued: 1, alreadyQueued: 0 });
    renderMail();
    await choose(user, 'Postayı yeniden gönder');
    await waitFor(() => expect(api.resendMail).toHaveBeenCalledWith('S1'));
    expect(await screen.findByText('Ada Lovelace için posta sıraya alındı')).toBeInTheDocument();
  });

  it('offers no resend on an older core, nor to who may not issue', async () => {
    api.summary.mockResolvedValue({ ...summary(0), issuedCount: 3 });
    renderMail();
    await screen.findByRole('region', { name: 'Verilen sertifikalar' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Diğer sertifika eylemleri' }));
    expect(screen.queryByRole('menuitem', { name: /yeniden gönder/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Posta')).not.toBeInTheDocument();
  });

  it('says when everyone was sent to too recently', async () => {
    const user = userEvent.setup();
    const { ProblemError: Problem } = jest.requireActual('@/lib/api/core');
    api.resendEventMails.mockRejectedValue(
      new Problem(429, 'Too Many Requests', { code: 'resend_too_soon' }),
    );
    renderMail();
    await user.click(await screen.findByRole('button', { name: 'Diğer sertifika eylemleri' }));
    await user.click(
      await screen.findByRole('menuitem', { name: 'Postayı herkese yeniden gönder' }),
    );
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Yeniden gönder' }));
    expect(
      await screen.findByText('Herkese yeniden gönderme 10 dakikada bir yapılabilir.'),
    ).toBeInTheDocument();
  });
});
