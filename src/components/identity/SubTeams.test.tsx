import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { SubTeams } from '@/components/identity/SubTeams';
import { ProblemError } from '@/lib/api/core';
import { identityApi, type ManagedGroup } from '@/lib/api/identity';

jest.mock('@/lib/api/identity', () => ({
  identityApi: {
    createSubTeam: jest.fn(),
    changeTeamCode: jest.fn(),
    deleteGroup: jest.fn(),
    movePreview: jest.fn(),
    moveTeam: jest.fn(),
  },
}));

/** core's decisions for a Leader of WEBLAB on its Sub-teams: no code change (YK's). */
const LEADER_ON_SUB = { 'team.move': true, 'team.delete': true, 'code.write': false };
const YK = { 'team.move': true, 'team.delete': true, 'code.write': true, 'subteams.write': true };

function sub(
  id: string,
  code: string,
  can: Record<string, boolean>,
  extra: Partial<ManagedGroup> = {},
) {
  return {
    id,
    code,
    path: `/UYELER/ARGE/WEBLAB/${code}`,
    memberCount: 4,
    leaderCount: 1,
    can: { 'subteams.write': true, ...can },
    children: [],
    ...extra,
  } satisfies ManagedGroup;
}

function weblab(
  children: ManagedGroup[],
  can: Record<string, boolean> = { 'subteams.write': true },
) {
  return {
    id: 'web',
    code: 'WEBLAB',
    path: '/UYELER/ARGE/WEBLAB',
    displayName: { tr: 'Web Lab' },
    can,
    children,
  } satisfies ManagedGroup;
}

function show(team: ManagedGroup, onChanged = jest.fn()) {
  render(<SubTeams team={team} tree={[team]} base="/my-teams" onChanged={onChanged} />);
  return onChanged;
}

describe('Alt ekipler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists the Sub-teams with their counts, each opening its page', () => {
    show(weblab([sub('fe', 'FRONTEND', LEADER_ON_SUB, { displayName: { tr: 'Ön yüz' } })]));
    expect(screen.getByRole('link', { name: 'Ön yüz' })).toHaveAttribute('href', '/my-teams/fe');
    expect(screen.getByText('FRONTEND · 4 üye · 1 lider')).toBeInTheDocument();
  });

  it('shows only the actions core allows, and says why the code is not the Leader’s', () => {
    show(weblab([sub('fe', 'FRONTEND', LEADER_ON_SUB)]));
    expect(screen.getByRole('button', { name: 'Taşı' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sil' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kodu değiştir' })).toBeNull();
    expect(screen.getByText('Alt ekip kodunu YK değiştirir.')).toBeInTheDocument();
  });

  it('gives a reader core lets change nothing a plain list', () => {
    const read = { 'group.read': true };
    show(weblab([sub('fe', 'FRONTEND', { ...read, 'subteams.write': false })], read));
    expect(screen.getByRole('link', { name: 'FRONTEND' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('Alt ekip kodunu YK değiştirir.')).toBeNull();
  });

  it('says a protected Sub-team is YK’s', () => {
    show(
      weblab([
        sub('fe', 'FRONTEND', LEADER_ON_SUB),
        sub('sec', 'SEC', { 'team.move': false, 'team.delete': false }, { protected: true }),
      ]),
    );
    expect(screen.getByText(/Korunan alt ekipleri yalnız YK değiştirir\./)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Sil' })).toHaveLength(1);
  });

  it('stays away on a Team with no Sub-team that the reader may not open one under', () => {
    show(weblab([], { 'group.read': true }));
    expect(screen.queryByText('Alt ekipler')).toBeNull();
  });

  it('opens a Sub-team with its code and display names, then reads the tree again', async () => {
    (identityApi.createSubTeam as jest.Mock).mockResolvedValue({ id: 'new' });
    const user = userEvent.setup();
    const onChanged = show(weblab([]));
    await user.click(screen.getByRole('button', { name: 'Alt ekip aç' }));
    const drawer = await screen.findByRole('dialog', { name: 'Alt ekip aç' });
    await user.type(within(drawer).getByLabelText('Kod'), 'FRONTEND');
    await user.type(within(drawer).getByLabelText('Görünen ad'), 'Ön yüz');
    await user.click(within(drawer).getByRole('button', { name: 'Alt ekibi aç' }));
    await waitFor(() =>
      expect(identityApi.createSubTeam).toHaveBeenCalledWith('web', {
        code: 'FRONTEND',
        displayNameTr: 'Ön yüz',
      }),
    );
    expect(await screen.findByText('Alt ekip açıldı')).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  it('says core’s refusal of the code in the drawer', async () => {
    (identityApi.createSubTeam as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { code: 'name_taken' }),
    );
    const user = userEvent.setup();
    const onChanged = show(weblab([]));
    await user.click(screen.getByRole('button', { name: 'Alt ekip aç' }));
    const drawer = await screen.findByRole('dialog', { name: 'Alt ekip aç' });
    await user.type(within(drawer).getByLabelText('Kod'), 'WEBLAB');
    await user.type(within(drawer).getByLabelText('Görünen ad'), 'Web');
    await user.click(within(drawer).getByRole('button', { name: 'Alt ekibi aç' }));
    expect(await within(drawer).findByRole('alert')).toHaveTextContent(
      'Bu kod kullanılıyor ya da daha önce kullanıldı; başka bir kod seç.',
    );
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('changes a code when core allows it', async () => {
    (identityApi.changeTeamCode as jest.Mock).mockResolvedValue({ id: 'fe' });
    const user = userEvent.setup();
    const onChanged = show(weblab([sub('fe', 'FRONTEND', YK)]));
    await user.click(screen.getByRole('button', { name: 'Kodu değiştir' }));
    const drawer = await screen.findByRole('dialog', { name: 'Kodu değiştir: FRONTEND' });
    const field = within(drawer).getByLabelText('Yeni kod');
    expect(field).toHaveValue('FRONTEND');
    await user.clear(field);
    await user.type(field, 'WEB-UI');
    await user.click(within(drawer).getByRole('button', { name: 'Kodu değiştir' }));
    await waitFor(() => expect(identityApi.changeTeamCode).toHaveBeenCalledWith('fe', 'WEB-UI'));
    expect(onChanged).toHaveBeenCalled();
  });

  it('asks before deleting, says it cannot be undone and says who is still in it', async () => {
    (identityApi.deleteGroup as jest.Mock).mockRejectedValueOnce(
      new ProblemError(409, 'Conflict', { code: 'not_empty', fields: { members: 2, children: 0 } }),
    );
    (identityApi.deleteGroup as jest.Mock).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    const onChanged = show(weblab([sub('fe', 'FRONTEND', LEADER_ON_SUB)]));
    await user.click(screen.getByRole('button', { name: 'Sil' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'FRONTEND alt ekibi silinsin mi?',
    });
    expect(dialog).toHaveTextContent('geri alınamaz');
    expect(identityApi.deleteGroup).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Alt ekibi sil' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Alt ekipte ya da altındaki gruplarda 2 kişi var (liderler dahil); önce onları çıkar.',
    );
    expect(onChanged).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Alt ekibi sil' }));
    expect(await screen.findByText('Alt ekip silindi')).toBeInTheDocument();
    expect(identityApi.deleteGroup).toHaveBeenCalledWith('fe');
    expect(onChanged).toHaveBeenCalled();
  });

  describe('Taşı', () => {
    const mobil = sub('mob', 'MOBIL', LEADER_ON_SUB);
    const frontend = sub('fe', 'FRONTEND', LEADER_ON_SUB);
    const team = weblab([frontend, mobil]);
    const preview = {
      allowed: true,
      oldPath: '/UYELER/ARGE/WEBLAB/MOBIL',
      newPath: '/UYELER/ARGE/WEBLAB/FRONTEND/MOBIL',
      members: 4,
      rolesGained: [],
      rolesLost: ['core:url:access'],
      newParentLeaders: 1,
    };

    async function openMove(user: ReturnType<typeof userEvent.setup>) {
      const rows = screen.getAllByRole('button', { name: 'Taşı' });
      await user.click(rows[1]!);
      return screen.findByRole('dialog', { name: 'Taşı: MOBIL' });
    }

    it('offers the Teams core lets the reader open Sub-teams under, not the current one', async () => {
      const user = userEvent.setup();
      show(team);
      const drawer = await openMove(user);
      expect(within(drawer).getByRole('button', { name: 'FRONTEND' })).toBeInTheDocument();
      // WEBLAB is where MOBIL sits now; MOBIL itself is no target
      expect(within(drawer).queryByRole('button', { name: 'Web Lab' })).toBeNull();
      expect(within(drawer).queryByRole('button', { name: 'MOBIL' })).toBeNull();
    });

    it('says core’s refusal from the preview and asks nothing', async () => {
      (identityApi.movePreview as jest.Mock).mockResolvedValue({
        ...preview,
        allowed: false,
        refusal: 'depth_limit',
      });
      const user = userEvent.setup();
      show(team);
      const drawer = await openMove(user);
      await user.click(within(drawer).getByRole('button', { name: 'FRONTEND' }));
      expect(await within(drawer).findByRole('alert')).toHaveTextContent(
        'Ekip ağacının sınırı aşılırdı',
      );
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(identityApi.moveTeam).not.toHaveBeenCalled();
    });

    it('asks with core’s summary and moves only on the answer', async () => {
      (identityApi.movePreview as jest.Mock).mockResolvedValue(preview);
      (identityApi.moveTeam as jest.Mock).mockResolvedValue({ id: 'mob' });
      const user = userEvent.setup();
      const onChanged = show(team);
      const drawer = await openMove(user);
      await user.click(within(drawer).getByRole('button', { name: 'FRONTEND' }));
      expect(identityApi.movePreview).toHaveBeenCalledWith('mob', 'fe');
      const dialog = await screen.findByRole('alertdialog', {
        name: 'MOBIL, FRONTEND altına taşınsın mı?',
      });
      expect(dialog).toHaveTextContent('/UYELER/ARGE/WEBLAB/FRONTEND/MOBIL');
      expect(dialog).toHaveTextContent('Kaybedilen roller');
      expect(dialog).toHaveTextContent('core:url:access');
      expect(identityApi.moveTeam).not.toHaveBeenCalled();

      await user.click(within(dialog).getByRole('button', { name: 'Taşı' }));
      await waitFor(() => expect(identityApi.moveTeam).toHaveBeenCalledWith('mob', 'fe'));
      expect(await screen.findByText('Alt ekip taşındı')).toBeInTheDocument();
      expect(onChanged).toHaveBeenCalled();
    });
  });
});
