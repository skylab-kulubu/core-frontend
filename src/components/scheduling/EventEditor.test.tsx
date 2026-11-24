import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import {
  EventEditor,
  emptyEventForm,
  FEEDBACK_MODES,
  type EventFormState,
} from '@/components/scheduling/EventEditor';
import { identityApi } from '@/lib/api/identity';

jest.mock('@/lib/api/identity', () => ({
  identityApi: { listUsers: jest.fn(), getUser: jest.fn() },
}));
jest.mock('@/lib/api/media', () => ({ mediaApi: { upload: jest.fn() } }));
jest.mock('@/lib/api/events', () => ({
  eventsApi: { list: jest.fn().mockResolvedValue([]) },
}));

function Editor({ doorStaffIds }: { doorStaffIds: string[] }) {
  const [value, setValue] = useState<EventFormState>({
    ...emptyEventForm('GECEKODU'),
    doorStaffIds,
  });
  return (
    <EventEditor value={value} onChange={setValue} ownerOptions={['GECEKODU']} assignDoorStaff />
  );
}

describe('EventEditor door staff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (identityApi.getUser as jest.Mock).mockResolvedValue({
      id: 'u-staff',
      email: 'staff@example.com',
      firstName: 'Kapı',
      lastName: 'Görevlisi',
    });
    (identityApi.listUsers as jest.Mock).mockResolvedValue([
      { id: 'u-ada', email: 'ada@example.com', firstName: 'Ada', lastName: 'L' },
    ]);
  });

  it('names assigned staff by id and searches only after two characters', async () => {
    const user = userEvent.setup();
    render(<Editor doorStaffIds={['u-staff']} />);

    expect(await screen.findByText('Kapı Görevlisi')).toBeInTheDocument();
    expect(identityApi.getUser).toHaveBeenCalledWith('u-staff');

    await user.click(screen.getByRole('button', { name: 'Kişi ekle' }));
    expect(screen.getByText('En az 2 karakter yaz')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Ad, e-posta'), 'A');
    expect(identityApi.listUsers).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText('Ad, e-posta'), 'd');
    await waitFor(() => expect(identityApi.listUsers).toHaveBeenCalledWith('Ad'));
    await user.click(await screen.findByText('Ada L'));

    expect(await screen.findByText('ada@example.com')).toBeInTheDocument();
    expect(identityApi.listUsers).toHaveBeenCalledTimes(1);
    expect(identityApi.getUser).toHaveBeenCalledTimes(1);
  });
});

describe('EventEditor fields', () => {
  it('has no Aktif switch, as core derives it', () => {
    render(<Editor doorStaffIds={[]} />);
    expect(screen.queryByRole('switch', { name: 'Aktif' })).not.toBeInTheDocument();
    expect(screen.queryByText('Aktif')).not.toBeInTheDocument();
    expect(screen.getByText('Sıralamalı')).toBeInTheDocument();
  });
});

describe('EventEditor feedback form', () => {
  function FeedbackEditor({ onValue }: { onValue: (value: EventFormState) => void }) {
    const [value, setValue] = useState<EventFormState>(emptyEventForm('GECEKODU'));
    return (
      <EventEditor
        value={value}
        onChange={(next) => {
          setValue(next);
          onValue(next);
        }}
        ownerOptions={['GECEKODU']}
      />
    );
  }

  it('picks the mode, keeps the box on by default and brings a Skyforms form back to its own field', async () => {
    const user = userEvent.setup();
    const onValue = jest.fn();
    render(<FeedbackEditor onValue={onValue} />);

    const mode = screen.getByRole('combobox', { name: 'Geri bildirim' });
    expect(mode).toHaveValue('event');
    expect(screen.getByRole('switch', { name: /Etkinlik bitince gönder/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByText('Yanıtlar kayıt açmaz.')).toBeInTheDocument();
    // The feedback form is fixed: one "Form ekle", for the Form slots alone
    expect(screen.getAllByText('Form ekle')).toHaveLength(1);

    // The Session forms are in Program (bilet 09)
    expect(screen.getByRole('option', { name: 'Oturum başına form' })).toBeInTheDocument();
    await user.selectOptions(mode, 'event_with_sessions');
    expect(onValue).toHaveBeenLastCalledWith(
      expect.objectContaining({ feedbackMode: 'event_with_sessions' }),
    );

    const [, feedbackSkyforms] = screen.getAllByRole('radio', { name: 'Yeni form' });
    await user.click(feedbackSkyforms!);
    // Skyforms brings the new form back to the feedback field
    const links = screen
      .getAllByRole('link', { name: 'Form oluştur' })
      .map((row) => new URL(row.getAttribute('href') ?? ''))
      .map((url) => new URL(url.searchParams.get('returnTo') ?? '').searchParams.get('formSlot'));
    expect(links).toContain('feedback');
    expect(onValue).toHaveBeenLastCalledWith(
      expect.objectContaining({
        feedbackSlot: expect.objectContaining({ key: 'feedback', mode: 'skyforms' }),
        extraFormUrls: [],
      }),
    );
  });
});

describe('FEEDBACK_MODES', () => {
  it('offers the three modes, the per-Session one too (its forms are in Program)', () => {
    expect(FEEDBACK_MODES.map((mode) => mode.value)).toEqual([
      'event',
      'per_session',
      'event_with_sessions',
    ]);
  });
});

describe('EventEditor certificate rule', () => {
  function RuleEditor({
    initial = {},
    onValue = () => undefined,
    ...props
  }: {
    initial?: Partial<EventFormState>;
    onValue?: (value: EventFormState) => void;
    certificatesHref?: string;
    legacyRules?: boolean;
    storedRatio?: number;
  }) {
    const [value, setValue] = useState<EventFormState>({
      ...emptyEventForm('GECEKODU'),
      ...initial,
    });
    return (
      <EventEditor
        value={value}
        onChange={(next) => {
          setValue(next);
          onValue(next);
        }}
        ownerOptions={['GECEKODU']}
        {...props}
      />
    );
  }

  const options = () =>
    Array.from(
      (screen.getByRole('combobox', { name: 'Sertifika kuralı' }) as HTMLSelectElement).options,
    ).map((option) => option.textContent);

  it('offers Yok, En az bir oturum and Oturum sayısı, no ratio', () => {
    render(<RuleEditor />);
    expect(options()).toEqual(['Yok', 'En az bir oturum', 'Oturum sayısı']);
  });

  it('writes the count rule at the default threshold and links to the Sertifikalar tab', async () => {
    const user = userEvent.setup();
    const onValue = jest.fn();
    render(
      <RuleEditor
        initial={{ attendanceMinCount: 6 }}
        onValue={onValue}
        certificatesHref="/events/e1/certificates"
      />,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sertifika kuralı' }), 'count');
    expect(onValue).toHaveBeenLastCalledWith(
      expect.objectContaining({ attendanceRule: 'count', attendanceMinCount: null }),
    );
    expect(
      screen.getByRole('link', { name: 'Eşiği ve oturumları Sertifikalar sekmesinde seç' }),
    ).toHaveAttribute('href', '/events/e1/certificates');
    expect(screen.queryByText('Katılım oranı')).not.toBeInTheDocument();
  });

  it("keeps an older event's ratio as it is, without a field to change it", () => {
    render(
      <RuleEditor
        initial={{ attendanceRule: 'ratio', attendanceRatio: 0.67 }}
        storedRatio={0.67}
        certificatesHref="/events/e1/certificates"
      />,
    );
    expect(options()).toEqual(['Yok', 'En az bir oturum', 'Oturum sayısı', 'Oran (%67)']);
    expect(screen.queryByText('Katılım oranı')).not.toBeInTheDocument();
  });

  it('keeps the ratio field on an older core', () => {
    render(<RuleEditor initial={{ attendanceRule: 'ratio', attendanceRatio: 0.5 }} legacyRules />);
    expect(options()).toEqual(['Yok', 'En az bir oturum', 'Oran']);
    expect(screen.getByText('Katılım oranı')).toBeInTheDocument();
  });
});

describe('EventEditor capacity and waiting list', () => {
  function CapacityEditor({
    start,
    activeTickets,
    onValue,
  }: {
    start: Partial<EventFormState>;
    activeTickets?: number;
    onValue?: (value: EventFormState) => void;
  }) {
    const [value, setValue] = useState<EventFormState>({
      ...emptyEventForm('GECEKODU'),
      ...start,
    });
    return (
      <EventEditor
        value={value}
        onChange={(next) => {
          setValue(next);
          onValue?.(next);
        }}
        ownerOptions={['GECEKODU']}
        activeTickets={activeTickets}
      />
    );
  }

  it('offers the waiting list only with a capacity, on by default', async () => {
    const user = userEvent.setup();
    const onValue = jest.fn();
    const { unmount } = render(<CapacityEditor start={{ capacity: 0 }} />);
    expect(screen.getByText('0 = sınırsız')).toBeInTheDocument();
    expect(screen.queryByText('Bekleme listesi açık')).not.toBeInTheDocument();
    unmount();

    render(<CapacityEditor start={{ capacity: 50 }} onValue={onValue} />);
    expect(screen.getByRole('switch', { name: /Bekleme listesi açık/ })).toBeChecked();
    await user.click(screen.getByText('Bekleme listesi açık'));
    expect(onValue).toHaveBeenLastCalledWith(expect.objectContaining({ waitlistEnabled: false }));
    expect(screen.getByText('Dolunca kayıt alınmaz.')).toBeInTheDocument();
  });

  it('says nobody is taken out when the capacity goes below the tickets', () => {
    render(<CapacityEditor start={{ capacity: 40 }} activeTickets={52} />);
    expect(
      screen.getByText('52 kayıt var. Kimse çıkarılmaz; yeni kayıt sıraya girer.'),
    ).toBeInTheDocument();
  });
});

describe('EventEditor external registration link', () => {
  it('takes the link in Başvuru ve form and says why a plain http one is refused', async () => {
    const user = userEvent.setup();
    render(<Editor doorStaffIds={[]} />);
    const field = screen.getByRole('textbox', { name: 'Dış kayıt bağlantısı' });
    expect(field.closest('section')).toHaveAttribute('id', 'basvuru');
    await user.type(field, 'http://forms.office.com/r/x');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/https:\/\/ ile başlayan/)).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, 'https://forms.office.com/r/x');
    expect(field).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByText(/Katılımcılar → İçe aktar/)).toBeInTheDocument();
  });
});
