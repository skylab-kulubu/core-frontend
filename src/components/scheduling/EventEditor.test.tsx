import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import {
  EventEditor,
  emptyEventForm,
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
