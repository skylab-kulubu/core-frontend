import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { FormMappingPanel, TICKET_JOB_POLL_MS, bindQuestion } from './FormMappingPanel';
import { ProblemError } from '@/lib/api/core';
import { formRespondentsApi } from '@/lib/api/form-respondents';
import { readFormAnswerCounts } from '@/lib/api/skyforms';

jest.mock('@/lib/api/form-respondents', () => ({
  formRespondentsApi: {
    questions: jest.fn(),
    mapping: jest.fn(),
    saveMapping: jest.fn(),
    previewTickets: jest.fn(),
    sendTickets: jest.fn(),
    ticketJob: jest.fn(),
    list: jest.fn(),
  },
}));
jest.mock('@/lib/api/skyforms', () => ({ readFormAnswerCounts: jest.fn() }));

const api = formRespondentsApi as unknown as Record<string, jest.Mock>;
const EVENT = '11111111-1111-4111-8111-111111111111';
const FORM = '22222222-2222-4222-8222-222222222222';

const questions = {
  formId: FORM,
  title: 'Başvuru',
  questions: [
    { id: 'q1', type: 'short_text', question: 'Adınız' },
    { id: 'q2', type: 'short_text', question: 'Soyadınız' },
    { id: 'q3', type: 'short_text', question: 'E-posta adresiniz' },
    { id: 'q4', type: 'file', question: 'CV' },
  ],
  suggestion: { firstName: null, lastName: null, fullName: null, email: null },
};

const notFound = new ProblemError(404, 'Not Found', { code: 'mapping_not_found' });

function box(name: string) {
  return screen.getByRole('combobox', {
    name: (label) => label === name || label === `${name} tahmin`,
  }) as HTMLSelectElement;
}

describe('FormMappingPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.questions!.mockResolvedValue(questions);
    api.mapping!.mockRejectedValue(notFound);
    api.list!.mockResolvedValue({ items: [], nextCursor: null, total: 0, collecting: false });
    (readFormAnswerCounts as jest.Mock).mockResolvedValue({ accepted: 12, pending: 3 });
    api.previewTickets!.mockResolvedValue({
      tickets: 10,
      waitlisted: 2,
      full: 0,
      alreadyTicketed: 0,
      pendingSkipped: 3,
    });
  });

  it('fills the boxes from the guess, marked, and leaves out questions that hold no name', async () => {
    render(<FormMappingPanel eventId={EVENT} formId={FORM} />);
    await screen.findByText('Eşlemeyi kaydet');
    expect(box('Ad').value).toBe('q1');
    expect(box('Soyad').value).toBe('q2');
    expect(box('E-posta').value).toBe('q3');
    expect(box('Ad soyad').value).toBe('');
    expect(screen.getAllByText('tahmin')).toHaveLength(3);
    expect(within(box('Ad')).queryByRole('option', { name: 'CV' })).not.toBeInTheDocument();
  });

  it('shows a saved mapping as it is, with no guess', async () => {
    api.mapping!.mockResolvedValue({
      firstName: null,
      lastName: null,
      fullName: 'q1',
      email: 'q3',
    });
    render(<FormMappingPanel eventId={EVENT} formId={FORM} />);
    await screen.findByText('Eşlemeyi kaydet');
    expect(box('Ad soyad').value).toBe('q1');
    expect(box('Ad').value).toBe('');
    expect(screen.queryByText('tahmin')).not.toBeInTheDocument();
  });

  it('keeps the save off without an e-mail question', async () => {
    const user = userEvent.setup();
    render(<FormMappingPanel eventId={EVENT} formId={FORM} />);
    await screen.findByText('Eşlemeyi kaydet');
    await user.selectOptions(box('E-posta'), '');
    expect(screen.getByText('E-posta sorusunu seç.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eşlemeyi kaydet' })).toBeDisabled();
  });

  it.each([
    [new ProblemError(503, 'x', { code: 'forms_pull_off' }), 'Forms bağlantısı kapalı.'],
    [
      new ProblemError(403, 'x', { code: 'forms_access_denied' }),
      'Bu formun sahibi ya da düzenleyeni değilsin.',
    ],
    [new ProblemError(404, 'x', { code: 'form_not_listed' }), 'Etkinliği kaydet, sonra eşle.'],
  ])('says why it cannot map (%s), with nothing to save', async (err, text) => {
    api.questions!.mockRejectedValue(err);
    render(<FormMappingPanel eventId={EVENT} formId={FORM} />);
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eşlemeyi kaydet' })).not.toBeInTheDocument();
  });

  it('shows nothing for an Event core does not have yet', async () => {
    api.questions!.mockRejectedValue(new ProblemError(404, 'Not Found'));
    const { container } = render(<FormMappingPanel eventId={EVENT} formId={FORM} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('says a question gone from the form on save (422)', async () => {
    const user = userEvent.setup();
    api.saveMapping!.mockRejectedValue(
      new ProblemError(422, 'x', { code: 'mapping_question_missing', fields: { missing: ['q3'] } }),
    );
    render(<FormMappingPanel eventId={EVENT} formId={FORM} />);
    await user.click(await screen.findByRole('button', { name: 'Eşlemeyi kaydet' }));
    expect(await screen.findByText('Seçili bir soru artık formda yok.')).toBeInTheDocument();
  });

  it('asks after the first save, sends everyone and follows the job', async () => {
    const user = userEvent.setup({ advanceTimers: (ms) => jest.advanceTimersByTime(ms) });
    jest.useFakeTimers();
    try {
      api.saveMapping!.mockResolvedValue({
        firstName: 'q1',
        lastName: 'q2',
        fullName: null,
        email: 'q3',
      });
      api.sendTickets!.mockResolvedValue({ jobId: 'job-1' });
      api.ticketJob!.mockResolvedValue({
        jobId: 'job-1',
        state: 'done',
        recorded: 10,
        waitlisted: 2,
        full: 0,
        skipped: 0,
      });
      render(<FormMappingPanel eventId={EVENT} formId={FORM} />);
      await user.click(await screen.findByRole('button', { name: 'Eşlemeyi kaydet' }));

      expect(api.saveMapping).toHaveBeenCalledWith(EVENT, FORM, {
        firstName: 'q1',
        lastName: 'q2',
        fullName: null,
        email: 'q3',
      });
      const dialog = await screen.findByRole('alertdialog');
      expect(
        within(dialog).getByText(
          'Bu formu 12 kişi doldurdu. Hepsini katılımcı olarak ekleyip biletlerini gönderelim mi?',
        ),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText('10 bilet, 2 bekleme listesi. 3 kişi Forms’ta onay bekliyor.'),
      ).toBeInTheDocument();
      expect(api.previewTickets).toHaveBeenCalledWith(EVENT, { all: true, formId: FORM });

      await user.click(within(dialog).getByRole('button', { name: 'Biletleri gönder' }));
      expect(api.sendTickets).toHaveBeenCalledWith(EVENT, { all: true, formId: FORM });
      expect(await screen.findByText('Biletler gönderiliyor: 0 bilet.')).toBeInTheDocument();

      await act(async () => {
        jest.advanceTimersByTime(TICKET_JOB_POLL_MS);
      });
      expect(
        await screen.findByText('Gönderildi: 10 bilet, 2 bekleme listesi.'),
      ).toBeInTheDocument();
      expect(api.ticketJob).toHaveBeenCalledWith(EVENT, 'job-1');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not ask again on a later save, and sends nothing when the reader says no', async () => {
    const user = userEvent.setup();
    api.mapping!.mockResolvedValue({
      firstName: 'q1',
      lastName: 'q2',
      fullName: null,
      email: 'q3',
    });
    api.saveMapping!.mockResolvedValue({});
    render(<FormMappingPanel eventId={EVENT} formId={FORM} />);
    await user.click(await screen.findByRole('button', { name: 'Eşlemeyi kaydet' }));
    expect(await screen.findByText('Eşleme kaydedildi.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Yanıtlara bilet gönder' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /Vazgeç|İptal/ }));
    expect(api.sendTickets).not.toHaveBeenCalled();
  });
});

describe('bindQuestion', () => {
  const preview = { tickets: 0, waitlisted: 0, full: 0, alreadyTicketed: 0, pendingSkipped: 0 };

  it('asks nothing when nobody filled the form', () => {
    expect(bindQuestion({ accepted: 0, pending: 0 }, preview, false)).toBeNull();
  });

  it('counts from the preview when Forms gave no counts, and says a gathering runs', () => {
    expect(bindQuestion(null, { ...preview, tickets: 4, full: 1 }, true)).toEqual({
      title:
        'Bu formu 5 kişi doldurdu. Hepsini katılımcı olarak ekleyip biletlerini gönderelim mi?',
      description: '4 bilet, 1 yer yok. Yanıtlar hâlâ alınıyor; biletler alım bitince gider.',
    });
  });
});
