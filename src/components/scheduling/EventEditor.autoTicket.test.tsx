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

describe('EventEditor "Otomatik bilet gönder"', () => {
  beforeAll(() => {
    if (!('PointerEvent' in window)) {
      Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
    }
  });

  it('is on for a new Event and turns off', async () => {
    const user = userEvent.setup();
    const onValue = jest.fn();
    render(<Editor start={{}} onValue={onValue} />);
    expect(screen.getByRole('switch', { name: /Otomatik bilet gönder/ })).toBeChecked();
    await user.click(screen.getByText('Otomatik bilet gönder'));
    expect(onValue).toHaveBeenLastCalledWith(
      expect.objectContaining({ formResponsesAutoTicket: false }),
    );
    expect(screen.getByText('Yeni yanıtlar Katılımcılar’da bilet bekler.')).toBeInTheDocument();
  });

  it('is not offered while core sends none (an older core)', () => {
    render(<Editor start={{ formResponsesAutoTicket: undefined }} />);
    expect(screen.queryByText('Otomatik bilet gönder')).not.toBeInTheDocument();
  });
});
