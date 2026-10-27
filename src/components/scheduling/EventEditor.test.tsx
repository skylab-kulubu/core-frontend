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
    expect(screen.getByText('En az 2 karakter yazın')).toBeInTheDocument();
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
    expect(screen.getByText('Cevapları kayıt yazmaz.')).toBeInTheDocument();
    // The feedback form is fixed: one "Form ekle", for the Form slots alone
    expect(screen.getAllByText('Form ekle')).toHaveLength(1);

    // The Session forms are in Program (bilet 09)
    expect(screen.getByRole('option', { name: 'Oturum başına form' })).toBeInTheDocument();
    await user.selectOptions(mode, 'event_with_sessions');
    expect(onValue).toHaveBeenLastCalledWith(
      expect.objectContaining({ feedbackMode: 'event_with_sessions' }),
    );

    const [, feedbackSkyforms] = screen.getAllByRole('radio', { name: 'Skyforms’ta oluştur' });
    await user.click(feedbackSkyforms!);
    // Skyforms brings the new form back to the feedback field
    const links = screen
      .getAllByRole('link', { name: 'Skyforms’ta oluştur' })
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
