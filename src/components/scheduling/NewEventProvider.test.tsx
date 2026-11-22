import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { NewEventProvider, useNewEvent } from '@/components/scheduling/NewEventProvider';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', groups: ['/UYELER/YK'], roles: [] } }),
}));

function Opener() {
  const { open, canCreate } = useNewEvent();
  return (
    <button type="button" onClick={open} disabled={!canCreate}>
      Etkinlik oluştur
    </button>
  );
}

describe('NewEventProvider', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens the one new event page; there is no second, shorter form', async () => {
    const user = userEvent.setup();
    render(
      <NewEventProvider>
        <Opener />
      </NewEventProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Etkinlik oluştur' }));
    expect(mockPush).toHaveBeenCalledWith('/events/new');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
