import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TeamLeaders } from '@/components/identity/TeamLeaders';
import { ProblemError } from '@/lib/api/core';
import { identityApi, type ManagedGroup } from '@/lib/api/identity';

jest.mock('@/lib/api/identity', () => ({
  identityApi: {
    teamLeaders: jest.fn(),
    addTeamLeader: jest.fn(),
    removeTeamLeader: jest.fn(),
    memberCandidates: jest.fn(),
  },
}));

// jsdom has no PointerEvent; base-ui's Radio sends one on a click
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
  }
});

function team(can: Record<string, boolean>): ManagedGroup {
  return { id: 'fe', code: 'FRONTEND', path: '/UYELER/ARGE/WEBLAB/FRONTEND', can, children: [] };
}

const ADA = {
  id: 'u-ada',
  firstName: 'Ada',
  lastName: 'L',
  email: 'ada@example.com',
  kind: 'LIDERLER',
  groupId: 'g-lid',
};
const CEM = {
  ...ADA,
  id: 'u-cem',
  firstName: 'Cem',
  email: 'cem@example.com',
  kind: 'KOORDINATORLER',
};

function show(can: Record<string, boolean>, onChanged = jest.fn()) {
  render(
    <TeamLeaders team={team(can)} personHref={(id) => `/users/${id}`} onChanged={onChanged} />,
  );
  return onChanged;
}

describe('Liderler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (identityApi.teamLeaders as jest.Mock).mockResolvedValue([ADA, CEM]);
  });

  it('lists the Leaders and Coordinators, read-only with the reason without core’s leaders.write', async () => {
    show({ 'group.read': true, 'leaders.write': false });
    expect(await screen.findByText('Lider · ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('Koordinatör · cem@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ada L' })).toHaveAttribute('href', '/users/u-ada');
    expect(
      screen.getByText('Bu ekibin liderlerini üst ekibin liderleri ya da YK değiştirir.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lider ata' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Çıkar' })).toBeNull();
    expect(identityApi.teamLeaders).toHaveBeenCalledWith('fe');
  });

  it('says the list could not be read', async () => {
    (identityApi.teamLeaders as jest.Mock).mockRejectedValue(new ProblemError(403, 'Forbidden'));
    show({ 'leaders.write': true });
    expect(await screen.findByRole('alert')).toHaveTextContent('Bu işlem için yetkin yok.');
  });

  it('names a Leader after asking, with the Leader group chosen in the question', async () => {
    (identityApi.memberCandidates as jest.Mock).mockResolvedValue([
      {
        id: 'u-ece',
        firstName: 'Ece',
        lastName: 'K',
        email: 'e***@example.com',
        alreadyMember: true,
        ytuLinked: true,
        warnings: [],
      },
      // Already a Leader: not offered again
      { ...ADA, alreadyMember: false, ytuLinked: true, warnings: [] },
    ]);
    (identityApi.addTeamLeader as jest.Mock).mockResolvedValue(undefined);
    const user = userEvent.setup();
    const onChanged = show({ 'leaders.write': true });
    await screen.findByText('Lider · ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Lider ata' }));
    const drawer = await screen.findByRole('dialog', { name: 'Lider ata' });
    await user.type(within(drawer).getByPlaceholderText('Ad veya tam e-posta'), 'ece');
    await waitFor(() => expect(identityApi.memberCandidates).toHaveBeenCalledWith('fe', 'ece'));
    expect(within(drawer).queryByRole('button', { name: 'Ada L' })).toBeNull();
    await user.click(await within(drawer).findByRole('button', { name: 'Ece K' }));

    const dialog = await screen.findByRole('alertdialog', {
      name: 'Ece K FRONTEND ekibine atansın mı?',
    });
    await user.click(within(dialog).getByRole('radio', { name: 'Koordinatör' }));
    await user.click(within(dialog).getByRole('button', { name: 'Ata' }));
    await waitFor(() =>
      expect(identityApi.addTeamLeader).toHaveBeenCalledWith('fe', 'u-ece', 'KOORDINATORLER'),
    );
    expect(await screen.findByText('Koordinatör atandı')).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  it('names a Leader by default and says core’s refusal in the question', async () => {
    (identityApi.memberCandidates as jest.Mock).mockResolvedValue([
      {
        id: 'u-ece',
        firstName: 'Ece',
        lastName: 'K',
        email: 'e***@example.com',
        alreadyMember: false,
        ytuLinked: true,
        warnings: [],
      },
    ]);
    (identityApi.addTeamLeader as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { code: 'group_limit' }),
    );
    const user = userEvent.setup();
    const onChanged = show({ 'leaders.write': true });
    await screen.findByText('Lider · ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Lider ata' }));
    const drawer = await screen.findByRole('dialog', { name: 'Lider ata' });
    await user.type(within(drawer).getByPlaceholderText('Ad veya tam e-posta'), 'ece');
    await user.click(await within(drawer).findByRole('button', { name: 'Ece K' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Ata' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Kişi çok sayıda grupta; bu ekleme yapılamaz.',
    );
    expect(identityApi.addTeamLeader).toHaveBeenCalledWith('fe', 'u-ece', 'LIDERLER');
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('warns before removing the last Leader and says it after', async () => {
    (identityApi.teamLeaders as jest.Mock).mockResolvedValueOnce([ADA]).mockResolvedValue([]);
    (identityApi.removeTeamLeader as jest.Mock).mockResolvedValue({ lastLeader: true });
    const user = userEvent.setup();
    const onChanged = show({ 'leaders.write': true });
    await user.click(await screen.findByRole('button', { name: 'Çıkar' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Ada L FRONTEND liderliğinden çıkarılsın mı?',
    });
    expect(dialog).toHaveTextContent('Ekibin başka lideri kalmaz.');
    await user.click(within(dialog).getByRole('button', { name: 'Liderlikten çıkar' }));
    await waitFor(() => expect(identityApi.removeTeamLeader).toHaveBeenCalledWith('fe', 'u-ada'));
    expect(await screen.findByText('Lider çıkarıldı. Ekibin lideri kalmadı.')).toBeInTheDocument();
    expect(await screen.findByText('Lider yok')).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  it('removes one of several Leaders without the warning', async () => {
    (identityApi.removeTeamLeader as jest.Mock).mockResolvedValue({ lastLeader: false });
    const user = userEvent.setup();
    show({ 'leaders.write': true });
    await screen.findByText('Lider · ada@example.com');
    await user.click(screen.getAllByRole('button', { name: 'Çıkar' })[1]!);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).not.toHaveTextContent('Ekibin başka lideri kalmaz.');
    await user.click(within(dialog).getByRole('button', { name: 'Liderlikten çıkar' }));
    await waitFor(() => expect(identityApi.removeTeamLeader).toHaveBeenCalledWith('fe', 'u-cem'));
    expect(await screen.findByText('Lider çıkarıldı')).toBeInTheDocument();
  });
});
