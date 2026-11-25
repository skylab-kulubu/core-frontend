import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { EventOrganizers } from '@/components/scheduling/EventOrganizers';
import { ProblemError } from '@/lib/api/core';
import { eventOrganizersApi, type EventOrganizers as Organizers } from '@/lib/api/event-organizers';
import { identityApi } from '@/lib/api/identity';
import { teamsApi } from '@/lib/api/teams';

const mockSuccess = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/ui/use-notify', () => ({ useNotify: () => ({ success: mockSuccess }) }));
jest.mock('@/lib/api/event-organizers', () => ({
  eventOrganizersApi: { get: jest.fn(), put: jest.fn() },
}));
jest.mock('@/lib/api/teams', () => ({ teamsApi: { list: jest.fn() } }));
jest.mock('@/lib/api/identity', () => ({ identityApi: { listUsers: jest.fn() } }));

const api = eventOrganizersApi as unknown as Record<'get' | 'put', jest.Mock>;

const event = {
  id: 'e1',
  ownerTeam: 'YK',
  startDate: '2026-12-10T09:00:00Z',
  endDate: '2026-12-12T18:00:00Z',
};

function organizers(partial: Partial<Organizers> = {}): Organizers {
  return {
    ownerTeam: 'YK',
    ownerRule: 'leaders',
    teams: [
      {
        code: 'WEBLAB',
        name: 'WEBLAB · Web Geliştirme',
        management: 'leaders',
        visibility: 'co_organizer',
      },
    ],
    people: [
      {
        id: 'u1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        expiresAt: '2027-01-11T18:00:00Z',
      },
    ],
    canManage: true,
    ...partial,
  };
}

/** A team's row on the list (not its line in the picker). */
const teamRow = (code: string) =>
  screen
    .getAllByText(new RegExp(`^${code}`))
    .map((node) => node.closest('li'))
    .find(Boolean) as HTMLElement;

describe('EventOrganizers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (teamsApi.list as jest.Mock).mockResolvedValue([
      { team: 'YK', path: '/UYELER/YK', displayName: { tr: 'Yönetim Kurulu' } },
      { team: 'DK', path: '/UYELER/DK', displayName: { tr: 'Denetim Kurulu' } },
      { team: 'WEBLAB', path: '/UYELER/ARGE/WEBLAB', displayName: { tr: 'Web Geliştirme' } },
      { team: 'ARTLAB', path: '/UYELER/ARGE/ARTLAB', displayName: { tr: 'ARTLAB' } },
    ]);
  });

  it('shows each team with its two choices and each person with when their rights end', async () => {
    api.get.mockResolvedValue(organizers());
    render(<EventOrganizers event={event} />);

    expect(await screen.findByText('WEBLAB · Web Geliştirme')).toBeInTheDocument();
    const row = teamRow('WEBLAB');
    expect(within(row).getByRole('combobox', { name: 'Kim yönetir' })).toHaveValue('leaders');
    expect(within(row).getByRole('combobox', { name: 'Görünüm' })).toHaveValue('co_organizer');
    // The Owner team's rule is named on its option
    expect(
      within(row).getByRole('option', { name: 'Yalnız liderler (sahip ekip gibi)' }),
    ).toBeInTheDocument();
    expect(within(row).getByRole('combobox', { name: 'Görünüm' })).toHaveAccessibleDescription(
      'Sitede, bilette ve doğrulamada görünür.',
    );
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText(/Etkinlik bitiminden 30 gün sonra düşer · /)).toBeInTheDocument();
    expect(
      screen.getByText('Ekibi varsa ekibi ekleyin. Kişiler dışarıda görünmez.'),
    ).toBeInTheDocument();
    // Nothing changed: no save
    expect(screen.queryByRole('button', { name: 'Düzenleyenleri kaydet' })).not.toBeInTheDocument();
  });

  it('adds a team with the Owner team’s rule and Ortak düzenleyen, and saves the choices', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(organizers({ ownerRule: 'members' }));
    api.put.mockImplementation((_id, body) =>
      Promise.resolve(
        organizers({
          ownerRule: 'members',
          teams: body.teams.map((team: { code: string }) => ({
            ...team,
            name: team.code,
          })),
        }),
      ),
    );
    render(<EventOrganizers event={event} />);
    await screen.findByText('WEBLAB · Web Geliştirme');

    await user.click(screen.getByRole('button', { name: 'Ekip ekle' }));
    // Neither the Owner team, a Privileged root nor a team already on the list
    const drawer = await screen.findByRole('dialog', { name: 'Ortak ekip ekle' });
    expect(await within(drawer).findByText('ARTLAB')).toBeInTheDocument();
    expect(within(drawer).queryByText(/^YK/)).not.toBeInTheDocument();
    expect(within(drawer).queryByText(/^DK/)).not.toBeInTheDocument();
    expect(within(drawer).queryByText(/^WEBLAB/)).not.toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'ARTLAB' }));

    const artlab = teamRow('ARTLAB');
    expect(within(artlab).getByRole('combobox', { name: 'Kim yönetir' })).toHaveValue('members');
    expect(within(artlab).getByRole('combobox', { name: 'Görünüm' })).toHaveValue('co_organizer');
    await user.selectOptions(within(artlab).getByRole('combobox', { name: 'Görünüm' }), 'helper');
    expect(within(artlab).getByText('Yalnız panelde görünür.')).toBeInTheDocument();
    await user.selectOptions(
      within(teamRow('WEBLAB')).getByRole('combobox', { name: 'Kim yönetir' }),
      'members',
    );

    await user.click(screen.getByRole('button', { name: 'Düzenleyenleri kaydet' }));

    expect(api.put).toHaveBeenCalledWith('e1', {
      teams: [
        { code: 'WEBLAB', management: 'members', visibility: 'co_organizer' },
        { code: 'ARTLAB', management: 'members', visibility: 'helper' },
      ],
      people: ['u1'],
    });
    await waitFor(() => expect(mockSuccess).toHaveBeenCalledWith('Düzenleyenler kaydedildi'));
    expect(screen.queryByRole('button', { name: 'Düzenleyenleri kaydet' })).not.toBeInTheDocument();
  });

  it('removes a person and adds another from the person search', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(organizers());
    (identityApi.listUsers as jest.Mock).mockResolvedValue([
      { id: 'u2', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' },
    ]);
    api.put.mockResolvedValue(organizers());
    render(<EventOrganizers event={event} />);
    await screen.findByText('Ada Lovelace');

    await user.click(screen.getByRole('button', { name: 'Ada Lovelace kişisini çıkar' }));
    await user.click(screen.getByRole('button', { name: 'Kişi ekle' }));
    const drawer = await screen.findByRole('dialog', { name: 'Ortak kişi ekle' });
    await user.type(within(drawer).getByRole('searchbox'), 'grace');
    await user.click(await within(drawer).findByRole('button', { name: 'Grace Hopper' }));

    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Düzenleyenleri kaydet' }));
    expect(api.put).toHaveBeenCalledWith('e1', expect.objectContaining({ people: ['u2'] }));
  });

  it('stops adding at 10 teams and 10 people', async () => {
    const many = Array.from({ length: 10 }, (_, i) => i);
    api.get.mockResolvedValue(
      organizers({
        teams: many.map((i) => ({
          code: `T${i}`,
          name: `T${i}`,
          management: 'leaders',
          visibility: 'co_organizer',
        })),
        people: many.map((i) => ({ id: `u${i}`, name: `Kişi ${i}` })),
      }),
    );
    render(<EventOrganizers event={event} />);
    await screen.findByText('Kişi 9');
    expect(screen.getByRole('button', { name: 'Ekip ekle' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Kişi ekle' })).toBeDisabled();
  });

  it('shows who may not change the list (a Co-organizer, or core’s switch off) the list alone', async () => {
    api.get.mockResolvedValue(organizers({ canManage: false }));
    render(<EventOrganizers event={event} />);

    expect(await screen.findByText('WEBLAB · Web Geliştirme')).toBeInTheDocument();
    expect(screen.getByText('Yalnız liderler · Ortak düzenleyen')).toBeInTheDocument();
    expect(screen.getByText('Listeyi sahip ekibin liderleri değiştirir.')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ekip ekle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kişi ekle' })).not.toBeInTheDocument();
  });

  it('tells the Owner team’s Leader the changes are off while core’s switch is off', async () => {
    api.get.mockResolvedValue(organizers({ canManage: false }));
    render(
      <EventOrganizers
        event={{ ...event, viewer: { via: 'owner', can: { 'event.assignDoorStaff': true } } }}
      />,
    );
    expect(
      await screen.findByText('Ortak düzenleyen değişiklikleri şu an kapalı.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Listeyi sahip ekibin liderleri değiştirir.'),
    ).not.toBeInTheDocument();
  });

  it('says there is none to who may not change an empty list', async () => {
    api.get.mockResolvedValue(organizers({ canManage: false, teams: [], people: [] }));
    render(<EventOrganizers event={event} />);
    expect(await screen.findByText('Ortak düzenleyen yok')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ekip ekle' })).not.toBeInTheDocument();
  });

  it('says so on an older core without Co-organizers (404)', async () => {
    api.get.mockRejectedValue(new ProblemError(404, 'Not Found'));
    render(<EventOrganizers event={event} />);
    expect(await screen.findByText('Ortak düzenleyen bu sunucuda yok')).toBeInTheDocument();
  });

  it.each([
    [
      new ProblemError(400, 'Bad Request', {
        code: 'event_organizers_invalid',
        fields: { field: 'teams', index: 0, reason: 'unknown_team' },
      }),
      'WEBLAB: Böyle bir ekip yok.',
    ],
    [
      new ProblemError(503, 'Service Unavailable', { code: 'audit_unavailable' }),
      'Değişiklik kayda yazılamadı, bu yüzden yapılmadı. Biraz sonra tekrar dene.',
    ],
    [
      new ProblemError(403, 'Forbidden', { code: 'co_organizers_disabled' }),
      'Ortak düzenleyen değişikliği şu an kapalı.',
    ],
    [
      new ProblemError(409, 'Conflict'),
      'Sahip ekip bu arada değişti; sayfayı yenileyip tekrar dene.',
    ],
  ])('says a refused save in Turkish and keeps the changes (%#)', async (problem, text) => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(organizers());
    api.put.mockRejectedValue(problem);
    render(<EventOrganizers event={event} />);
    await screen.findByText('WEBLAB · Web Geliştirme');

    await user.selectOptions(
      within(teamRow('WEBLAB')).getByRole('combobox', { name: 'Görünüm' }),
      'helper',
    );
    await user.click(screen.getByRole('button', { name: 'Düzenleyenleri kaydet' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.getByRole('button', { name: 'Düzenleyenleri kaydet' })).toBeInTheDocument();
  });
});
