import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AdminSearch } from '@/components/layout/AdminSearch';
import { eventsApi } from '@/lib/api/events';
import { identityApi } from '@/lib/api/identity';
import type { SidebarNavigationContext } from '@/lib/navigation/sidebar-nav';
import type { UserDto } from '@/types/api';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const mockNewEvent = { open: jest.fn(), canCreate: false };
jest.mock('@/components/scheduling/NewEventProvider', () => ({
  useNewEvent: () => mockNewEvent,
}));

jest.mock('@/lib/api/events', () => ({
  eventsApi: { list: jest.fn() },
}));

jest.mock('@/lib/api/identity', () => ({
  identityApi: { listUsers: jest.fn(), listGroups: jest.fn() },
}));

const hackathon = {
  id: 'e-hack',
  name: 'Yıldız Hackathon',
  ownerTeam: 'GECEKODU',
  location: 'Davutpaşa',
  status: 'published',
  active: true,
  startDate: '2026-11-22T09:00:00+03:00',
  endDate: '2099-11-23T18:00:00+03:00',
};
const workshop = {
  ...hackathon,
  id: 'e-llm',
  name: 'LLM Atölyesi',
  ownerTeam: 'AI-LAB',
  startDate: '2099-12-03T18:00:00+03:00',
};

const user: UserDto = {
  id: '1',
  username: 'deniz',
  email: 'deniz@example.com',
  firstName: 'Deniz',
  lastName: 'Aydın',
  roles: [],
  groups: ['/UYELER/YK'],
};

function renderSearch(who: UserDto = user, navigationContext: SidebarNavigationContext = {}) {
  return render(<AdminSearch user={who} navigationContext={navigationContext} />);
}

describe('AdminSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNewEvent.canCreate = false;
    (eventsApi.list as jest.Mock).mockResolvedValue([hackathon, workshop]);
    (identityApi.listUsers as jest.Mock).mockResolvedValue([]);
    (identityApi.listGroups as jest.Mock).mockResolvedValue([
      { id: 'g-gk', name: 'GECEKODU', path: '/UYELER/ORGANIZASYON/GECEKODU' },
    ]);
  });

  it('opens with the keyboard, filters destinations and navigates', async () => {
    const keyboard = userEvent.setup();
    renderSearch(user, { hasDoorAssignment: true });
    await keyboard.keyboard('{Meta>}k{/Meta}');
    const search = await screen.findByRole('combobox', { name: 'Sayfa, etkinlik ya da kişi ara' });
    expect(search).toHaveFocus();
    await keyboard.type(search, 'kapı');
    await keyboard.click(screen.getByRole('option', { name: /Kapı/ }));
    expect(push).toHaveBeenCalledWith('/qr');
    expect(
      screen.queryByRole('combobox', { name: 'Sayfa, etkinlik ya da kişi ara' }),
    ).not.toBeInTheDocument();
  });

  it('finds Kısa link by its old name, url', async () => {
    const keyboard = userEvent.setup();
    renderSearch();
    await keyboard.keyboard('{Meta>}k{/Meta}');
    const search = await screen.findByRole('combobox', { name: 'Sayfa, etkinlik ya da kişi ara' });
    await keyboard.type(search, 'url');
    await keyboard.click(await screen.findByRole('option', { name: /Kısa link/ }));
    expect(push).toHaveBeenCalledWith('/urls');
  });

  it('does not steal Ctrl+K from a form field', async () => {
    const keyboard = userEvent.setup();
    render(
      <>
        <input aria-label="Not" />
        <AdminSearch user={user} navigationContext={{}} />
      </>,
    );
    await keyboard.click(screen.getByRole('textbox', { name: 'Not' }));
    await keyboard.keyboard('{Control>}k{/Control}');
    expect(
      screen.queryByRole('combobox', { name: 'Sayfa, etkinlik ya da kişi ara' }),
    ).not.toBeInTheDocument();
  });

  it('closes with Escape', async () => {
    const keyboard = userEvent.setup();
    renderSearch();
    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));
    expect(
      await screen.findByRole('combobox', { name: 'Sayfa, etkinlik ya da kişi ara' }),
    ).toBeInTheDocument();
    await keyboard.keyboard('{Escape}');
    expect(
      screen.queryByRole('combobox', { name: 'Sayfa, etkinlik ya da kişi ara' }),
    ).not.toBeInTheDocument();
  });

  it('offers only the door to door staff', async () => {
    const keyboard = userEvent.setup();
    renderSearch({ ...user, groups: ['/UYELER/ARGE/WEBLAB'] }, { hasDoorAssignment: true });
    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));
    expect(await screen.findByRole('option', { name: /Kapı/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Kullanıcılar/ })).not.toBeInTheDocument();
  });

  it('announces the highlighted destination through combobox semantics', async () => {
    const keyboard = userEvent.setup();
    renderSearch();
    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));
    const search = await screen.findByRole('combobox', { name: 'Sayfa, etkinlik ya da kişi ara' });
    const options = screen.getAllByRole('option');
    expect(search).toHaveAttribute('aria-activedescendant', options[0].id);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await keyboard.type(search, '{ArrowDown}');
    expect(search).toHaveAttribute('aria-activedescendant', options[1].id);
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('finds an event by its name and opens it with the keyboard', async () => {
    const keyboard = userEvent.setup();
    renderSearch();
    await keyboard.keyboard('{Control>}k{/Control}');
    const search = await screen.findByRole('combobox', { name: 'Sayfa, etkinlik ya da kişi ara' });
    await waitFor(() =>
      expect(eventsApi.list).toHaveBeenCalledWith(undefined, undefined, { drafts: true }),
    );
    await keyboard.type(search, 'hackathon');
    expect(await screen.findByRole('option', { name: /Yıldız Hackathon/ })).toBeInTheDocument();
    await keyboard.keyboard('{Enter}');
    expect(push).toHaveBeenCalledWith('/events/e-hack');
  });

  it('offers the running and next events before anything is typed', async () => {
    const keyboard = userEvent.setup();
    renderSearch();
    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));
    const events = await screen.findByRole('group', { name: 'Etkinlikler' });
    const names = within(events)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(names[0]).toMatch(/Yıldız Hackathon/);
    expect(names[1]).toMatch(/LLM Atölyesi/);
  });

  it('searches people in core from two characters and opens their card', async () => {
    (identityApi.listUsers as jest.Mock).mockResolvedValue([
      { id: 'u-kutay', firstName: 'kutay', lastName: 'yılmaz', email: 'k@example.com' },
    ]);
    const keyboard = userEvent.setup();
    renderSearch();
    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));
    const search = await screen.findByRole('combobox', { name: 'Sayfa, etkinlik ya da kişi ara' });
    await keyboard.type(search, 'k');
    await act(async () => undefined);
    expect(identityApi.listUsers).not.toHaveBeenCalled();
    await keyboard.type(search, 'ut');
    const option = await screen.findByRole('option', { name: /Kutay Yılmaz/ });
    expect(identityApi.listUsers).toHaveBeenLastCalledWith('kut');
    await keyboard.click(option);
    expect(push).toHaveBeenCalledWith('/users/u-kutay');
  });

  it('finds groups for the Privileged', async () => {
    const keyboard = userEvent.setup();
    renderSearch();
    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));
    const search = await screen.findByRole('combobox', { name: 'Sayfa, etkinlik ya da kişi ara' });
    await keyboard.type(search, 'gecekodu');
    const groups = await screen.findByRole('group', { name: 'Gruplar' });
    expect(within(groups).getByRole('option', { name: /GECEKODU/ })).toBeInTheDocument();
  });

  it('searches no records the person cannot open', async () => {
    const keyboard = userEvent.setup();
    renderSearch({ ...user, groups: ['/UYELER/ARGE/WEBLAB'] }, { hasDoorAssignment: true });
    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));
    const search = await screen.findByRole('combobox', { name: 'Sayfa, etkinlik ya da kişi ara' });
    await keyboard.type(search, 'kut');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(eventsApi.list).not.toHaveBeenCalled();
    expect(identityApi.listUsers).not.toHaveBeenCalled();
    expect(identityApi.listGroups).not.toHaveBeenCalled();
  });

  it('opens the new event form for whoever core lets create one', async () => {
    mockNewEvent.canCreate = true;
    const keyboard = userEvent.setup();
    renderSearch();
    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));
    const search = await screen.findByRole('combobox', { name: 'Sayfa, etkinlik ya da kişi ara' });
    await keyboard.type(search, 'yeni etk');
    await keyboard.keyboard('{Enter}');
    expect(mockNewEvent.open).toHaveBeenCalledTimes(1);
  });

  it('offers no new event to whoever cannot create one (DK)', async () => {
    const keyboard = userEvent.setup();
    renderSearch({ ...user, groups: ['/UYELER/DK'] });
    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));
    await screen.findByRole('combobox', { name: 'Sayfa, etkinlik ya da kişi ara' });
    expect(screen.queryByRole('option', { name: /Yeni etkinlik/ })).not.toBeInTheDocument();
  });

  it('opens empty after a result was picked, and searches people again', async () => {
    (identityApi.listUsers as jest.Mock).mockResolvedValue([
      { id: 'u-kutay', firstName: 'kutay', lastName: 'yılmaz', email: 'k@example.com' },
    ]);
    const keyboard = userEvent.setup();
    renderSearch();
    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));
    let search = await screen.findByRole('combobox', { name: 'Sayfa, etkinlik ya da kişi ara' });
    await keyboard.type(search, 'kut');
    await keyboard.click(await screen.findByRole('option', { name: /Kutay Yılmaz/ }));
    expect(push).toHaveBeenCalledWith('/users/u-kutay');
    expect(identityApi.listUsers).toHaveBeenCalledTimes(1);

    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));
    search = await screen.findByRole('combobox', { name: 'Sayfa, etkinlik ya da kişi ara' });
    expect(search).toHaveValue('');
    await keyboard.type(search, 'kut');
    expect(await screen.findByRole('option', { name: /Kutay Yılmaz/ })).toBeInTheDocument();
    await waitFor(() => expect(identityApi.listUsers).toHaveBeenCalledTimes(2));
    expect(identityApi.listUsers).toHaveBeenLastCalledWith('kut');
  });

  it('offers the door only to whoever has a door to staff (not DK)', async () => {
    const keyboard = userEvent.setup();
    renderSearch({ ...user, groups: ['/UYELER/DK'] });
    await keyboard.click(screen.getByRole('button', { name: 'Hızlı git' }));
    await screen.findByRole('combobox', { name: 'Sayfa, etkinlik ya da kişi ara' });
    expect(screen.queryByRole('option', { name: /^Kapı/ })).not.toBeInTheDocument();
  });
});
