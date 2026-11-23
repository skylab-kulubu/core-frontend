import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AuthenticatedChrome } from '@/components/layout/AuthenticatedChrome';
import { useChromeCrumbName } from '@/components/layout/chrome-crumb-names';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { competitorsApi } from '@/lib/api/competitors';
import { eventsApi } from '@/lib/api/events';
import { ticketsApi } from '@/lib/api/tickets';
import type { UserDto } from '@/types/api';

jest.mock('@/lib/api/tickets', () => ({
  ticketsApi: { listDoorEvents: jest.fn() },
}));

jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn() },
}));

jest.mock('@/lib/api/competitors', () => ({
  competitorsApi: { listByEvent: jest.fn() },
}));

jest.mock('@/lib/api/events', () => ({
  eventsApi: { get: jest.fn(), list: jest.fn().mockResolvedValue([]) },
}));

jest.mock('@/lib/api/identity', () => ({
  identityApi: {
    listGroups: jest.fn().mockResolvedValue([]),
    listUsers: jest.fn().mockResolvedValue([]),
  },
}));

let currentPathname = '/dashboard';

jest.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

const user: UserDto = {
  id: '1',
  username: 'yk',
  email: 'yk@example.com',
  firstName: 'Y',
  lastName: 'K',
  roles: [],
  groups: ['/UYELER/YK'],
};

function NamedEvent() {
  useChromeCrumbName('/events/event-1', "Yıldız Hackathon '26");
  return <p>İçerik</p>;
}

/** core's answer for a WEBLAB Leader who also leads its Sub-team MOBIL (core ticket 12). */
const LEADER_CAN = {
  'ticket.read': true,
  'competitor.update': true,
  'door.checkIn': true,
  'certificate.read': true,
};
const WEBLAB_LEADER_CAPABILITIES = {
  editableSites: [],
  teams: [
    { team: 'MOBIL', levels: ['LEADER'], can: LEADER_CAN },
    { team: 'WEBLAB', levels: ['LEADER', 'MEMBER'], can: LEADER_CAN },
  ],
  otherTeams: { can: {} },
  noOwnerTeam: { can: {} },
};

describe('AuthenticatedChrome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentPathname = '/dashboard';
    window.localStorage.clear();
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([]);
    (capabilitiesApi.get as jest.Mock).mockResolvedValue(WEBLAB_LEADER_CAPABILITIES);
    (competitorsApi.listByEvent as jest.Mock).mockResolvedValue([]);
  });

  it('closes the mobile menu when the viewport crosses into desktop', async () => {
    let onChange: ((event: MediaQueryListEvent) => void) | undefined;
    let desktop = false;
    window.matchMedia = jest.fn().mockImplementation(() => ({
      get matches() {
        return desktop;
      },
      media: '(min-width: 48rem)',
      addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
        onChange = listener;
      },
      removeEventListener: jest.fn(),
    }));
    const pointer = userEvent.setup();
    render(
      <AuthenticatedChrome sidebarUser={user}>
        <p>İçerik</p>
      </AuthenticatedChrome>,
    );
    await pointer.click(screen.getByRole('button', { name: 'Menüyü aç' }));
    expect(screen.getByRole('dialog', { name: 'Gezinme' })).toBeInTheDocument();

    act(() => {
      desktop = true;
      onChange?.({ matches: true } as MediaQueryListEvent);
    });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Gezinme' })).not.toBeInTheDocument(),
    );
  });

  it('links the editor sign-in of each site core says the person may edit', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      editableSites: [
        { clientId: 'frontend-artlab', name: 'ARTLAB', url: 'https://artlab.yildizskylab.com' },
      ],
    });
    const pointer = userEvent.setup();
    render(
      <AuthenticatedChrome sidebarUser={user}>
        <p>İçerik</p>
      </AuthenticatedChrome>,
    );

    await pointer.click(screen.getByRole('button', { name: 'Y K' }));
    await pointer.click(await screen.findByRole('menuitem', { name: 'Siteyi düzenle' }));
    expect(await screen.findByRole('menuitem', { name: 'ARTLAB' })).toHaveAttribute(
      'href',
      'https://artlab.yildizskylab.com/api/signin',
    );
  });

  it('shows no site editing when core lists no site or cannot be read', async () => {
    (capabilitiesApi.get as jest.Mock).mockRejectedValue(new Error('HTTP 503'));
    render(
      <AuthenticatedChrome sidebarUser={user}>
        <p>İçerik</p>
      </AuthenticatedChrome>,
    );

    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    const pointer = userEvent.setup();
    await pointer.click(screen.getByRole('button', { name: 'Y K' }));
    await screen.findByRole('menuitem', { name: 'Hesap merkezi' });
    expect(screen.queryByRole('menuitem', { name: 'Siteyi düzenle' })).not.toBeInTheDocument();
  });

  it('discovers door assignments and exposes the door workspace', async () => {
    const doorUser: UserDto = {
      ...user,
      id: 'door-1',
      username: 'door',
      email: 'door@example.com',
      groups: ['/UYELER/ARGE/WEBLAB'],
    };
    (ticketsApi.listDoorEvents as jest.Mock).mockResolvedValue([{ id: 'event-1', name: 'Hack' }]);

    render(
      <AuthenticatedChrome sidebarUser={doorUser}>
        <p>İçerik</p>
      </AuthenticatedChrome>,
    );

    await waitFor(() => expect(screen.getByRole('link', { name: 'Kapı' })).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Kullanıcılar' })).not.toBeInTheDocument();
  });

  it('restores and persists the desktop sidebar width preference', async () => {
    window.localStorage.setItem('skylab.admin.sidebar-collapsed', 'true');
    const pointer = userEvent.setup();
    render(
      <AuthenticatedChrome sidebarUser={user}>
        <p>İçerik</p>
      </AuthenticatedChrome>,
    );

    const expand = await screen.findByRole('button', { name: 'Kenar çubuğunu genişlet' });
    await pointer.click(expand);
    expect(window.localStorage.getItem('skylab.admin.sidebar-collapsed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Kenar çubuğunu daralt' })).toBeInTheDocument();
  });

  it('reads no event for the sidebar: an event’s pages are its tabs', async () => {
    currentPathname = '/events/event-1/participants';
    const leader = { ...user, groups: ['/UYELER/ARGE/WEBLAB/LIDERLER'] };
    render(
      <AuthenticatedChrome sidebarUser={leader}>
        <p>İçerik</p>
      </AuthenticatedChrome>,
    );

    const current = await screen.findAllByRole('link', { name: 'Etkinlikler', current: 'page' });
    expect(current[0]).toHaveAttribute('href', '/events');
    await act(async () => undefined);
    expect(eventsApi.get).not.toHaveBeenCalled();
    expect(competitorsApi.listByEvent).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Katılımcılar' })).not.toBeInTheDocument();
  });

  it('opens an event’s door without the sidebar', async () => {
    currentPathname = '/events/event-1/door';
    render(
      <AuthenticatedChrome sidebarUser={user}>
        <p>Kapı</p>
      </AuthenticatedChrome>,
    );

    expect(screen.getByText('Kapı', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Özet' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Sayfa yolu' })).not.toBeInTheDocument();
  });

  it('names the browser tab after the page and its record', async () => {
    currentPathname = '/events/event-1/program';
    render(
      <AuthenticatedChrome sidebarUser={user}>
        <NamedEvent />
      </AuthenticatedChrome>,
    );

    await waitFor(() => expect(document.title).toBe("Yıldız Hackathon '26 · Program · SKY LAB"));
  });

  it('names the open event in the trail', async () => {
    currentPathname = '/events/event-1/program';
    render(
      <AuthenticatedChrome sidebarUser={user}>
        <NamedEvent />
      </AuthenticatedChrome>,
    );

    const trail = screen.getAllByRole('navigation', { name: 'Sayfa yolu' })[0];
    expect(await within(trail).findAllByText("Yıldız Hackathon '26")).not.toHaveLength(0);
    expect(within(trail).queryByText('…')).not.toBeInTheDocument();
  });

  it('lists Harita bölgeleri only once core says media.delete (media:manage)', async () => {
    currentPathname = '/seasons';
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'media.delete': true } });
    const first = render(
      <AuthenticatedChrome sidebarUser={user}>
        <p>İçerik</p>
      </AuthenticatedChrome>,
    );
    expect(await screen.findByRole('link', { name: 'Harita bölgeleri' })).toHaveAttribute(
      'href',
      '/map-regions',
    );
    first.unmount();

    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'media.delete': false } });
    render(
      <AuthenticatedChrome sidebarUser={user}>
        <p>İçerik</p>
      </AuthenticatedChrome>,
    );
    expect(await screen.findByRole('link', { name: 'Sezonlar' })).toBeInTheDocument();
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalledTimes(2));
    await act(async () => undefined);
    expect(screen.queryByRole('link', { name: 'Harita bölgeleri' })).not.toBeInTheDocument();
  });
  it('puts the search in the top bar and opens it from there', async () => {
    const pointer = userEvent.setup();
    render(
      <AuthenticatedChrome sidebarUser={user}>
        <p>İçerik</p>
      </AuthenticatedChrome>,
    );
    await pointer.click(screen.getAllByRole('button', { name: 'Ara' })[0]);
    expect(
      await screen.findByRole('combobox', { name: 'Sayfa, etkinlik ya da kişi ara' }),
    ).toBeInTheDocument();
  });

  it('draws the account menu once, in the top bar', async () => {
    render(
      <AuthenticatedChrome sidebarUser={user}>
        <p>İçerik</p>
      </AuthenticatedChrome>,
    );
    expect(await screen.findAllByRole('button', { name: 'Y K' })).toHaveLength(1);
  });
});
