import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ProblemError } from '@/lib/api/core';
import { formRespondentsApi, type FormRespondent } from '@/lib/api/form-respondents';
import { useConfirm } from '@/lib/ui/use-confirm';
import {
  RESPONDENT_JOB_POLL_MS,
  RespondentList,
  formsResponseHref,
  useRespondents,
  type RespondentView,
} from './RespondentList';

jest.mock('@/lib/api/form-respondents', () => ({
  formRespondentsApi: {
    list: jest.fn(),
    previewTickets: jest.fn(),
    sendTickets: jest.fn(),
    ticketJob: jest.fn(),
  },
}));

const api = formRespondentsApi as unknown as Record<string, jest.Mock>;
const FORM = '22222222-2222-4222-8222-222222222222';

const row = (id: string, first: string, extra: Partial<FormRespondent> = {}): FormRespondent => ({
  id,
  formId: FORM,
  responseId: `resp-${id}`,
  userId: null,
  firstName: first,
  lastName: 'Demir',
  email: `${id}@example.com`,
  submittedAt: '2026-11-20T10:00:00Z',
  formsStatus: 'accepted',
  source: 'collect',
  ...extra,
});

function page(items: FormRespondent[], extra = {}) {
  return { items, nextCursor: null, total: items.length, collecting: false, ...extra };
}

function Harness({
  view,
  onSent = jest.fn(),
  onRefresh,
  canSend = true,
  query = '',
}: {
  view: RespondentView;
  onSent?: (line: string) => void;
  onRefresh?: () => void;
  canSend?: boolean;
  query?: string;
}) {
  const respondents = useRespondents('e1', true);
  const [confirm, dialog] = useConfirm();
  return (
    <>
      <p>{respondents.available ? `hazır:${respondents.accepted.total}` : 'yok'}</p>
      <RespondentList
        eventId="e1"
        view={view}
        query={query}
        respondents={respondents}
        confirm={confirm}
        onSent={onSent}
        onRefresh={onRefresh}
        canSend={canSend}
      />
      {dialog}
    </>
  );
}

describe('RespondentList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.list!.mockImplementation((_event: string, query: { formsStatus: string }) =>
      Promise.resolve(
        query.formsStatus === 'accepted'
          ? page([row('r1', 'Ada'), row('r2', 'Bora')])
          : page([row('r3', 'Cem', { formsStatus: 'pending' })]),
      ),
    );
    api.previewTickets!.mockResolvedValue({
      tickets: 1,
      waitlisted: 1,
      full: 0,
      alreadyTicketed: 0,
      pendingSkipped: 0,
    });
  });

  it('lists the accepted ones with both badges and sends one after the preview', async () => {
    const user = userEvent.setup();
    const onSent = jest.fn();
    api.sendTickets!.mockResolvedValue({ recorded: 1, waitlisted: 0, full: 0, skipped: 0 });
    render(<Harness view="unticketed" onSent={onSent} />);
    expect(await screen.findByText('Ada Demir')).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith('e1', { formsStatus: 'accepted', limit: 200, q: '' });
    expect(screen.getAllByText('Kabul edildi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gönderilmedi').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Ada Demir: bilet gönder' }));
    expect(api.previewTickets).toHaveBeenCalledWith('e1', { ids: ['r1'] });
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Bilet gönderilsin mi?')).toBeInTheDocument();
    expect(within(dialog).getByText('1 bilet, 1 bekleme listesi.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Biletleri gönder' }));
    expect(api.sendTickets).toHaveBeenCalledWith('e1', { ids: ['r1'] });
    await waitFor(() => expect(onSent).toHaveBeenCalledWith('Gönderildi: 1 bilet'));
  });

  it('sends the chosen ones together', async () => {
    const user = userEvent.setup();
    api.sendTickets!.mockResolvedValue({ recorded: 2, waitlisted: 0, full: 0, skipped: 0 });
    render(<Harness view="unticketed" />);
    await user.click(await screen.findByRole('checkbox', { name: 'Ada Demir seç' }));
    await user.click(screen.getByRole('checkbox', { name: 'Bora Demir seç' }));
    await user.click(screen.getByRole('button', { name: 'Bilet gönder' }));
    expect(api.previewTickets).toHaveBeenCalledWith('e1', { ids: ['r1', 'r2'] });
    expect(await screen.findByText('2 kişiye bilet gönderilsin mi?')).toBeInTheDocument();
  });

  it('sends everyone as a job and follows it to the end', async () => {
    const user = userEvent.setup({ advanceTimers: (ms) => jest.advanceTimersByTime(ms) });
    jest.useFakeTimers();
    try {
      const onSent = jest.fn();
      api.sendTickets!.mockResolvedValue({ jobId: 'job-9' });
      api.ticketJob!.mockResolvedValue({
        jobId: 'job-9',
        state: 'done',
        recorded: 2,
        waitlisted: 0,
        full: 1,
        skipped: 0,
      });
      render(<Harness view="unticketed" onSent={onSent} />);
      await user.click(await screen.findByRole('button', { name: 'Hepsine gönder' }));
      expect(api.previewTickets).toHaveBeenCalledWith('e1', { all: true });
      const dialog = await screen.findByRole('alertdialog');
      expect(
        within(dialog).getByText('Bilet gönderilmeyen herkese bilet gönderilsin mi?'),
      ).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Biletleri gönder' }));
      expect(await screen.findByText('Biletler gönderiliyor: 0 bilet.')).toBeInTheDocument();
      await act(async () => {
        jest.advanceTimersByTime(RESPONDENT_JOB_POLL_MS);
      });
      expect(await screen.findByText('Gönderildi: 2 bilet, 1 yer yok.')).toBeInTheDocument();
      expect(onSent).toHaveBeenCalledWith('Gönderildi: 2 bilet, 1 yer yok');
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps a pending one’s button off and links to its answer in Forms', async () => {
    render(<Harness view="formsPending" />);
    expect(await screen.findByText('Cem Demir')).toBeInTheDocument();
    const off = screen.getByRole('button', { name: 'Cem Demir: bilet gönder' });
    expect(off).toBeDisabled();
    expect(off).toHaveAccessibleDescription('Forms’ta onaylanınca gönderilir');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hepsine gönder' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'Cem Demir: yanıtı Forms’ta aç (yeni sekmede açılır)',
      }),
    ).toHaveAttribute('href', formsResponseHref({ formId: FORM, responseId: 'resp-r3' }));
    // Both badges, said under the name on a phone and in a column on a wider screen
    expect(screen.getAllByText('Onay bekliyor').length).toBeGreaterThan(0);
  });

  it('says while the form’s answers are being gathered', async () => {
    api.list!.mockResolvedValue(page([], { collecting: true }));
    render(<Harness view="unticketed" />);
    expect(await screen.findByText('Form yanıtları alınıyor.')).toBeInTheDocument();
    expect(screen.getByText('Bilet bekleyen yok')).toBeInTheDocument();
  });

  it('is not available on a core without the route', async () => {
    api.list!.mockRejectedValue(new ProblemError(404, 'Not Found'));
    render(<Harness view="unticketed" />);
    expect(await screen.findByText('yok')).toBeInTheDocument();
  });

  it('searches through core and offers no send-all while searching', async () => {
    render(<Harness view="unticketed" query="ada" />);
    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith('e1', {
        formsStatus: 'accepted',
        limit: 200,
        q: 'ada',
      }),
    );
    expect(await screen.findByText('Ada Demir')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hepsine gönder' })).not.toBeInTheDocument();
  });

  it('says what the gatherings could not keep', async () => {
    api.list!.mockResolvedValue(
      page([], { incomplete: { missingName: 3, missingEmail: 1, noPerson: 0 } }),
    );
    render(<Harness view="unticketed" />);
    expect(
      await screen.findByText('3 yanıtta ad eksik, 1 yanıtta e-posta eksik.'),
    ).toBeInTheDocument();
  });

  it('keeps the view on another failure, says so and reads again', async () => {
    const user = userEvent.setup();
    api
      .list!.mockRejectedValueOnce(new ProblemError(503, 'x'))
      .mockRejectedValueOnce(new ProblemError(503, 'x'));
    render(<Harness view="unticketed" />);
    expect(await screen.findByText('Liste yüklenemedi.')).toBeInTheDocument();
    expect(screen.getByText('hazır:0')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yeniden dene' }));
    expect(await screen.findByText('Ada Demir')).toBeInTheDocument();
    expect(screen.queryByText('Liste yüklenemedi.')).not.toBeInTheDocument();
  });

  it('reads the lists again when a send-all job fails, and survives one failed read', async () => {
    const user = userEvent.setup({ advanceTimers: (ms) => jest.advanceTimersByTime(ms) });
    jest.useFakeTimers();
    try {
      const onRefresh = jest.fn();
      api.sendTickets!.mockResolvedValue({ jobId: 'job-3' });
      api.ticketJob!.mockRejectedValueOnce(new Error('ağ')).mockResolvedValueOnce({
        jobId: 'job-3',
        state: 'failed',
        recorded: 1,
        waitlisted: 0,
        full: 0,
        skipped: 0,
      });
      render(<Harness view="unticketed" onRefresh={onRefresh} />);
      await user.click(await screen.findByRole('button', { name: 'Hepsine gönder' }));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Biletleri gönder' }));
      expect(await screen.findByText('Biletler gönderiliyor: 0 bilet.')).toBeInTheDocument();
      await act(async () => {
        jest.advanceTimersByTime(RESPONDENT_JOB_POLL_MS);
      });
      expect(await screen.findByText(/Durum okunamadı, yeniden deneniyor\./)).toBeInTheDocument();
      await act(async () => {
        jest.advanceTimersByTime(RESPONDENT_JOB_POLL_MS);
      });
      expect(await screen.findByText('Gönderim tamamlanamadı: 1 bilet.')).toBeInTheDocument();
      expect(onRefresh).toHaveBeenCalled();
    } finally {
      window.sessionStorage.clear();
      jest.useRealTimers();
    }
  });

  it('offers no sending to who may not add participants', async () => {
    render(<Harness view="unticketed" canSend={false} />);
    expect(await screen.findByText('Ada Demir')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bilet gönder/i })).not.toBeInTheDocument();
  });
});

it('formsResponseHref points to Forms’ review page', () => {
  expect(formsResponseHref({ formId: 'f', responseId: 'r' })).toBe(
    'https://forms.yildizskylab.com/admin/forms/f/responses/r',
  );
});
