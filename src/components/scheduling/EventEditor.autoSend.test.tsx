import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import {
  EventEditor,
  emptyEventForm,
  type EventFormState,
} from '@/components/scheduling/EventEditor';

jest.mock('@/lib/api/identity', () => ({
  identityApi: { listUsers: jest.fn(), getUser: jest.fn() },
}));
jest.mock('@/lib/api/media', () => ({ mediaApi: { upload: jest.fn() } }));
jest.mock('@/lib/api/events', () => ({
  eventsApi: { list: jest.fn().mockResolvedValue([]) },
}));

function Editor({
  start,
  onValue,
}: {
  start: Partial<EventFormState>;
  onValue?: (value: EventFormState) => void;
}) {
  const [value, setValue] = useState<EventFormState>({ ...emptyEventForm('GECEKODU'), ...start });
  return (
    <EventEditor
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
      ownerOptions={['GECEKODU']}
    />
  );
}

describe('EventEditor "Sertifikaları otomatik gönder"', () => {
  beforeAll(() => {
    if (!('PointerEvent' in window)) {
      Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
    }
  });

  it('shows once a rule is chosen, off for a new Event, and turns on', async () => {
    const user = userEvent.setup();
    const onValue = jest.fn();
    render(<Editor start={{}} onValue={onValue} />);
    expect(screen.queryByText('Sertifikaları otomatik gönder')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Sertifika kuralı'), 'once');
    const toggle = screen.getByRole('switch', { name: /Sertifikaları otomatik gönder/ });
    expect(toggle).not.toBeChecked();
    expect(
      screen.getByText('Son oturumdan 1 saat sonra üretilir ve postalanır'),
    ).toBeInTheDocument();
    await user.click(screen.getByText('Sertifikaları otomatik gönder'));
    expect(onValue).toHaveBeenLastCalledWith(
      expect.objectContaining({ attendanceRule: 'once', attendanceAutoFinalize: true }),
    );
  });

  it('shows a saved Event’s switch as it is', () => {
    render(<Editor start={{ attendanceRule: 'count', attendanceAutoFinalize: true }} />);
    expect(screen.getByRole('switch', { name: /Sertifikaları otomatik gönder/ })).toBeChecked();
  });

  it('is not offered while core sends none (an older core)', () => {
    render(<Editor start={{ attendanceRule: 'once', attendanceAutoFinalize: undefined }} />);
    expect(screen.queryByText('Sertifikaları otomatik gönder')).not.toBeInTheDocument();
  });
});
