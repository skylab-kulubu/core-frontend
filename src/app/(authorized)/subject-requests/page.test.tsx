import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import SubjectRequestsPage from '@/app/(authorized)/subject-requests/page';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { ProblemError } from '@/lib/api/core';
import { subjectRequestsApi, type SubjectRequest } from '@/lib/api/subject-requests';
import { todayInTurkey } from '@/lib/subject-requests';

jest.mock('@/lib/api/capabilities', () => ({ capabilitiesApi: { get: jest.fn() } }));
jest.mock('@/lib/api/subject-requests', () => ({
  subjectRequestsApi: { list: jest.fn(), get: jest.fn(), create: jest.fn(), update: jest.fn() },
}));

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const today = todayInTurkey();

const request = (over: Partial<SubjectRequest>): SubjectRequest => ({
  id: 'r1',
  receivedOn: addDays(today, -25),
  channel: 'email',
  requesterName: 'Ada Lovelace',
  requesterContact: 'ada@example.test',
  userId: null,
  requestTypes: ['erase'],
  status: 'received',
  dueOn: addDays(today, 5),
  answeredOn: null,
  answerSummary: '',
  responder: 'YK Başkanı',
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'subjectRequest.manage': true } });
  (subjectRequestsApi.list as jest.Mock).mockResolvedValue([
    request({}),
    request({ id: 'r2', requesterName: 'Geç Kalan', dueOn: addDays(today, -2) }),
    request({ id: 'r3', requesterName: 'Rahat', dueOn: addDays(today, 20) }),
    request({
      id: 'r4',
      requesterName: 'Cevaplanan',
      status: 'answered',
      answeredOn: addDays(today, -3),
      dueOn: addDays(today, -1),
    }),
  ]);
});

describe('KVKK başvuruları', () => {
  it('lists the open requests with a badge near or past the due date', async () => {
    render(<SubjectRequestsPage />);
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('5 gün kaldı')).toBeInTheDocument();
    expect(screen.getByText('Süre geçti')).toBeInTheDocument();
    expect(screen.getByText('Rahat')).toBeInTheDocument();
    expect(screen.getAllByText(/gün kaldı|Süre geçti/)).toHaveLength(2);
    // Açık is the default filter: the answered one waits under Sonuçlanan
    expect(screen.queryByText('Cevaplanan')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sonuçlanan' }));
    expect(await screen.findByText('Cevaplanan')).toBeInTheDocument();
    expect(screen.queryByText('Süre geçti')).not.toBeInTheDocument();
  });

  it('records a request with the fields core keeps', async () => {
    const user = userEvent.setup();
    (subjectRequestsApi.create as jest.Mock).mockResolvedValue(request({ id: 'r9' }));
    render(<SubjectRequestsPage />);
    await user.click(await screen.findByRole('button', { name: 'Başvuru ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Başvuru ekle' });
    await user.type(within(dialog).getByLabelText('Ad soyad'), ' Grace Hopper ');
    await user.type(within(dialog).getByLabelText('Cevabın gideceği adres'), 'grace@example.test');
    await user.click(within(dialog).getByRole('checkbox', { name: /Silme ya da yok etme/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: /İşlenip işlenmediğini/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() =>
      expect(subjectRequestsApi.create).toHaveBeenCalledWith({
        receivedOn: today,
        channel: 'email',
        requesterName: 'Grace Hopper',
        requesterContact: 'grace@example.test',
        userId: null,
        requestTypes: ['learn', 'erase'],
        status: 'received',
        answeredOn: null,
        answerSummary: '',
        responder: 'YK Başkanı',
      }),
    );
    expect(await screen.findByText('Başvuru eklendi')).toBeInTheDocument();
  });

  it('asks for a type before sending', async () => {
    const user = userEvent.setup();
    render(<SubjectRequestsPage />);
    await user.click(await screen.findByRole('button', { name: 'Başvuru ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Başvuru ekle' });
    await user.type(within(dialog).getByLabelText('Ad soyad'), 'Grace');
    await user.type(within(dialog).getByLabelText('Cevabın gideceği adres'), 'g@example.test');
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('En az bir talep türü seç.');
    expect(subjectRequestsApi.create).not.toHaveBeenCalled();
  });

  it('closes a request with its answer date and shows the trail', async () => {
    const user = userEvent.setup();
    (subjectRequestsApi.get as jest.Mock).mockResolvedValue({
      ...request({}),
      events: [
        {
          at: '2026-10-02T09:00:00Z',
          actorId: 'u1',
          action: 'create',
          fields: ['status'],
          status: 'received',
        },
        {
          at: '2026-10-03T09:00:00Z',
          actorId: 'u1',
          action: 'update',
          fields: ['status'],
          status: 'awaiting_verification',
        },
      ],
    });
    (subjectRequestsApi.update as jest.Mock).mockResolvedValue(request({ status: 'answered' }));
    render(<SubjectRequestsPage />);
    await screen.findByText('Ada Lovelace');
    // Ada's row comes first: the list keeps core's order
    await user.click(screen.getAllByRole('button', { name: 'Düzenle' })[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Başvuruyu düzenle' });
    expect(
      await within(dialog).findByText(/Değişti: durum · Kimlik onayı bekleniyor/),
    ).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Cevap tarihi')).not.toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText('Durum'), 'answered');
    const answered = within(dialog).getByLabelText('Cevap tarihi');
    await user.type(answered, today);
    await user.type(within(dialog).getByLabelText('Cevap özeti'), 'Hesap silindi.');
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() =>
      expect(subjectRequestsApi.update).toHaveBeenCalledWith(
        'r1',
        expect.objectContaining({
          updatedAt: '2026-10-01T10:00:00Z',
          status: 'answered',
          answeredOn: today,
          answerSummary: 'Hesap silindi.',
        }),
      ),
    );
    expect(await screen.findByText('Başvuru kaydedildi')).toBeInTheDocument();
  });

  it('shows core’s refusal in Turkish inside the drawer', async () => {
    const user = userEvent.setup();
    (subjectRequestsApi.update as jest.Mock).mockRejectedValue(
      new ProblemError(400, 'Bad Request', { code: 'answered_on_invalid' }),
    );
    (subjectRequestsApi.get as jest.Mock).mockResolvedValue(request({}));
    render(<SubjectRequestsPage />);
    await screen.findByText('Ada Lovelace');
    // Ada's row comes first: the list keeps core's order
    await user.click(screen.getAllByRole('button', { name: 'Düzenle' })[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Başvuruyu düzenle' });
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Cevap tarihi başvurudan önce ya da bugünden sonra olamaz',
    );
  });

  it('says someone else changed the request when core refuses the stale version', async () => {
    const user = userEvent.setup();
    (subjectRequestsApi.update as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { code: 'subject_request_changed' }),
    );
    (subjectRequestsApi.get as jest.Mock).mockResolvedValue(request({}));
    render(<SubjectRequestsPage />);
    await screen.findByText('Ada Lovelace');
    await user.click(screen.getAllByRole('button', { name: 'Düzenle' })[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Başvuruyu düzenle' });
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Başvuru sen açtıktan sonra başkası tarafından değiştirildi',
    );
  });

  it('reads nothing for someone core does not let in (DK)', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'subjectRequest.manage': false },
    });
    render(<SubjectRequestsPage />);
    expect(await screen.findByText('Bu kayda yalnız YK ve yöneticiler erişir')).toBeInTheDocument();
    expect(subjectRequestsApi.list).not.toHaveBeenCalled();
  });
});
