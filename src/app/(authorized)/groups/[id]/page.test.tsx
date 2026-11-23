import { act, screen, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { GroupAudit } from '@/components/identity/group/GroupAudit';
import { GroupLeaders } from '@/components/identity/group/GroupLeaders';
import { GroupMembers } from '@/components/identity/group/GroupMembers';
import { GroupOverview } from '@/components/identity/group/GroupOverview';
import { GroupRoles } from '@/components/identity/group/GroupRoles';
import { GroupSettings } from '@/components/identity/group/GroupSettings';
import { GroupWorkspace } from '@/components/identity/group/GroupWorkspace';
import { ProblemError } from '@/lib/api/core';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { identityApi } from '@/lib/api/identity';
import { managementMembershipsApi } from '@/lib/api/management-memberships';
import { useAuth } from '@/context/AuthContext';

const mockPush = jest.fn();
let mockPath = '/groups/g1/members';
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'g1' }),
  usePathname: () => mockPath,
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/lib/api/management-memberships', () => ({
  managementMembershipsApi: { list: jest.fn(() => Promise.resolve([])) },
}));

const SECTIONS = {
  overview: GroupOverview,
  members: GroupMembers,
  leaders: GroupLeaders,
  roles: GroupRoles,
  settings: GroupSettings,
  audit: GroupAudit,
} as const;
type Section = keyof typeof SECTIONS;
let section: Section = 'members';

/** The Group's page `which` inside its workspace, as the route renders it. */
function GroupPage({ which = section }: { which?: Section }) {
  const Page = SECTIONS[which];
  mockPath = which === 'overview' ? '/groups/g1' : `/groups/g1/${which}`;
  return (
    <GroupWorkspace>
      <Page />
    </GroupWorkspace>
  );
}

/** Opens a member row's "⋯" menu and picks "Gruptan çıkar". */
async function removeRow(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: `${name}: eylemler` }));
  await user.click(await screen.findByRole('menuitem', { name: 'Gruptan çıkar' }));
}
jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'yk', groups: ['/UYELER/YK'] } })),
}));

jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn() },
}));

beforeEach(() => {
  (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'group.write': true } });
  (identityApi.managedGroups as jest.Mock).mockResolvedValue([]);
  (identityApi.teamLeaders as jest.Mock).mockResolvedValue([]);
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'yk', groups: ['/UYELER/YK'] } });
});

jest.mock('@/lib/api/identity', () => ({
  identityApi: {
    listGroups: jest.fn(),
    listClientRoles: jest.fn(),
    setGroupRoles: jest.fn(),
    updateGroup: jest.fn(),
    deleteGroup: jest.fn(),
    getGroup: jest.fn(),
    members: jest.fn(),
    groupRoles: jest.fn(),
    groupAudit: jest.fn(() => Promise.resolve({ items: [], next: null })),
    memberCandidates: jest.fn(),
    getUser: jest.fn(),
    addMember: jest.fn(),
    memberCheck: jest.fn(),
    removeMember: jest.fn(),
    managedGroups: jest.fn(),
    setTeamSettings: jest.fn(),
    teamLeaders: jest.fn(),
    addTeamLeader: jest.fn(),
    removeTeamLeader: jest.fn(),
    createSubTeam: jest.fn(),
    changeTeamCode: jest.fn(),
    movePreview: jest.fn(),
    moveTeam: jest.fn(),
  },
}));

const NO_WARNING = { privileged: false, ytuLinked: false, warnings: [] };

/** A member-candidates row; `warnings` as core sends them for the Group. */
function candidate(
  id: string,
  firstName: string,
  lastName: string,
  email: string,
  warnings: string[] = [],
) {
  return {
    id,
    firstName,
    lastName,
    email,
    alreadyMember: false,
    ytuLinked: warnings.length === 0,
    warnings,
  };
}

describe('Group detail Üye ekle', () => {
  beforeEach(() => {
    section = 'members';
    jest.clearAllMocks();
    (identityApi.getGroup as jest.Mock).mockResolvedValue({
      id: 'g1',
      name: 'GECEKODU',
      path: '/UYELER/ORGANIZASYON/GECEKODU',
    });
    (identityApi.members as jest.Mock).mockResolvedValue([]);
    (identityApi.groupRoles as jest.Mock).mockResolvedValue([]);
    (identityApi.memberCandidates as jest.Mock).mockResolvedValue([
      candidate('u-ada', 'Ada', 'L', 'a***@example.com'),
    ]);
  });

  it('searches the Group’s member candidates once three characters are typed', async () => {
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    expect(screen.getByText('En az 3 karakter yaz')).toBeInTheDocument();
    const search = screen.getByPlaceholderText('Ad veya tam e-posta');
    await user.type(search, 'ad');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(identityApi.memberCandidates).not.toHaveBeenCalled();
    expect(screen.getByText('En az 3 karakter yaz')).toBeInTheDocument();

    await user.type(search, 'a');
    await waitFor(() => expect(identityApi.memberCandidates).toHaveBeenCalledWith('g1', 'ada'));
    expect(identityApi.memberCandidates).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Ada L')).toBeInTheDocument();
    expect(screen.getByText('a***@example.com')).toBeInTheDocument();
  });

  it('says no one matched in the picker’s words', async () => {
    (identityApi.memberCandidates as jest.Mock).mockResolvedValue([]);
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    await user.type(screen.getByPlaceholderText('Ad veya tam e-posta'), 'zey');
    expect(
      await screen.findByText(
        "Kullanıcı yok. Kişinin önce my.yildizskylab.com'dan kaydolması gerekir.",
      ),
    ).toBeInTheDocument();
  });

  it('leaves out the ones core says are members already', async () => {
    (identityApi.memberCandidates as jest.Mock).mockResolvedValue([
      { ...candidate('u-ada', 'Ada', 'L', 'a***@example.com'), alreadyMember: true },
      candidate('u-cem', 'Cem', 'D', 'c***@example.com'),
    ]);
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    await user.type(screen.getByPlaceholderText('Ad veya tam e-posta'), 'xyz');
    expect(await screen.findByText('Cem D')).toBeInTheDocument();
    expect(screen.queryByText('Ada L')).not.toBeInTheDocument();
  });

  it('marks only the candidates core warns of as not verified with YTÜ', async () => {
    (identityApi.memberCandidates as jest.Mock).mockResolvedValue([
      candidate('u-ada', 'Ada', 'L', 'a***@example.com', ['not_ytu_verified']),
      candidate('u-cem', 'Cem', 'D', 'c***@example.com'),
      // Not linked, but no warning: an ordinary Group, so no mark
      { ...candidate('u-ece', 'Ece', 'K', 'e***@example.com'), ytuLinked: false },
    ]);
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    await user.type(screen.getByPlaceholderText('Ad veya tam e-posta'), 'xyz');
    expect(await screen.findByRole('checkbox', { name: /Ada L/ })).toHaveAccessibleName(
      /YTÜ ile doğrulanmamış/,
    );
    expect(screen.getByRole('checkbox', { name: /Cem D/ })).not.toHaveAccessibleName(
      /YTÜ ile doğrulanmamış/,
    );
    expect(screen.getByRole('checkbox', { name: /Ece K/ })).not.toHaveAccessibleName(
      /YTÜ ile doğrulanmamış/,
    );
    expect(screen.getAllByText('YTÜ ile doğrulanmamış')).toHaveLength(1);
  });
});

describe('Group detail feedback', () => {
  beforeEach(() => {
    section = 'members';
    jest.clearAllMocks();
    (identityApi.getGroup as jest.Mock).mockResolvedValue({
      id: 'g1',
      name: 'GECEKODU',
      path: '/UYELER/ORGANIZASYON/GECEKODU',
    });
    (identityApi.members as jest.Mock)
      .mockReset()
      .mockResolvedValue([
        { id: 'u-bora', email: 'bora@example.com', firstName: 'Bora', lastName: 'D' },
      ]);
    (identityApi.groupRoles as jest.Mock).mockResolvedValue([]);
    (identityApi.memberCandidates as jest.Mock).mockResolvedValue([
      candidate('u-ada', 'Ada', 'L', 'a***@example.com'),
    ]);
    (identityApi.memberCheck as jest.Mock).mockResolvedValue(NO_WARNING);
  });

  it('says the member was added', async () => {
    const user = userEvent.setup();
    (identityApi.addMember as jest.Mock).mockResolvedValue(undefined);
    render(<GroupPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    await user.type(screen.getByPlaceholderText('Ad veya tam e-posta'), 'ada');
    await user.click(await screen.findByRole('checkbox', { name: /Ada L/ }));
    await user.click(screen.getByRole('button', { name: 'Seçilenleri ekle' }));
    await waitFor(() => expect(identityApi.addMember).toHaveBeenCalledWith('g1', 'u-ada'));
    expect(await screen.findByText('Üye eklendi')).toBeInTheDocument();
  });

  it('shows an add-member error inside the open picker', async () => {
    const user = userEvent.setup();
    (identityApi.addMember as jest.Mock).mockRejectedValue(
      new ProblemError(403, 'Forbidden', { detail: 'missing role' }),
    );
    render(<GroupPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Üye ekle' });
    await user.type(within(dialog).getByPlaceholderText('Ad veya tam e-posta'), 'ada');
    await user.click(await within(dialog).findByRole('checkbox', { name: /Ada L/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Seçilenleri ekle' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Bu işlem için yetkin yok.');
  });

  it('keeps picks across searches, submits once in order and retries only failures', async () => {
    const user = userEvent.setup();
    let finishFirst!: () => void;
    const first = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    (identityApi.memberCandidates as jest.Mock).mockImplementation(
      (_groupId: string, query: string) =>
        Promise.resolve(
          query === 'ada'
            ? [candidate('u-ada', 'Ada', 'L', 'a***@example.com')]
            : [candidate('u-cem', 'Cem', 'D', 'c***@example.com')],
        ),
    );
    (identityApi.addMember as jest.Mock)
      .mockImplementationOnce(() => first)
      .mockRejectedValueOnce(new ProblemError(403, 'Forbidden'))
      .mockResolvedValueOnce(undefined);
    render(<GroupPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Üye ekle' });
    const search = within(dialog).getByPlaceholderText('Ad veya tam e-posta');
    await user.type(search, 'ada');
    await user.click(await within(dialog).findByRole('checkbox', { name: /Ada L/ }));
    await user.clear(search);
    await user.type(search, 'cem');
    await user.click(await within(dialog).findByRole('checkbox', { name: /Cem D/ }));
    expect(within(dialog).getByText('2 kişi seçildi')).toBeInTheDocument();
    expect(identityApi.addMember).not.toHaveBeenCalled();
    await user.dblClick(within(dialog).getByRole('button', { name: 'Seçilenleri ekle' }));
    expect(identityApi.addMember).toHaveBeenCalledTimes(1);
    expect(search).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(dialog).toBeInTheDocument();
    await act(async () => finishFirst());
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Cem D:');
    expect(within(dialog).getByText('1 kişi seçildi')).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Ada L seçimini kaldır' }),
    ).not.toBeInTheDocument();
    expect(identityApi.members).toHaveBeenCalledTimes(2);
    await user.click(within(dialog).getByRole('button', { name: 'Seçilenleri ekle' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Üye ekle' })).not.toBeInTheDocument(),
    );
    expect((identityApi.addMember as jest.Mock).mock.calls).toEqual([
      ['g1', 'u-ada'],
      ['g1', 'u-cem'],
      ['g1', 'u-cem'],
    ]);
  });

  it('allows adding a member again after removing them on the same page', async () => {
    const user = userEvent.setup();
    const ada = { id: 'u-ada', email: 'ada@example.com', firstName: 'Ada', lastName: 'L' };
    (identityApi.members as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([ada])
      .mockResolvedValue([]);
    (identityApi.addMember as jest.Mock).mockReset().mockResolvedValue(undefined);
    (identityApi.removeMember as jest.Mock).mockResolvedValue(undefined);
    render(<GroupPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    await user.type(screen.getByPlaceholderText('Ad veya tam e-posta'), 'ada');
    await user.click(await screen.findByRole('checkbox', { name: /Ada L/ }));
    await user.click(screen.getByRole('button', { name: 'Seçilenleri ekle' }));
    await removeRow(user, 'Ada L');
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Gruptan çıkar' }),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Üye ekle' }));
    await user.type(screen.getByPlaceholderText('Ad veya tam e-posta'), 'ada');
    await user.click(await screen.findByRole('checkbox', { name: /Ada L/ }));
    await user.click(screen.getByRole('button', { name: 'Seçilenleri ekle' }));
    await waitFor(() => expect(identityApi.addMember).toHaveBeenCalledTimes(2));
  });

  it('says the member was removed', async () => {
    const user = userEvent.setup();
    (identityApi.removeMember as jest.Mock).mockResolvedValue(undefined);
    render(<GroupPage />);
    await removeRow(user, 'Bora D');
    const confirm = await screen.findByRole('alertdialog', {
      name: 'Bora D GECEKODU grubundan çıkarılsın mı?',
    });
    expect(confirm).toHaveTextContent('Bu ona e-postayla bildirilir.');
    expect(confirm).toHaveTextContent(
      'Yönetim gruplarındaki değişiklik ayrıca yöneticilere bildirilir.',
    );
    expect(confirm).not.toHaveTextContent('ekibin grubu');
    expect(identityApi.removeMember).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Gruptan çıkar' }));
    await waitFor(() => expect(identityApi.removeMember).toHaveBeenCalledWith('g1', 'u-bora'));
    expect(await screen.findByText('Üye çıkarıldı')).toBeInTheDocument();
  });
});

describe('Group detail unverified account warning', () => {
  const UNVERIFIED = { privileged: true, ytuLinked: false, warnings: ['not_ytu_verified'] };

  beforeEach(() => {
    section = 'members';
    jest.clearAllMocks();
    (identityApi.getGroup as jest.Mock).mockResolvedValue({
      id: 'g1',
      name: 'YK',
      path: '/UYELER/YK',
    });
    (identityApi.members as jest.Mock).mockResolvedValue([]);
    (identityApi.groupRoles as jest.Mock).mockResolvedValue([]);
    (identityApi.memberCandidates as jest.Mock).mockImplementation(
      (_groupId: string, query: string) =>
        Promise.resolve(
          query === 'cem'
            ? [candidate('u-cem', 'Cem', 'D', 'c***@example.com')]
            : query === 'ada@example.com'
              ? [candidate('u-ada', 'Ada', 'L', 'ada@example.com', ['not_ytu_verified'])]
              : [candidate('u-ada', 'Ada', 'L', 'a***@example.com', ['not_ytu_verified'])],
        ),
    );
    (identityApi.getUser as jest.Mock).mockImplementation((userId: string) =>
      Promise.resolve(
        userId === 'u-cem'
          ? { id: 'u-cem', email: 'cem@example.com', firstName: 'Cem', lastName: 'D' }
          : { id: 'u-ada', email: 'ada@example.com', firstName: 'Ada', lastName: 'L' },
      ),
    );
    (identityApi.addMember as jest.Mock).mockResolvedValue(undefined);
  });

  async function select(user: ReturnType<typeof userEvent.setup>, query: string, name: RegExp) {
    const drawer = await screen.findByRole('dialog', { name: 'Üye ekle' });
    const search = within(drawer).getByPlaceholderText('Ad veya tam e-posta');
    await user.clear(search);
    await user.type(search, query);
    await user.click(await within(drawer).findByRole('checkbox', { name }));
  }

  async function addAda() {
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    await select(user, 'ada', /Ada L/);
    await user.click(screen.getByRole('button', { name: 'Seçilenleri ekle' }));
    return user;
  }

  it('warns before adding an account not verified with YTÜ to a Privileged group, and adds once confirmed', async () => {
    (identityApi.memberCheck as jest.Mock).mockResolvedValue(UNVERIFIED);
    const user = await addAda();
    const warning = await screen.findByRole('alertdialog', {
      name: 'Ada L YK grubuna eklensin mi?',
    });
    expect(identityApi.memberCheck).toHaveBeenCalledWith('g1', 'u-ada');
    // The search masked the address, so the person's card names it whole
    expect(identityApi.getUser).toHaveBeenCalledWith('u-ada');
    expect(warning).toHaveTextContent(
      'Bu hesap YTÜ hesabıyla doğrulanmamış. Yönetim yetkisi vermeden önce e-posta adresinin (ada@example.com) bu kişiye ait olduğunu kontrol et.',
    );
    expect(identityApi.addMember).not.toHaveBeenCalled();
    await user.click(within(warning).getByRole('button', { name: 'Gruba ekle' }));
    await waitFor(() =>
      expect(identityApi.addMember).toHaveBeenCalledWith('g1', 'u-ada', { unverifiedAck: true }),
    );
    expect(await screen.findByText('Üye eklendi')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Üye ekle' })).not.toBeInTheDocument(),
    );
  });

  it('adds nobody and keeps the selection when the warning is turned down', async () => {
    (identityApi.memberCheck as jest.Mock).mockResolvedValue(UNVERIFIED);
    const user = await addAda();
    const warning = await screen.findByRole('alertdialog', {
      name: 'Ada L YK grubuna eklensin mi?',
    });
    await user.click(within(warning).getByRole('button', { name: 'Vazgeç' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(identityApi.addMember).not.toHaveBeenCalled();
    const drawer = screen.getByRole('dialog', { name: 'Üye ekle' });
    expect(within(drawer).getByText('1 kişi seçildi')).toBeInTheDocument();
  });

  it('adds a YTÜ-linked account to a Privileged group without a question', async () => {
    (identityApi.memberCheck as jest.Mock).mockResolvedValue({
      privileged: true,
      ytuLinked: true,
      warnings: [],
    });
    await addAda();
    await waitFor(() => expect(identityApi.addMember).toHaveBeenCalledWith('g1', 'u-ada'));
    expect(identityApi.memberCheck).toHaveBeenCalledWith('g1', 'u-ada');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Üye eklendi')).toBeInTheDocument();
  });

  it('adds an unverified account to an ordinary group without a question', async () => {
    (identityApi.memberCheck as jest.Mock).mockResolvedValue(NO_WARNING);
    await addAda();
    await waitFor(() => expect(identityApi.addMember).toHaveBeenCalledWith('g1', 'u-ada'));
    expect(identityApi.memberCheck).toHaveBeenCalledWith('g1', 'u-ada');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks once for a selection, names only the unverified, and acknowledges only them', async () => {
    (identityApi.memberCheck as jest.Mock).mockImplementation((_groupId: string, userId: string) =>
      Promise.resolve(
        userId === 'u-ada' ? UNVERIFIED : { privileged: true, ytuLinked: true, warnings: [] },
      ),
    );
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    await select(user, 'ada', /Ada L/);
    await select(user, 'cem', /Cem D/);
    await user.click(screen.getByRole('button', { name: 'Seçilenleri ekle' }));
    const warning = await screen.findByRole('alertdialog', {
      name: '2 kişi YK grubuna eklensin mi?',
    });
    expect(warning).toHaveTextContent(
      "2 kişiden 1'i YTÜ ile doğrulanmamış: Ada L (ada@example.com). E-posta adresini kontrol et.",
    );
    expect(warning).not.toHaveTextContent('Cem D');
    expect(identityApi.addMember).not.toHaveBeenCalled();
    await user.click(within(warning).getByRole('button', { name: 'Gruba ekle' }));
    expect(await screen.findByText('2 üye eklendi')).toBeInTheDocument();
    expect((identityApi.addMember as jest.Mock).mock.calls).toEqual([
      ['g1', 'u-ada', { unverifiedAck: true }],
      ['g1', 'u-cem'],
    ]);
  });

  it('says a refused add inside the question once confirmed', async () => {
    (identityApi.memberCheck as jest.Mock).mockResolvedValue(UNVERIFIED);
    (identityApi.addMember as jest.Mock).mockRejectedValue(new Error('boom'));
    const user = await addAda();
    const warning = await screen.findByRole('alertdialog', {
      name: 'Ada L YK grubuna eklensin mi?',
    });
    await user.click(within(warning).getByRole('button', { name: 'Gruba ekle' }));
    expect(await within(warning).findByRole('alert')).toHaveTextContent('Ada L: Üye eklenemedi');
    expect(identityApi.addMember).toHaveBeenCalledWith('g1', 'u-ada', { unverifiedAck: true });
    expect(screen.queryByText('Üye eklendi')).not.toBeInTheDocument();
    // Said once, in the question, not again in the drawer under it
    expect(screen.getAllByText(/Üye eklenemedi/)).toHaveLength(1);
  });

  it('retries from the question only the ones core refused', async () => {
    (identityApi.memberCheck as jest.Mock).mockImplementation((_groupId: string, userId: string) =>
      Promise.resolve(
        userId === 'u-ada' ? UNVERIFIED : { privileged: true, ytuLinked: true, warnings: [] },
      ),
    );
    (identityApi.addMember as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    await select(user, 'ada', /Ada L/);
    await select(user, 'cem', /Cem D/);
    await user.click(screen.getByRole('button', { name: 'Seçilenleri ekle' }));
    const warning = await screen.findByRole('alertdialog', {
      name: '2 kişi YK grubuna eklensin mi?',
    });
    await user.click(within(warning).getByRole('button', { name: 'Gruba ekle' }));
    expect(await within(warning).findByRole('alert')).toHaveTextContent('Cem D: Üye eklenemedi');
    expect(await screen.findByText('Üye eklendi')).toBeInTheDocument();
    // The retry's question names only Cem, who is verified: no YTÜ text is left
    expect(screen.getByRole('alertdialog', { name: 'Cem D YK grubuna eklensin mi?' })).toBe(
      warning,
    );
    expect(warning).not.toHaveTextContent('Ada L');
    expect(warning).not.toHaveTextContent('YTÜ');
    expect(screen.getAllByText(/Üye eklenemedi/)).toHaveLength(1);
    await user.click(within(warning).getByRole('button', { name: 'Gruba ekle' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Üye ekle' })).not.toBeInTheDocument(),
    );
    expect((identityApi.addMember as jest.Mock).mock.calls).toEqual([
      ['g1', 'u-ada', { unverifiedAck: true }],
      ['g1', 'u-cem'],
      ['g1', 'u-cem'],
    ]);
  });

  it('keeps the picker open while the check runs and asks once it answers', async () => {
    let answer: (check: unknown) => void = () => undefined;
    (identityApi.memberCheck as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const user = await addAda();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Üye ekle' })).toBeInTheDocument();
    await act(async () => {
      answer(UNVERIFIED);
    });
    expect(
      await screen.findByRole('alertdialog', { name: 'Ada L YK grubuna eklensin mi?' }),
    ).toBeInTheDocument();
    expect(identityApi.addMember).not.toHaveBeenCalled();
  });

  it('ignores a second submission while the check runs', async () => {
    let answer: (check: unknown) => void = () => undefined;
    (identityApi.memberCheck as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    await select(user, 'ada', /Ada L/);
    await user.dblClick(screen.getByRole('button', { name: 'Seçilenleri ekle' }));
    await act(async () => {
      answer(NO_WARNING);
    });
    expect(await screen.findByText('Üye eklendi')).toBeInTheDocument();
    expect(identityApi.memberCheck).toHaveBeenCalledTimes(1);
    expect(identityApi.addMember).toHaveBeenCalledTimes(1);
  });

  it('names every unverified one with a count, and only the ones left after a refusal', async () => {
    (identityApi.memberCheck as jest.Mock).mockResolvedValue(UNVERIFIED);
    (identityApi.addMember as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    await select(user, 'ada', /Ada L/);
    await select(user, 'cem', /Cem D/);
    await user.click(screen.getByRole('button', { name: 'Seçilenleri ekle' }));
    const warning = await screen.findByRole('alertdialog', {
      name: '2 kişi YK grubuna eklensin mi?',
    });
    expect(warning).toHaveTextContent(
      "2 kişiden 2'si YTÜ ile doğrulanmamış: Ada L (ada@example.com), Cem D (cem@example.com). E-posta adreslerini kontrol et.",
    );
    await user.click(within(warning).getByRole('button', { name: 'Gruba ekle' }));
    expect(await within(warning).findByRole('alert')).toHaveTextContent('Cem D: Üye eklenemedi');
    expect(screen.getByRole('alertdialog', { name: 'Cem D YK grubuna eklensin mi?' })).toBe(
      warning,
    );
    expect(warning).toHaveTextContent(
      'Bu hesap YTÜ hesabıyla doğrulanmamış. Yönetim yetkisi vermeden önce e-posta adresinin (cem@example.com) bu kişiye ait olduğunu kontrol et.',
    );
    expect(warning).not.toHaveTextContent('Ada L');
    await user.click(within(warning).getByRole('button', { name: 'Gruba ekle' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Üye ekle' })).not.toBeInTheDocument(),
    );
    expect((identityApi.addMember as jest.Mock).mock.calls).toEqual([
      ['g1', 'u-ada', { unverifiedAck: true }],
      ['g1', 'u-cem', { unverifiedAck: true }],
      ['g1', 'u-cem', { unverifiedAck: true }],
    ]);
  });

  it('names the address as typed when the reader searched it whole', async () => {
    (identityApi.memberCheck as jest.Mock).mockResolvedValue(UNVERIFIED);
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    await select(user, 'ada@example.com', /Ada L/);
    await user.click(screen.getByRole('button', { name: 'Seçilenleri ekle' }));
    const warning = await screen.findByRole('alertdialog', {
      name: 'Ada L YK grubuna eklensin mi?',
    });
    expect(warning).toHaveTextContent('e-posta adresinin (ada@example.com)');
    expect(identityApi.getUser).not.toHaveBeenCalled();
  });

  it('names the masked address when the person’s card cannot be read', async () => {
    (identityApi.memberCheck as jest.Mock).mockResolvedValue(UNVERIFIED);
    (identityApi.getUser as jest.Mock).mockRejectedValue(new ProblemError(403, 'Forbidden'));
    await addAda();
    const warning = await screen.findByRole('alertdialog', {
      name: 'Ada L YK grubuna eklensin mi?',
    });
    expect(warning).toHaveTextContent('e-posta adresinin (a***@example.com)');
  });

  it('checks at most three of a selection at once', async () => {
    const people = ['Ada', 'Cem', 'Ece', 'Can', 'Naz'].map((name, index) =>
      candidate(`u-${index}`, name, 'K', `${name[0]!.toLowerCase()}***@example.com`),
    );
    (identityApi.memberCandidates as jest.Mock).mockResolvedValue(people);
    let inFlight = 0;
    let most = 0;
    (identityApi.memberCheck as jest.Mock).mockImplementation(async () => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return NO_WARNING;
    });
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    await user.type(screen.getByPlaceholderText('Ad veya tam e-posta'), 'xyz');
    for (const person of people) {
      await user.click(
        await screen.findByRole('checkbox', { name: new RegExp(`${person.firstName} K`) }),
      );
    }
    await user.click(screen.getByRole('button', { name: 'Seçilenleri ekle' }));
    expect(await screen.findByText('5 üye eklendi')).toBeInTheDocument();
    expect(identityApi.memberCheck).toHaveBeenCalledTimes(5);
    expect(most).toBe(3);
  });

  it('still adds, without a warning, when the check cannot be read', async () => {
    const failure = new TypeError('Failed to fetch');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (identityApi.memberCheck as jest.Mock).mockRejectedValue(failure);
    await addAda();
    await waitFor(() => expect(identityApi.addMember).toHaveBeenCalledWith('g1', 'u-ada'));
    expect(identityApi.memberCheck).toHaveBeenCalledWith('g1', 'u-ada');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Üye eklendi')).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(failure);
    warn.mockRestore();
  });
});

describe('Group detail role mapping', () => {
  function group(path: string) {
    const name = path.split('/').pop() ?? path;
    (identityApi.getGroup as jest.Mock).mockResolvedValue({ id: 'g1', name, path });
  }

  beforeEach(() => {
    section = 'roles';
    jest.clearAllMocks();
    (identityApi.members as jest.Mock).mockResolvedValue([]);
    (identityApi.groupRoles as jest.Mock).mockResolvedValue([
      { clientId: 'forms', role: 'skyforms:access' },
    ]);
    (identityApi.listGroups as jest.Mock).mockResolvedValue([]);
    (identityApi.listClientRoles as jest.Mock).mockResolvedValue([
      { clientId: 'forms', role: 'skyforms:access' },
      { clientId: 'skymail', role: 'system-mails:read' },
    ]);
  });

  it('offers no new role on a Team, says where roles go, and still removes one', async () => {
    group('/UYELER/ARGE/WEBLAB');
    render(<GroupPage />);
    expect(await screen.findByText(/Ekip ya da alt ekip grubuna rol verilmez/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rol ekle' })).not.toBeInTheDocument();
    const roles = document.body;
    expect(within(roles).getByRole('button', { name: 'Kaldır' })).toBeInTheDocument();
  });

  it('sends a Team’s app roles to Uygulamalar once core’s app assignments are on', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'group.write': true, 'apps.read': true },
    });
    for (const path of ['/UYELER/ARGE/WEBLAB', '/UYELER/ARGE/WEBLAB/FRONT/LIDERLER']) {
      group(path);
      const { unmount } = render(<GroupPage />);
      const link = await screen.findByRole('link', { name: 'Uygulamalar' });
      expect(link).toHaveAttribute('href', '/apps');
      expect(screen.queryByRole('button', { name: 'Rol ekle' })).not.toBeInTheDocument();
      const roles = document.body;
      expect(within(roles).getByText('skyforms:access')).toBeInTheDocument();
      expect(within(roles).queryByRole('button', { name: 'Kaldır' })).not.toBeInTheDocument();
      expect(within(roles).getByText(/yönetici rolleri buradan değişmez/)).toBeInTheDocument();
      unmount();
    }
  });

  it('keeps a Privileged root’s roles on the Groups page with app assignments on', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'group.write': true, 'apps.read': true },
    });
    group('/UYELER/YK');
    render(<GroupPage />);
    expect(await screen.findByRole('button', { name: 'Rol ekle' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Uygulamalar' })).not.toBeInTheDocument();
  });

  it('offers a new role on a role group under /ROLLER with nothing under it', async () => {
    group('/ROLLER/SKYMAIL-OKUR');
    (identityApi.listGroups as jest.Mock).mockResolvedValue([
      { id: 'g1', name: 'SKYMAIL-OKUR', path: '/ROLLER/SKYMAIL-OKUR' },
    ]);
    render(<GroupPage />);
    expect(await screen.findByRole('button', { name: 'Rol ekle' })).toBeInTheDocument();
  });

  it('offers no new role on a role group with groups under it', async () => {
    group('/ROLLER/SKYMAIL-OKUR');
    (identityApi.listGroups as jest.Mock).mockResolvedValue([
      { id: 'g1', name: 'SKYMAIL-OKUR', path: '/ROLLER/SKYMAIL-OKUR' },
      { id: 'g2', name: 'ALT', path: '/ROLLER/SKYMAIL-OKUR/ALT' },
    ]);
    render(<GroupPage />);
    expect(await screen.findByText(/Altında grup olan rol grubuna/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rol ekle' })).not.toBeInTheDocument();
  });

  it('says a refused placement and a Keycloak admin role in Turkish inside the picker', async () => {
    const user = userEvent.setup();
    group('/UYELER/ARGE/WEBLAB/LIDERLER');
    (identityApi.setGroupRoles as jest.Mock)
      .mockRejectedValueOnce(
        new ProblemError(409, 'Conflict', {
          code: 'role_placement',
          detail: 'A Team or Sub-team takes no role',
          fields: { reason: 'sub_team_leader_group' },
        }),
      )
      .mockRejectedValueOnce(
        new ProblemError(403, 'Forbidden', {
          code: 'keycloak_admin_role',
          detail: 'realm-management',
        }),
      );
    render(<GroupPage />);
    await user.click(await screen.findByRole('button', { name: 'Rol ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rol ekle' });
    await user.click(await within(dialog).findByRole('button', { name: /system-mails:read/ }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Alt ekibin lider grubuna rol verilmez',
    );
    await user.click(within(dialog).getByRole('button', { name: /system-mails:read/ }));
    await waitFor(() =>
      expect(within(dialog).getByRole('alert')).toHaveTextContent(
        'hesap sisteminin yönetim yetkisini',
      ),
    );
    expect(dialog).not.toHaveTextContent(/takes no role|realm-management/);
    expect(identityApi.setGroupRoles).toHaveBeenCalledWith('g1', [
      { clientId: 'forms', role: 'skyforms:access' },
      { clientId: 'skymail', role: 'system-mails:read' },
    ]);
  });

  it('shows no "Rol ekle" on a role group before its subgroups are known', async () => {
    group('/ROLLER/SKYMAIL-OKUR');
    let answer: (rows: unknown[]) => void = () => undefined;
    (identityApi.listGroups as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    render(<GroupPage />);
    expect(await screen.findByText('skyforms:access')).toBeInTheDocument();
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Rol ekle' })).not.toBeInTheDocument();
    await act(async () => {
      answer([
        { id: 'g1', name: 'SKYMAIL-OKUR', path: '/ROLLER/SKYMAIL-OKUR' },
        { id: 'g2', name: 'ALT', path: '/ROLLER/SKYMAIL-OKUR/ALT' },
      ]);
    });
    expect(await screen.findByText(/Altında grup olan rol grubuna/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rol ekle' })).not.toBeInTheDocument();
  });

  it('explains only the rule on a refused place that maps no role', async () => {
    group('/UYELER/ARGE');
    (identityApi.groupRoles as jest.Mock).mockResolvedValue([]);
    render(<GroupPage />);
    const rule = await screen.findByText(/Alan grubuna rol verilmez/);
    expect(rule).not.toHaveTextContent('yalnız kaldırılabilir');
  });

  it('says the roles would land in a refused place when a rename is refused', async () => {
    const user = userEvent.setup();
    group('/UYELER/ARGE/WEBLAB/LIDERLER');
    (identityApi.updateGroup as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', {
        code: 'role_placement',
        detail: 'A Team or Sub-team takes no role',
        fields: { reason: 'team' },
      }),
    );
    render(<GroupPage which="settings" />);
    const name = await screen.findByLabelText('Grup kodu');
    await user.clear(name);
    await user.type(name, 'FRONTEND');
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Yeni adla bu gruptaki roller kurala aykırı bir yere düşerdi: Ekip ya da alt ekip grubuna rol verilmez',
    );
    expect(alert).toHaveTextContent('LIDERLER ya da KOORDINATORLER');
  });

  it('falls back to the group rule when the capabilities cannot be read', async () => {
    (capabilitiesApi.get as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'u', groups: ['/UYELER/ARGE/WEBLAB'] } });
    group('/UYELER/YK');
    render(<GroupPage />);
    expect(await screen.findByText('skyforms:access')).toBeInTheDocument();
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Rol ekle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Üye ekle' })).not.toBeInTheDocument();
  });

  it('shows a DK member the group without a write button', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'group.write': false } });
    group('/UYELER/YK');
    (identityApi.members as jest.Mock).mockResolvedValue([
      { id: 'u-bora', email: 'bora@example.com', firstName: 'Bora', lastName: 'D' },
    ]);
    const roles = render(<GroupPage which="roles" />);
    expect(await screen.findByText('skyforms:access')).toBeInTheDocument();
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    for (const name of ['Üye ekle', 'Rol ekle', 'Kaldır']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    roles.unmount();
    const members = render(<GroupPage which="members" />);
    expect((await screen.findAllByText('Bora D')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Üye ekle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bora D: eylemler' })).not.toBeInTheDocument();
    members.unmount();
    render(<GroupPage which="settings" />);
    expect(await screen.findByLabelText('Grup kodu')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Grubu sil' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Göster/ })).not.toBeInTheDocument();
  });
});

describe('Group deletion', () => {
  beforeEach(() => {
    section = 'settings';
    jest.clearAllMocks();
    (identityApi.getGroup as jest.Mock).mockResolvedValue({
      id: 'g1',
      name: 'TANISMAYEMEGIGRUBU',
      path: '/TANISMAYEMEGIGRUBU',
    });
    (identityApi.members as jest.Mock).mockResolvedValue([]);
    (identityApi.groupRoles as jest.Mock).mockResolvedValue([]);
    (identityApi.deleteGroup as jest.Mock).mockResolvedValue(undefined);
  });

  it('requires confirmation and returns to the group list only after success', async () => {
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await screen.findByRole('button', { name: 'Grubu sil' }));
    expect(identityApi.deleteGroup).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('alertdialog', {
      name: 'TANISMAYEMEGIGRUBU silinsin mi?',
    });
    expect(dialog).toHaveTextContent('geri alınamaz');
    await user.click(within(dialog).getByRole('button', { name: 'Grubu sil' }));
    await waitFor(() => expect(identityApi.deleteGroup).toHaveBeenCalledWith('g1'));
    expect(mockPush).toHaveBeenCalledWith('/groups');
    expect(await screen.findByText('Grup silindi')).toBeInTheDocument();
  });

  it.each([
    ['not_empty', 'Önce grubun üyelerini ve alt gruplarını taşı veya çıkar.'],
    ['code_in_use', 'Bu gruba bağlı kayıtlar var; grup silinemez.'],
    ['group_delete_protected', 'Bu sistem veya rol grubu buradan silinemez.'],
    ['protected_group', 'Bu grup veya üst grubu korunan roller taşıyor; buradan silinemez.'],
  ])('keeps a %s refusal in the dialog without leaving or cascading', async (code, message) => {
    (identityApi.deleteGroup as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { code }),
    );
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await screen.findByRole('button', { name: 'Grubu sil' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Grubu sil' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
    expect(mockPush).not.toHaveBeenCalled();
    expect(identityApi.removeMember).not.toHaveBeenCalled();
    expect(identityApi.setGroupRoles).not.toHaveBeenCalled();
  });

  it('does not offer deletion without core group.write', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'group.write': false } });
    render(<GroupPage />);
    await screen.findByText('TANISMAYEMEGIGRUBU', { selector: 'h1' });
    expect(screen.queryByRole('button', { name: 'Grubu sil' })).not.toBeInTheDocument();
  });
});

describe('Group detail for a Team Leader (Ekiplerim, ticket 08)', () => {
  const leader = { user: { id: 'lead', groups: ['/UYELER/ARGE/WEBLAB/LIDERLER'] } };
  const forbidden = new ProblemError(403, 'Forbidden');
  const members = [
    {
      id: 'u-ada',
      firstName: 'Ada',
      lastName: 'L',
      email: 'ada@example.com',
      sourceGroupPath: '/UYELER/ARGE/WEBLAB',
    },
    {
      id: 'u-lead',
      firstName: 'Lider',
      lastName: 'K',
      email: 'lider@example.com',
      sourceGroupPath: '/UYELER/ARGE/WEBLAB/LIDERLER',
    },
  ];

  beforeEach(() => {
    section = 'members';
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue(leader);
    (identityApi.getGroup as jest.Mock).mockResolvedValue({
      id: 'g1',
      name: 'WEBLAB',
      path: '/UYELER/ARGE/WEBLAB',
    });
    (identityApi.members as jest.Mock).mockResolvedValue(members);
    (identityApi.groupRoles as jest.Mock).mockRejectedValue(forbidden);
  });

  it('adds and removes members of a Team core says the Leader manages, not a Leader group row', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'group.write': false },
      managedTeams: [{ id: 'g1', path: '/UYELER/ARGE/WEBLAB', code: 'WEBLAB' }],
    });
    (identityApi.managedGroups as jest.Mock).mockResolvedValue([
      { id: 'g1', code: 'WEBLAB', path: '/UYELER/ARGE/WEBLAB', can: { 'members.write': true } },
    ]);
    render(<GroupPage />);
    expect(await screen.findByRole('button', { name: 'Üye ekle' })).toBeInTheDocument();
    // Ada's row has its menu; the Leader group's own row (Lider K) has none
    expect(screen.getAllByText('Lider K').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /: eylemler$/ })).toHaveLength(1);
    // The role mappings are Privileged's: no section, no error
    expect(screen.queryByText('Uygulama rolleri')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Grubu sil' })).toBeNull();
  });

  it('opens no person card a Leader without users:read could not read', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'group.write': false, 'user.read': false },
      managedTeams: [{ id: 'g1', path: '/UYELER/ARGE/WEBLAB', code: 'WEBLAB' }],
    });
    (identityApi.managedGroups as jest.Mock).mockResolvedValue([
      { id: 'g1', code: 'WEBLAB', path: '/UYELER/ARGE/WEBLAB', can: { 'members.write': true } },
    ]);
    render(<GroupPage />);
    expect(await screen.findByRole('button', { name: 'Üye ekle' })).toBeInTheDocument();
    expect(screen.getAllByText('Ada L').length).toBeGreaterThan(0);
    expect(document.querySelector('a[href="/users/u-ada"]')).toBeNull();
  });

  it('links the rows to the person cards for someone core lets read people', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'yk', groups: ['/UYELER/YK'] } });
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'group.write': true, 'user.read': true },
    });
    (identityApi.groupRoles as jest.Mock).mockResolvedValue([]);
    render(<GroupPage />);
    await waitFor(() => expect(document.querySelector('a[href="/users/u-ada"]')).not.toBeNull());
  });

  it('shows no write button when core names no managed Team', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: {}, managedTeams: [] });
    render(<GroupPage />);
    expect((await screen.findAllByText('Ada L')).length).toBeGreaterThan(0);
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Üye ekle' })).toBeNull();
    expect(screen.queryByRole('button', { name: /: eylemler$/ })).toBeNull();
    expect(identityApi.managedGroups).not.toHaveBeenCalled();
  });

  it('shows no write button for a Team the tree does not allow', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: {},
      managedTeams: [{ id: 'g-other', path: '/UYELER/ARGE/GAMELAB', code: 'GAMELAB' }],
    });
    (identityApi.managedGroups as jest.Mock).mockResolvedValue([
      {
        id: 'g-other',
        code: 'GAMELAB',
        path: '/UYELER/ARGE/GAMELAB',
        can: { 'members.write': true },
      },
    ]);
    render(<GroupPage />);
    expect((await screen.findAllByText('Ada L')).length).toBeGreaterThan(0);
    await waitFor(() => expect(identityApi.managedGroups).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Üye ekle' })).toBeNull();
  });
});

describe('Group detail: the retired competitor setting', () => {
  const weblab = (attributes?: Record<string, string>) => ({
    id: 'g1',
    name: 'WEBLAB',
    path: '/UYELER/ARGE/WEBLAB',
    attributes,
  });

  beforeEach(() => {
    section = 'settings';
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'yk', groups: ['/UYELER/YK'] } });
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'group.write': true } });
    (identityApi.members as jest.Mock).mockResolvedValue([]);
    (identityApi.groupRoles as jest.Mock).mockResolvedValue([]);
  });

  it('offers no switch for it and lists an older core’s value as no extra attribute', async () => {
    (identityApi.getGroup as jest.Mock).mockResolvedValue(
      weblab({ members_manage_competitors: 'false' }),
    );
    render(<GroupPage />);
    expect(
      await screen.findByRole('radiogroup', { name: 'Yarışmaları kim yönetir' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /yarışmacı/ })).toBeNull();
    expect(screen.queryByText(/Üyeler yarışmacı ekleyip düzenleyebilir/)).toBeNull();
    expect(screen.queryByText('members_manage_competitors')).toBeNull();
  });

  async function typeExtra(user: ReturnType<typeof userEvent.setup>, key: string) {
    await user.click(await screen.findByRole('button', { name: /Göster/ }));
    await user.click(screen.getByRole('button', { name: 'Öznitelik ekle' }));
    await user.type(screen.getByLabelText('Anahtar'), key);
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
  }

  it('refuses it as an extra attribute', async () => {
    (identityApi.getGroup as jest.Mock).mockResolvedValue(weblab());
    const user = userEvent.setup();
    render(<GroupPage />);
    await typeExtra(user, 'members_manage_competitors');
    expect(await screen.findByRole('alert')).toHaveTextContent('bu ayar kaldırıldı.');
    expect(identityApi.updateGroup).not.toHaveBeenCalled();
  });

  it('points to Yarışmalar when Privileged types a Team setting as an extra attribute', async () => {
    (identityApi.getGroup as jest.Mock).mockResolvedValue(weblab());
    const user = userEvent.setup();
    render(<GroupPage />);
    await typeExtra(user, 'team_competition_manage');
    expect(await screen.findByRole('alert')).toHaveTextContent('bu ayar Yarışmalar bölümünde.');
    expect(identityApi.updateGroup).not.toHaveBeenCalled();
  });

  it('keeps the Team setting and the retired value on a save of the other fields', async () => {
    (identityApi.getGroup as jest.Mock).mockResolvedValue(
      weblab({ team_competition_manage: 'true', members_manage_competitors: 'false', x: '1' }),
    );
    (identityApi.updateGroup as jest.Mock).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.type(await screen.findByLabelText('Görünen ad (Türkçe)'), 'Web');
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() =>
      expect(identityApi.updateGroup).toHaveBeenCalledWith('g1', {
        name: 'WEBLAB',
        attributes: {
          team_competition_manage: 'true',
          members_manage_competitors: 'false',
          x: '1',
          display_name_tr: 'Web',
        },
      }),
    );
    expect(identityApi.setTeamSettings).not.toHaveBeenCalled();
  });

  it('shows no Team settings on a Leader group', async () => {
    (identityApi.getGroup as jest.Mock).mockResolvedValue({
      id: 'g1',
      name: 'LIDERLER',
      path: '/UYELER/ARGE/WEBLAB/LIDERLER',
    });
    render(<GroupPage />);
    expect((await screen.findAllByText('LIDERLER')).length).toBeGreaterThan(0);
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(screen.queryByRole('radiogroup', { name: 'Yarışmaları kim yönetir' })).toBeNull();
  });
});

describe('Group detail: who manages the Team’s Competitions (yarışma 27)', () => {
  beforeAll(() => {
    if (typeof window.PointerEvent === 'undefined') {
      Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
    }
  });

  const weblab = (attributes?: Record<string, string>) => ({
    id: 'g1',
    name: 'WEBLAB',
    path: '/UYELER/ARGE/WEBLAB',
    attributes,
  });
  const leads = (
    can: Record<string, boolean> = { 'members.write': true, 'team.settings': true },
  ) => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'lead', groups: ['/UYELER/ARGE/WEBLAB/LIDERLER'] },
    });
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'group.write': false },
      managedTeams: [{ id: 'g1', path: '/UYELER/ARGE/WEBLAB', code: 'WEBLAB' }],
    });
    (identityApi.managedGroups as jest.Mock).mockResolvedValue([
      { id: 'g1', code: 'WEBLAB', path: '/UYELER/ARGE/WEBLAB', can },
    ]);
  };
  const choice = (name: RegExp) => screen.findByRole('radio', { name });

  beforeEach(() => {
    section = 'settings';
    jest.clearAllMocks();
    (identityApi.members as jest.Mock).mockResolvedValue([]);
    (identityApi.groupRoles as jest.Mock).mockRejectedValue(new ProblemError(403, 'Forbidden'));
    (identityApi.setTeamSettings as jest.Mock).mockResolvedValue({
      competitionManagers: 'leaders',
    });
  });

  it('reads the Leaders by default and all members only on true', async () => {
    leads();
    (identityApi.getGroup as jest.Mock).mockResolvedValue(weblab());
    const view = render(<GroupPage />);
    expect(await choice(/Liderler ve koordinatörler/)).toBeChecked();
    expect(screen.getByRole('radio', { name: /Tüm üyeler/ })).not.toBeChecked();
    view.unmount();

    (identityApi.getGroup as jest.Mock).mockResolvedValue(
      weblab({ team_competition_manage: 'TRUE' }),
    );
    render(<GroupPage />);
    expect(await choice(/Tüm üyeler/)).toBeChecked();
    // A Team setting, not an extra attribute
    expect(screen.queryByText('team_competition_manage')).toBeNull();
  });

  it('asks on Kaydet before letting all members manage them, and writes only on the answer', async () => {
    leads();
    (identityApi.getGroup as jest.Mock).mockResolvedValue(weblab());
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await choice(/Tüm üyeler/));
    expect(identityApi.setTeamSettings).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'WEBLAB ekibinin yarışmalarını tüm üyeler yönetsin mi?',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(identityApi.setTeamSettings).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Tüm üyelere aç',
      }),
    );
    await waitFor(() =>
      expect(identityApi.setTeamSettings).toHaveBeenCalledWith('g1', {
        competitionManagers: 'members',
      }),
    );
    expect(await screen.findByText('Ayarlar kaydedildi')).toBeInTheDocument();
    // A Leader without group.write writes no profile
    expect(identityApi.updateGroup).not.toHaveBeenCalled();
  });

  it('narrows to the Leaders on Kaydet without asking', async () => {
    leads();
    (identityApi.getGroup as jest.Mock).mockResolvedValue(
      weblab({ team_competition_manage: 'true' }),
    );
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await choice(/Liderler ve koordinatörler/));
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() =>
      expect(identityApi.setTeamSettings).toHaveBeenCalledWith('g1', {
        competitionManagers: 'leaders',
      }),
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(await screen.findByText('Ayarlar kaydedildi')).toBeInTheDocument();
  });

  it('puts the choice back with Vazgeç', async () => {
    leads();
    (identityApi.getGroup as jest.Mock).mockResolvedValue(weblab());
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await choice(/Tüm üyeler/));
    await user.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(screen.getByRole('radio', { name: /Liderler ve koordinatörler/ })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Kaydet' })).toBeNull();
  });

  it('says the rights could not be read when core’s managed tree fails', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'lead', groups: ['/UYELER/ARGE/WEBLAB/LIDERLER'] },
    });
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'group.write': false },
      managedTeams: [{ id: 'g1', path: '/UYELER/ARGE/WEBLAB', code: 'WEBLAB' }],
    });
    (identityApi.managedGroups as jest.Mock).mockRejectedValue(
      new ProblemError(503, 'Unavailable'),
    );
    (identityApi.getGroup as jest.Mock).mockResolvedValue(weblab());
    render(<GroupPage />);
    expect(await screen.findByText('Yetkin okunamadı; sayfayı yenile.')).toBeInTheDocument();
    expect(screen.queryByText(/Bu ayarları ekibin liderleri/)).toBeNull();
    expect(screen.getByRole('radio', { name: /Tüm üyeler/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('says core’s refusal of a narrowing on the page', async () => {
    leads();
    (identityApi.getGroup as jest.Mock).mockResolvedValue(
      weblab({ team_competition_manage: 'true' }),
    );
    (identityApi.setTeamSettings as jest.Mock).mockRejectedValue(
      new ProblemError(503, 'Service Unavailable'),
    );
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await choice(/Liderler ve koordinatörler/));
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Ayarlar kaydedildi')).toBeNull();
  });

  it('keeps it read-only, with the reason, without core’s team.settings', async () => {
    // members.write alone is not the settings rule: core answers team.settings for it
    leads({ 'members.write': true, 'team.settings': false });
    (identityApi.getGroup as jest.Mock).mockResolvedValue(weblab());
    const user = userEvent.setup();
    render(<GroupPage />);
    const members = await choice(/Tüm üyeler/);
    expect(await screen.findByText(/Bu ayarları ekibin liderleri/)).toBeInTheDocument();
    await user.click(members);
    expect(screen.queryByRole('button', { name: 'Kaydet' })).toBeNull();
    expect(identityApi.setTeamSettings).not.toHaveBeenCalled();
  });

  it('lets Privileged change it on any Team', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'yk', groups: ['/UYELER/YK'] } });
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'group.write': true } });
    (identityApi.groupRoles as jest.Mock).mockResolvedValue([]);
    (identityApi.getGroup as jest.Mock).mockResolvedValue(
      weblab({ team_competition_manage: 'true' }),
    );
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await choice(/Liderler ve koordinatörler/));
    await user.click(screen.getByRole('button', { name: 'Kaydet' }));
    await waitFor(() =>
      expect(identityApi.setTeamSettings).toHaveBeenCalledWith('g1', {
        competitionManagers: 'leaders',
      }),
    );
    expect(identityApi.updateGroup).not.toHaveBeenCalled();
    expect(screen.queryByText(/Bu ayarları ekibin liderleri/)).toBeNull();
  });
});

describe('Group detail: Leaders and Sub-teams (ekip yetki devri 11)', () => {
  const weblab = { id: 'g1', name: 'WEBLAB', path: '/UYELER/ARGE/WEBLAB' };
  const node = (can: Record<string, boolean>, childCan: Record<string, boolean>) => ({
    id: 'g1',
    code: 'WEBLAB',
    path: '/UYELER/ARGE/WEBLAB',
    can,
    children: [
      {
        id: 'g-fe',
        code: 'FRONTEND',
        path: '/UYELER/ARGE/WEBLAB/FRONTEND',
        memberCount: 3,
        leaderCount: 1,
        can: childCan,
        children: [],
      },
    ],
  });
  const ALL = {
    'group.read': true,
    'members.write': true,
    'leaders.write': true,
    'subteams.write': true,
    'code.write': true,
    'team.delete': true,
    'team.move': true,
    'team.settings': true,
  };

  beforeEach(() => {
    section = 'leaders';
    jest.clearAllMocks();
    (identityApi.getGroup as jest.Mock).mockResolvedValue(weblab);
    (identityApi.members as jest.Mock).mockResolvedValue([]);
    (identityApi.teamLeaders as jest.Mock).mockResolvedValue([
      {
        id: 'u-lid',
        firstName: 'Lider',
        lastName: 'K',
        email: 'lider@example.com',
        kind: 'LIDERLER',
        groupId: 'g-lid',
      },
    ]);
  });

  it('reads core’s tree for Privileged on a Team and offers what core allows', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'yk', groups: ['/UYELER/YK'] } });
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'group.read': true, 'group.write': true },
      managedTeams: [],
    });
    (identityApi.groupRoles as jest.Mock).mockResolvedValue([]);
    (identityApi.managedGroups as jest.Mock).mockResolvedValue([node(ALL, ALL)]);
    render(<GroupPage />);
    expect(await screen.findByRole('button', { name: 'Lider ata' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alt ekip aç' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'FRONTEND' })).toHaveAttribute('href', '/groups/g-fe');
    expect(screen.getByRole('button', { name: 'Kodu değiştir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Taşı' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sil' })).toBeInTheDocument();
    expect(identityApi.teamLeaders).toHaveBeenCalledWith('g1');
  });

  it('gives a Privileged reader (DK) the lists without a write', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'dk', groups: ['/UYELER/DK'] } });
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'group.read': true, 'group.write': false },
      managedTeams: [],
    });
    (identityApi.groupRoles as jest.Mock).mockResolvedValue([]);
    const read = { 'group.read': true };
    (identityApi.managedGroups as jest.Mock).mockResolvedValue([node(read, read)]);
    render(<GroupPage />);
    expect(await screen.findByText('Lider · lider@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'FRONTEND' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lider ata' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Alt ekip aç' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sil' })).toBeNull();
  });

  it('gives a Team’s own Leader its Sub-teams’ actions and its own Leaders read-only', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'lead', groups: ['/UYELER/ARGE/WEBLAB/LIDERLER'] },
    });
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'group.write': false },
      managedTeams: [{ id: 'g1', path: '/UYELER/ARGE/WEBLAB', code: 'WEBLAB' }],
    });
    (identityApi.groupRoles as jest.Mock).mockRejectedValue(new ProblemError(403, 'Forbidden'));
    (identityApi.managedGroups as jest.Mock).mockResolvedValue([
      node(
        {
          ...ALL,
          'leaders.write': false,
          'code.write': false,
          'team.delete': false,
          'team.move': false,
        },
        { ...ALL, 'code.write': false },
      ),
    ]);
    render(<GroupPage />);
    expect(
      await screen.findByText('Bu ekibin liderlerini üst ekibin liderleri ya da YK değiştirir.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lider ata' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Alt ekip aç' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'FRONTEND' })).toHaveAttribute('href', '/groups/g-fe');
    expect(screen.getByRole('button', { name: 'Taşı' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kodu değiştir' })).toBeNull();
    expect(screen.getByText('Alt ekip kodunu YK değiştirir.')).toBeInTheDocument();
  });

  it('offers no Leaders page while core names no managed Team (team delegation off)', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'lead', groups: ['/UYELER/ARGE/WEBLAB/LIDERLER'] },
    });
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: {}, managedTeams: [] });
    (identityApi.groupRoles as jest.Mock).mockRejectedValue(new ProblemError(403, 'Forbidden'));
    render(<GroupPage which="members" />);
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(await screen.findByRole('link', { name: /Üyeler/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Liderler ve alt ekipler/ })).toBeNull();
    expect(identityApi.managedGroups).not.toHaveBeenCalled();
    expect(identityApi.teamLeaders).not.toHaveBeenCalled();
  });
});

describe('Group Üyeler: role, term end and when added (Paket 2)', () => {
  const weblab = { id: 'g1', name: 'WEBLAB', path: '/UYELER/ARGE/WEBLAB' };
  const people = [
    { id: 'u-ada', firstName: 'Ada', lastName: 'L', email: 'ada@example.com' },
    {
      id: 'u-cem',
      firstName: 'Cem',
      lastName: 'D',
      email: 'cem@example.com',
      sourceGroupId: 'g-koor',
      sourceGroupPath: '/UYELER/ARGE/WEBLAB/KOORDINATORLER',
    },
    {
      id: 'u-lid',
      firstName: 'Lale',
      lastName: 'K',
      email: 'lale@example.com',
      sourceGroupId: 'g-lid',
      sourceGroupPath: '/UYELER/ARGE/WEBLAB/LIDERLER',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    section = 'members';
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'yk', groups: ['/UYELER/YK'] } });
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'group.write': true, 'group.read': true, 'audit.read': true, 'user.read': true },
    });
    (identityApi.getGroup as jest.Mock).mockResolvedValue(weblab);
    (identityApi.members as jest.Mock).mockResolvedValue(people);
    (identityApi.groupRoles as jest.Mock).mockResolvedValue([]);
    (identityApi.managedGroups as jest.Mock).mockResolvedValue([
      {
        id: 'g1',
        code: 'WEBLAB',
        path: '/UYELER/ARGE/WEBLAB',
        memberCount: 3,
        leaderCount: 2,
        can: { 'members.write': true },
        children: [],
      },
    ]);
    (identityApi.teamLeaders as jest.Mock).mockResolvedValue([
      { ...people[2], kind: 'LIDERLER', groupId: 'g-lid' },
      { ...people[1], kind: 'KOORDINATORLER', groupId: 'g-koor' },
    ]);
    (identityApi.groupAudit as jest.Mock).mockResolvedValue({
      items: [
        {
          id: 'a1',
          occurredAt: '2026-11-12T09:00:00Z',
          action: 'member.add',
          outcome: 'ok',
          target: { id: 'u-ada', displayName: 'Ada L' },
        },
      ],
      next: null,
    });
    (managementMembershipsApi.list as jest.Mock).mockResolvedValue([
      {
        id: 't1',
        userId: 'u-cem',
        firstName: 'Cem',
        lastName: 'D',
        groupId: 'g-koor',
        groupPath: '/UYELER/ARGE/WEBLAB/KOORDINATORLER',
        role: 'team-leaders',
        status: 'expiring',
        endsAt: '2026-12-01T20:59:59Z',
      },
    ]);
  });

  it('lists the Leaders first with their role, the term end and the add date core knows', async () => {
    render(<GroupPage />);
    const rows = await screen.findAllByRole('link', { name: /^(Ada L|Cem D|Lale K)$/ });
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      '/users/u-lid',
      '/users/u-cem',
      '/users/u-ada',
    ]);
    expect(screen.getAllByText('Lider').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Koordinatör').length).toBeGreaterThan(0);
    expect(await screen.findByText('Bitiyor')).toBeInTheDocument();
    expect(await screen.findByText('12 Kas 2026')).toBeInTheDocument();
    expect(identityApi.groupAudit).toHaveBeenCalledWith('g1', {
      actions: ['member.add', 'leader.add'],
      limit: 100,
    });
  });

  it('takes the chosen members out together, asking once', async () => {
    (identityApi.removeMember as jest.Mock).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await screen.findByRole('checkbox', { name: 'Ada L seç' }));
    await user.click(screen.getByRole('checkbox', { name: 'Cem D seç' }));
    await user.click(screen.getByRole('button', { name: 'Gruptan çıkar' }));
    const ask = await screen.findByRole('alertdialog', {
      name: '2 kişi WEBLAB grubundan çıkarılsın mı?',
    });
    expect(identityApi.removeMember).not.toHaveBeenCalled();
    await user.click(within(ask).getByRole('button', { name: 'Gruptan çıkar' }));
    await waitFor(() => expect(identityApi.removeMember).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('2 üye çıkarıldı')).toBeInTheDocument();
  });

  it('keeps the members core refused chosen after a partial removal', async () => {
    (identityApi.removeMember as jest.Mock).mockImplementation((_group: string, userId: string) =>
      userId === 'u-cem' ? Promise.reject(new ProblemError(403, 'Forbidden')) : Promise.resolve(),
    );
    const user = userEvent.setup();
    render(<GroupPage />);
    await user.click(await screen.findByRole('checkbox', { name: 'Ada L seç' }));
    await user.click(screen.getByRole('checkbox', { name: 'Cem D seç' }));
    await user.click(screen.getByRole('button', { name: 'Gruptan çıkar' }));
    const ask = await screen.findByRole('alertdialog');
    await user.click(within(ask).getByRole('button', { name: 'Gruptan çıkar' }));
    expect(await within(ask).findByRole('alert')).toHaveTextContent('Cem D:');
    await user.click(within(ask).getByRole('button', { name: 'Vazgeç' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByRole('checkbox', { name: 'Ada L seç' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Cem D seç' })).toBeChecked();
  });

  it('shows the overview’s figures, each opening its page, and the latest changes', async () => {
    render(<GroupPage which="overview" />);
    const members = await screen.findByRole('link', { name: /^Üye\s*3/ });
    expect(members).toHaveAttribute('href', '/groups/g1/members');
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /^Lider\s*2/ })).toHaveAttribute(
        'href',
        '/groups/g1/leaders',
      ),
    );
    expect(await screen.findByText('Üye eklendi: Ada L')).toBeInTheDocument();
  });

  it('warns on a Team without a Leader and leads to its Leaders page', async () => {
    (identityApi.managedGroups as jest.Mock).mockResolvedValue([
      {
        id: 'g1',
        code: 'WEBLAB',
        path: '/UYELER/ARGE/WEBLAB',
        memberCount: 3,
        leaderCount: 0,
        can: {},
        children: [],
      },
    ]);
    render(<GroupPage which="overview" />);
    expect(await screen.findByText('Ekibin lideri yok')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Liderler' })).toHaveAttribute(
      'href',
      '/groups/g1/leaders',
    );
  });
});
