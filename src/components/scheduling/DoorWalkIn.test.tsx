import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ProblemError } from '@/lib/api/core';
import { DoorDesk } from '@/components/scheduling/DoorDesk';
import { DoorWalkIn, phoneShapeOk } from '@/components/scheduling/DoorWalkIn';
import { eventDaysApi } from '@/lib/api/eventDays';
import { ticketsApi, type WalkInResult } from '@/lib/api/tickets';

const { walkInRequest } =
  jest.requireActual<typeof import('@/lib/api/tickets')>('@/lib/api/tickets');

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'op', groups: ['/UYELER/YK'], roles: [] } }),
}));

jest.mock('@/lib/api/events', () => ({ eventsApi: { list: jest.fn() } }));

jest.mock('@/lib/api/eventDays', () => ({
  eventDaysApi: { listByEvent: jest.fn(), listSessions: jest.fn() },
}));

jest.mock('@/lib/api/tickets', () => ({
  ticketsApi: {
    listDoorEvents: jest.fn(),
    searchDoorAttendees: jest.fn(),
    resolveAndCheckIn: jest.fn(),
    scanCheckIn: jest.fn(),
    undoCheckIn: jest.fn(),
    doorActivity: jest.fn(),
    createDoorQr: jest.fn(),
    scanEntry: jest.fn(),
    resolveEntry: jest.fn(),
    undoEntry: jest.fn(),
    venueEntries: jest.fn(),
    walkIn: jest.fn(),
  },
}));

const entry = (id: string, name: string, source = 'walk_in') => ({
  id,
  kind: 'entry' as const,
  entryDate: '2026-11-27',
  source: source as 'walk_in',
  name,
  createdAt: new Date(2026, 10, 27, 11, 4, 0).toISOString(),
});

const created: WalkInResult = {
  result: 'created',
  name: 'Ayşe Yılmaz',
  ticketCode: 'K7M2-QX9F',
  ticketMail: true,
  entry: entry('v9', 'Ayşe Yılmaz'),
};

const band = () => screen.getByRole('status', { name: 'Kapıda kayıt sonucu' });
const first = () => screen.getByLabelText('Ad');
const last = () => screen.getByLabelText('Soyad');
const email = () => screen.getByLabelText('E-posta');
const phone = () => screen.getByLabelText('Telefon (isteğe bağlı)');

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  values: { first?: string; last?: string; email?: string },
) {
  await user.click(screen.getByRole('button', { name: 'Kapıda kayıt' }));
  if (values.first) await user.type(first(), values.first);
  if (values.last) await user.type(last(), values.last);
  if (values.email) await user.type(email(), values.email);
}

const ayse = { first: 'Ayşe', last: 'Yılmaz', email: 'ayse@example.com' };

describe('DoorWalkIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ticketsApi.walkIn as jest.Mock).mockResolvedValue(created);
  });

  it('opens a short form of three fields on the button, the first one focused', async () => {
    const user = userEvent.setup();
    render(<DoorWalkIn eventId="e1" entryMode="venue" />);
    const toggle = screen.getByRole('button', { name: 'Kapıda kayıt' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('form', { name: 'Kapıda kayıt' })).not.toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('form', { name: 'Kapıda kayıt' })).toBeVisible();
    expect(first()).toHaveFocus();
    expect(email()).toHaveAttribute('type', 'email');
    expect(email()).toHaveAttribute('inputmode', 'email');
    for (const input of [first(), last(), email()]) {
      expect(input).toHaveAttribute('autocomplete', 'off');
    }
    // The optional fields, open under Ek bilgiler
    expect(phone()).toBeVisible();
    expect(phone()).toHaveAttribute('type', 'tel');
    expect(phone()).toHaveAttribute('inputmode', 'tel');
    expect(phone()).toHaveAttribute('autocomplete', 'tel');
    const university = screen.getByLabelText('Üniversite (isteğe bağlı)');
    const offered = document.getElementById(university.getAttribute('list') ?? '');
    expect(offered?.querySelector('option')).toHaveAttribute('value', 'Yıldız Teknik Üniversitesi');
    expect(screen.getByLabelText('Bölüm (isteğe bağlı)')).toBeVisible();
    const grade = screen.getByLabelText('Sınıf (isteğe bağlı)');
    expect(
      Array.from(grade.querySelectorAll('option')).map((option) => option.textContent),
    ).toEqual([
      'Seçilmedi',
      'Hazırlık',
      '1',
      '2',
      '3',
      '4',
      'Yüksek lisans',
      'Doktora',
      'Mezun',
      'Diğer',
    ]);
    expect(screen.getByRole('button', { name: 'Kaydet ve içeri al' })).toBeVisible();
  });

  it('says Kaydet on an event run per session', async () => {
    const user = userEvent.setup();
    render(<DoorWalkIn eventId="e1" entryMode="per_session" />);
    await user.click(screen.getByRole('button', { name: 'Kapıda kayıt' }));
    expect(screen.getByRole('button', { name: 'Kaydet' })).toBeVisible();
  });

  it('asks for all three fields before calling core', async () => {
    const user = userEvent.setup();
    render(<DoorWalkIn eventId="e1" entryMode="venue" />);
    await fill(user, { first: 'Ayşe', email: 'ayse@example.com' });
    await user.click(screen.getByRole('button', { name: 'Kaydet ve içeri al' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ad, soyad ve e-posta gerekli.');
    expect(last()).toHaveAttribute('aria-invalid', 'true');
    expect(first()).not.toHaveAttribute('aria-invalid');
    expect(last()).toHaveFocus();
    expect(ticketsApi.walkIn).not.toHaveBeenCalled();
  });

  it('refuses an address without the x@y.z shape', async () => {
    const user = userEvent.setup();
    render(<DoorWalkIn eventId="e1" entryMode="venue" />);
    await fill(user, { ...ayse, email: 'ayse@example' });
    await user.click(screen.getByRole('button', { name: 'Kaydet ve içeri al' }));
    expect(screen.getByRole('alert')).toHaveTextContent('E-posta geçersiz.');
    expect(email()).toHaveAttribute('aria-invalid', 'true');
    expect(ticketsApi.walkIn).not.toHaveBeenCalled();
  });

  it('moves to the next field on Enter in a name', async () => {
    const user = userEvent.setup();
    render(<DoorWalkIn eventId="e1" entryMode="venue" />);
    await fill(user, { first: 'Ayşe{Enter}' });
    expect(last()).toHaveFocus();
    await user.type(last(), 'Yılmaz{Enter}');
    expect(email()).toHaveFocus();
    expect(ticketsApi.walkIn).not.toHaveBeenCalled();
  });

  it('sends the trimmed fields to the event’s walk-in and shows the new ticket', async () => {
    const user = userEvent.setup();
    const onDone = jest.fn();
    render(<DoorWalkIn eventId="e1" entryMode="venue" onDone={onDone} />);
    await fill(user, { first: ' Ayşe ', last: 'Yılmaz', email: 'ayse@example.com ' });
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(ticketsApi.walkIn).toHaveBeenCalledWith('e1', {
        firstName: 'Ayşe',
        lastName: 'Yılmaz',
        email: 'ayse@example.com',
        phone: '',
        university: '',
        department: '',
        grade: '',
      }),
    );
    await waitFor(() => expect(band()).toHaveTextContent('Kayıt yapıldı, giriş yazıldı'));
    expect(band()).toHaveTextContent('Ayşe Yılmaz · K7M2-QX9F · Bilet postası gönderildi');
    expect(band().firstElementChild).toHaveClass('bg-success/15');
    expect(onDone).toHaveBeenCalledWith(created);
    // The form closes empty
    expect(screen.queryByRole('form', { name: 'Kapıda kayıt' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Kapıda kayıt' }));
    expect(first()).toHaveValue('');
    expect(email()).toHaveValue('');
    // Opening it again clears the last result
    expect(band()).toBeEmptyDOMElement();
  });

  it('says Yazılıyor… while core writes', async () => {
    const user = userEvent.setup();
    let answer: (value: WalkInResult) => void = () => undefined;
    (ticketsApi.walkIn as jest.Mock).mockReturnValue(
      new Promise<WalkInResult>((resolve) => {
        answer = resolve;
      }),
    );
    render(<DoorWalkIn eventId="e1" entryMode="venue" />);
    await fill(user, ayse);
    await user.click(screen.getByRole('button', { name: 'Kaydet ve içeri al' }));
    expect(screen.getByRole('button', { name: 'Yazılıyor…' })).toBeDisabled();
    answer(created);
    await waitFor(() => expect(band()).toHaveTextContent('Kayıt yapıldı'));
  });

  it.each([
    [
      'a new ticket per session',
      { ...created, entry: null },
      'Kayıt yapıldı',
      'Ayşe Yılmaz · K7M2-QX9F · Bilet postası gönderildi',
    ],
    [
      'a ticket held, let in',
      { ...created, result: 'existing', ticketMail: false, entry: entry('v8', 'Ayşe', 'desk') },
      'Bileti vardı, giriş yazıldı',
      'Ayşe Yılmaz · K7M2-QX9F · Yeni bilet açılmadı',
    ],
    [
      'a ticket held per session',
      { ...created, result: 'existing', ticketMail: false, entry: null },
      'Bileti var',
      'Ayşe Yılmaz · K7M2-QX9F · Yeni bilet açılmadı',
    ],
  ] as [string, WalkInResult, string, string][])('shows %s', async (_, result, title, line) => {
    (ticketsApi.walkIn as jest.Mock).mockResolvedValue(result);
    const user = userEvent.setup();
    render(<DoorWalkIn eventId="e1" entryMode="venue" />);
    await fill(user, ayse);
    await user.click(screen.getByRole('button', { name: 'Kaydet ve içeri al' }));
    await waitFor(() => expect(band()).toHaveTextContent(line));
    expect(band().querySelector('p')).toHaveTextContent(new RegExp(`^${title}$`));
  });

  it('leaves the mail line out when no mail was queued', async () => {
    (ticketsApi.walkIn as jest.Mock).mockResolvedValue({ ...created, ticketMail: false });
    const user = userEvent.setup();
    render(<DoorWalkIn eventId="e1" entryMode="venue" />);
    await fill(user, ayse);
    await user.click(screen.getByRole('button', { name: 'Kaydet ve içeri al' }));
    await waitFor(() => expect(band()).toHaveTextContent('Ayşe Yılmaz · K7M2-QX9F'));
    expect(band()).not.toHaveTextContent('Bilet postası');
  });

  it.each([
    [
      new ProblemError(409, 'Conflict', { code: 'event_full', fields: { waitlistEnabled: true } }),
      'Kontenjan dolu; kapıda kayıt yapılamaz.',
      'bg-destructive/15',
    ],
    [
      new ProblemError(409, 'Conflict', { code: 'already_entered', fields: { name: 'Can Demir' } }),
      'Can Demir bugün zaten girdi.',
      'bg-warning/15',
    ],
    [
      new ProblemError(403, 'Forbidden'),
      'Bu etkinlikte kapıda kayıt yetkin yok.',
      'bg-destructive/15',
    ],
    [
      new ProblemError(409, 'Conflict', { code: 'ticket_waitlisted' }),
      'Bekleme listesinde. Yetkili kişi öne almalı.',
      'bg-destructive/15',
    ],
    [
      new ProblemError(409, 'Conflict', { code: 'ticket_cancelled' }),
      'Bileti iptal edilmiş. Yetkili kişiye yönlendir.',
      'bg-destructive/15',
    ],
    [
      new ProblemError(403, 'Forbidden', {
        code: 'event_closed',
        fields: { reason: 'event_cancelled' },
      }),
      'Etkinlik iptal edilmiş.',
      'bg-destructive/15',
    ],
    [
      new ProblemError(429, 'Too Many Requests', {
        code: 'walk_in_rate_limited',
        fields: { retryAfterSeconds: 30 },
      }),
      'Çok fazla kayıt; biraz sonra dene.',
      'bg-destructive/15',
    ],
    [
      new ProblemError(503, 'Unavailable', { code: 'audit_unavailable' }),
      'Şu an yazılamadı; tekrar dene.',
      'bg-destructive/15',
    ],
    [new ProblemError(404, 'Not Found'), 'Etkinlik bulunamadı.', 'bg-destructive/15'],
  ])('says core’s refusal %#, keeping the form', async (err, text, tone) => {
    (ticketsApi.walkIn as jest.Mock).mockRejectedValue(err);
    const user = userEvent.setup();
    const onDone = jest.fn();
    render(<DoorWalkIn eventId="e1" entryMode="venue" onDone={onDone} />);
    await fill(user, ayse);
    await user.click(screen.getByRole('button', { name: 'Kaydet ve içeri al' }));
    await waitFor(() => expect(band()).toHaveTextContent(text));
    expect(band().firstElementChild).toHaveClass(tone);
    expect(first()).toHaveValue('Ayşe');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('marks the fields core named missing, and a refused address', async () => {
    (ticketsApi.walkIn as jest.Mock).mockRejectedValueOnce(
      new ProblemError(400, 'Bad Request', {
        code: 'guest_fields_required',
        fields: { fields: ['lastName'] },
      }),
    );
    const user = userEvent.setup();
    render(<DoorWalkIn eventId="e1" entryMode="venue" />);
    await fill(user, ayse);
    await user.click(screen.getByRole('button', { name: 'Kaydet ve içeri al' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Ad, soyad ve e-posta gerekli.'),
    );
    expect(last()).toHaveAttribute('aria-invalid', 'true');

    (ticketsApi.walkIn as jest.Mock).mockRejectedValueOnce(
      new ProblemError(400, 'Bad Request', { code: 'email_invalid' }),
    );
    await user.click(screen.getByRole('button', { name: 'Kaydet ve içeri al' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('E-posta geçersiz.'));
    expect(email()).toHaveAttribute('aria-invalid', 'true');
  });

  it('sends the optional fields and keeps the phone off the band', async () => {
    const user = userEvent.setup();
    render(<DoorWalkIn eventId="e1" entryMode="venue" />);
    await fill(user, ayse);
    await user.type(phone(), '0532 123 45 67');
    await user.type(
      screen.getByLabelText('Üniversite (isteğe bağlı)'),
      'Yıldız Teknik Üniversitesi',
    );
    await user.type(screen.getByLabelText('Bölüm (isteğe bağlı)'), ' Fizik ');
    await user.selectOptions(screen.getByLabelText('Sınıf (isteğe bağlı)'), 'Yüksek lisans');
    await user.click(screen.getByRole('button', { name: 'Kaydet ve içeri al' }));
    await waitFor(() =>
      expect(ticketsApi.walkIn).toHaveBeenCalledWith('e1', {
        firstName: 'Ayşe',
        lastName: 'Yılmaz',
        email: 'ayse@example.com',
        phone: '0532 123 45 67',
        university: 'Yıldız Teknik Üniversitesi',
        department: 'Fizik',
        grade: 'masters',
      }),
    );
    await waitFor(() => expect(band()).toHaveTextContent('Kayıt yapıldı'));
    expect(band()).not.toHaveTextContent('0532');
  });

  it('refuses a phone of the wrong shape, and lets an empty one through', async () => {
    const user = userEvent.setup();
    render(<DoorWalkIn eventId="e1" entryMode="venue" />);
    await fill(user, ayse);
    await user.type(phone(), '12345');
    await user.click(screen.getByRole('button', { name: 'Kaydet ve içeri al' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Telefon geçersiz.');
    expect(phone()).toHaveAttribute('aria-invalid', 'true');
    expect(ticketsApi.walkIn).not.toHaveBeenCalled();
    await user.clear(phone());
    await user.click(screen.getByRole('button', { name: 'Kaydet ve içeri al' }));
    await waitFor(() => expect(ticketsApi.walkIn).toHaveBeenCalledTimes(1));
  });

  it('marks the phone core refused, opening Ek bilgiler', async () => {
    (ticketsApi.walkIn as jest.Mock).mockRejectedValue(
      new ProblemError(400, 'Bad Request', { code: 'phone_invalid' }),
    );
    const user = userEvent.setup();
    render(<DoorWalkIn eventId="e1" entryMode="venue" />);
    await fill(user, ayse);
    await user.type(phone(), '+90 532 123 45 67');
    await user.click(screen.getByText('Ek bilgiler'));
    expect(phone()).not.toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Kaydet ve içeri al' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Telefon geçersiz.'));
    expect(phone()).toBeVisible();
    expect(phone()).toHaveAttribute('aria-invalid', 'true');
  });

  it.each([
    ['grade_invalid', 'Sınıf (isteğe bağlı)', 'Sınıf geçersiz; listeden seç.'],
    ['university_too_long', 'Üniversite (isteğe bağlı)', 'Üniversite en çok 200 karakter.'],
    ['department_too_long', 'Bölüm (isteğe bağlı)', 'Bölüm en çok 200 karakter.'],
  ])('marks the field of core’s %s', async (code, label, text) => {
    (ticketsApi.walkIn as jest.Mock).mockRejectedValue(
      new ProblemError(400, 'Bad Request', { code }),
    );
    const user = userEvent.setup();
    render(<DoorWalkIn eventId="e1" entryMode="venue" />);
    await fill(user, ayse);
    await user.click(screen.getByRole('button', { name: 'Kaydet ve içeri al' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(text));
    expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
  });

  it('marks the fields core named holding a control character', async () => {
    (ticketsApi.walkIn as jest.Mock).mockRejectedValueOnce(
      new ProblemError(400, 'Bad Request', {
        code: 'guest_field_invalid',
        fields: { fields: ['lastName', 'department'] },
      }),
    );
    const user = userEvent.setup();
    render(<DoorWalkIn eventId="e1" entryMode="venue" />);
    await fill(user, ayse);
    await user.click(screen.getByRole('button', { name: 'Kaydet ve içeri al' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Bu alanda geçersiz karakter var.'),
    );
    expect(last()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Bölüm (isteğe bağlı)')).toHaveAttribute('aria-invalid', 'true');
    expect(first()).not.toHaveAttribute('aria-invalid');
  });

  it('caps the names at 100 characters and marks core’s guest_name_too_long', async () => {
    (ticketsApi.walkIn as jest.Mock).mockRejectedValueOnce(
      new ProblemError(400, 'Bad Request', { code: 'guest_name_too_long', fields: { max: 100 } }),
    );
    const user = userEvent.setup();
    render(<DoorWalkIn eventId="e1" entryMode="venue" />);
    await fill(user, ayse);
    expect(first()).toHaveAttribute('maxlength', '100');
    expect(last()).toHaveAttribute('maxlength', '100');
    await user.click(screen.getByRole('button', { name: 'Kaydet ve içeri al' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Ad ve soyad en çok 100 karakter.'),
    );
    expect(first()).toHaveAttribute('aria-invalid', 'true');
    expect(last()).toHaveAttribute('aria-invalid', 'true');
  });

  it('caps the university and the department at 200 characters', async () => {
    const user = userEvent.setup();
    render(<DoorWalkIn eventId="e1" entryMode="venue" />);
    await user.click(screen.getByRole('button', { name: 'Kapıda kayıt' }));
    expect(screen.getByLabelText('Üniversite (isteğe bağlı)')).toHaveAttribute('maxlength', '200');
    expect(screen.getByLabelText('Bölüm (isteğe bağlı)')).toHaveAttribute('maxlength', '200');
  });

  it('keeps Ek bilgiler closed for the next person once closed', async () => {
    const user = userEvent.setup();
    render(<DoorWalkIn eventId="e1" entryMode="venue" />);
    await fill(user, ayse);
    await user.click(screen.getByText('Ek bilgiler'));
    await user.click(screen.getByRole('button', { name: 'Kaydet ve içeri al' }));
    await waitFor(() => expect(band()).toHaveTextContent('Kayıt yapıldı'));
    await user.click(screen.getByRole('button', { name: 'Kapıda kayıt' }));
    expect(phone()).not.toBeVisible();
  });

  it('closes empty on Vazgeç', async () => {
    const user = userEvent.setup();
    render(<DoorWalkIn eventId="e1" entryMode="venue" />);
    await fill(user, { first: 'Ayşe' });
    await user.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(screen.queryByRole('form', { name: 'Kapıda kayıt' })).not.toBeInTheDocument();
    expect(ticketsApi.walkIn).not.toHaveBeenCalled();
  });
});

describe('walk-in fields', () => {
  it.each([
    ['05321234567', true],
    ['0532 123 45 67', true],
    ['0532-123-45-67', true],
    ['+90 532 123 45 67', true],
    ['5321234567', true],
    ['(0212) 383 70 70', true],
    ['+49 30 1234567', true],
    ['90 532 123 45 67', true],
    ['0532.123.45.67', true],
    ['12345', false],
    ['0532 123 45 6', false],
    ['1234567890', true],
    ['0090 532 123 45 67', true],
    ['0049 30 1234567', true],
    ['+90 0532 123 45 67', false],
    ['+90 532 123 45', false],
    ['0123456789', false],
    ['+0 1234 5678', false],
    ['0532\t1234567', false],
    ['+12 345', false],
    ['abc', false],
  ])('phone %s → %s', (value, ok) => {
    expect(phoneShapeOk(value)).toBe(ok);
  });

  it('sends core the required fields and only the optional ones that are filled', () => {
    expect(
      walkInRequest({
        firstName: 'Ayşe',
        lastName: 'Yılmaz',
        email: 'ayse@example.com',
        phone: ' 0532 123 45 67 ',
        university: '',
        department: '  ',
        grade: '3',
      }),
    ).toEqual({
      firstName: 'Ayşe',
      lastName: 'Yılmaz',
      email: 'ayse@example.com',
      phoneNumber: '0532 123 45 67',
      grade: '3',
    });
  });
});

describe('DoorDesk’s Kapıda kayıt', () => {
  const door = {
    id: 'e1',
    name: 'Buluşma',
    location: 'YTÜ',
    ownerTeam: 'WEBLAB',
    active: true,
    ranked: false,
    effectiveEntryMode: 'venue',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([door]);
    (eventDaysApi.listByEvent as jest.Mock).mockResolvedValue([
      { id: 'd1', eventId: 'e1', name: 'Gün' },
    ]);
    (eventDaysApi.listSessions as jest.Mock).mockResolvedValue([
      { id: 's1', eventDayId: 'd1', title: 'Açılış', speakerName: '', orderIndex: 0 },
    ]);
    (ticketsApi.searchDoorAttendees as jest.Mock).mockResolvedValue([]);
    (ticketsApi.doorActivity as jest.Mock).mockResolvedValue({ total: 0, items: [] });
    (ticketsApi.venueEntries as jest.Mock).mockResolvedValue([entry('v1', 'Grace Hopper', 'scan')]);
    (ticketsApi.walkIn as jest.Mock).mockResolvedValue(created);
  });

  const tab = (name: string) => screen.getByRole('tab', { name });
  const walkIn = () => screen.getByRole('button', { name: 'Kapıda kayıt' });

  it('offers it on both tabs without a camera, with no session taken', async () => {
    const user = userEvent.setup();
    render(<DoorDesk eventId="e1" />);
    await waitFor(() => expect(tab('Alana giriş')).toHaveAttribute('aria-selected', 'true'));
    // jsdom has no camera: no Kamerayla tara, still Kapıda kayıt
    expect(screen.queryByRole('button', { name: /Kamerayla tara/ })).not.toBeInTheDocument();
    expect(walkIn()).toBeEnabled();
    await user.click(tab('Oturum katılımı'));
    expect(screen.getByLabelText('Oturum')).toHaveValue('');
    expect(walkIn()).toBeEnabled();
  });

  it('catches the door’s count and list up after a walk-in', async () => {
    const user = userEvent.setup();
    render(<DoorDesk eventId="e1" />);
    await waitFor(() => expect(screen.getByText('Grace Hopper')).toBeVisible());
    (ticketsApi.venueEntries as jest.Mock).mockResolvedValue([
      entry('v9', 'Ayşe Yılmaz'),
      entry('v1', 'Grace Hopper', 'scan'),
    ]);
    await fill(user, ayse);
    await user.click(screen.getByRole('button', { name: 'Kaydet ve içeri al' }));
    await waitFor(() => expect(ticketsApi.walkIn).toHaveBeenCalledWith('e1', expect.anything()));
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Giren sayısı' })).toHaveTextContent('2'),
    );
    expect(screen.getAllByText('Ayşe Yılmaz').length).toBeGreaterThan(0);
  });
});
