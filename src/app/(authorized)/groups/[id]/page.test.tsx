import { act, screen, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import GroupDetailPage from '@/app/(authorized)/groups/[id]/page';
import { ProblemError } from '@/lib/api/core';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { identityApi } from '@/lib/api/identity';
import { useAuth } from '@/context/AuthContext';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'g1' }),
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'yk', groups: ['/UYELER/YK'] } })),
}));

jest.mock('@/lib/api/capabilities', () => ({
  capabilitiesApi: { get: jest.fn() },
}));

beforeEach(() => {
  (capabilitiesApi.get as jest.Mock).mockResolvedValue({ can: { 'group.write': true } });
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
    memberCandidates: jest.fn(),
    getUser: jest.fn(),
    addMember: jest.fn(),
    memberCheck: jest.fn(),
    removeMember: jest.fn(),
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
    render(<GroupDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    expect(screen.getByText('En az 3 karakter yazın')).toBeInTheDocument();
    const search = screen.getByPlaceholderText('Ad veya tam e-posta');
    await user.type(search, 'ad');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(identityApi.memberCandidates).not.toHaveBeenCalled();
    expect(screen.getByText('En az 3 karakter yazın')).toBeInTheDocument();

    await user.type(search, 'a');
    await waitFor(() => expect(identityApi.memberCandidates).toHaveBeenCalledWith('g1', 'ada'));
    expect(identityApi.memberCandidates).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Ada L')).toBeInTheDocument();
    expect(screen.getByText('a***@example.com')).toBeInTheDocument();
  });

  it('says no one matched in the picker’s words', async () => {
    (identityApi.memberCandidates as jest.Mock).mockResolvedValue([]);
    const user = userEvent.setup();
    render(<GroupDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    await user.type(screen.getByPlaceholderText('Ad veya tam e-posta'), 'zey');
    expect(await screen.findByText('Kullanıcı yok')).toBeInTheDocument();
  });

  it('leaves out the ones core says are members already', async () => {
    (identityApi.memberCandidates as jest.Mock).mockResolvedValue([
      { ...candidate('u-ada', 'Ada', 'L', 'a***@example.com'), alreadyMember: true },
      candidate('u-cem', 'Cem', 'D', 'c***@example.com'),
    ]);
    const user = userEvent.setup();
    render(<GroupDetailPage />);
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
    render(<GroupDetailPage />);
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
    jest.clearAllMocks();
    (identityApi.getGroup as jest.Mock).mockResolvedValue({
      id: 'g1',
      name: 'GECEKODU',
      path: '/UYELER/ORGANIZASYON/GECEKODU',
    });
    (identityApi.members as jest.Mock).mockResolvedValue([
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
    render(<GroupDetailPage />);
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
    render(<GroupDetailPage />);
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
    render(<GroupDetailPage />);
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
    render(<GroupDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Üye ekle' }));
    await user.type(screen.getByPlaceholderText('Ad veya tam e-posta'), 'ada');
    await user.click(await screen.findByRole('checkbox', { name: /Ada L/ }));
    await user.click(screen.getByRole('button', { name: 'Seçilenleri ekle' }));
    await user.click(await screen.findByRole('button', { name: 'Çıkar' }));
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
    render(<GroupDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Çıkar' }));
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
    render(<GroupDetailPage />);
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
    render(<GroupDetailPage />);
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
    render(<GroupDetailPage />);
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
    render(<GroupDetailPage />);
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
    render(<GroupDetailPage />);
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
    render(<GroupDetailPage />);
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
    render(<GroupDetailPage />);
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
    render(<GroupDetailPage />);
    expect(await screen.findByText(/Ekip ya da alt ekip grubuna rol verilmez/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rol ekle' })).not.toBeInTheDocument();
    const roles = screen.getByText('Uygulama rolleri').closest('section') as HTMLElement;
    expect(within(roles).getByRole('button', { name: 'Kaldır' })).toBeInTheDocument();
  });

  it('sends a Team’s app roles to Uygulamalar once core’s app assignments are on', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'group.write': true, 'apps.read': true },
    });
    for (const path of ['/UYELER/ARGE/WEBLAB', '/UYELER/ARGE/WEBLAB/FRONT/LIDERLER']) {
      group(path);
      const { unmount } = render(<GroupDetailPage />);
      const link = await screen.findByRole('link', { name: 'Uygulamalar' });
      expect(link).toHaveAttribute('href', '/apps');
      expect(screen.queryByRole('button', { name: 'Rol ekle' })).not.toBeInTheDocument();
      const roles = screen.getByText('Uygulama rolleri').closest('section') as HTMLElement;
      expect(within(roles).getByText('skyforms:access')).toBeInTheDocument();
      expect(within(roles).queryByRole('button', { name: 'Kaldır' })).not.toBeInTheDocument();
      unmount();
    }
  });

  it('keeps a Privileged root’s roles on the Groups page with app assignments on', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'group.write': true, 'apps.read': true },
    });
    group('/UYELER/YK');
    render(<GroupDetailPage />);
    expect(await screen.findByRole('button', { name: 'Rol ekle' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Uygulamalar' })).not.toBeInTheDocument();
  });

  it('offers a new role on a role group under /ROLLER with nothing under it', async () => {
    group('/ROLLER/SKYMAIL-OKUR');
    (identityApi.listGroups as jest.Mock).mockResolvedValue([
      { id: 'g1', name: 'SKYMAIL-OKUR', path: '/ROLLER/SKYMAIL-OKUR' },
    ]);
    render(<GroupDetailPage />);
    expect(await screen.findByRole('button', { name: 'Rol ekle' })).toBeInTheDocument();
  });

  it('offers no new role on a role group with groups under it', async () => {
    group('/ROLLER/SKYMAIL-OKUR');
    (identityApi.listGroups as jest.Mock).mockResolvedValue([
      { id: 'g1', name: 'SKYMAIL-OKUR', path: '/ROLLER/SKYMAIL-OKUR' },
      { id: 'g2', name: 'ALT', path: '/ROLLER/SKYMAIL-OKUR/ALT' },
    ]);
    render(<GroupDetailPage />);
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
    render(<GroupDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Rol ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rol ekle' });
    await user.click(await within(dialog).findByRole('button', { name: /system-mails:read/ }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Alt ekibin lider grubuna rol verilmez',
    );
    await user.click(within(dialog).getByRole('button', { name: /system-mails:read/ }));
    await waitFor(() =>
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Keycloak yönetim yetkisi'),
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
    render(<GroupDetailPage />);
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
    render(<GroupDetailPage />);
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
    render(<GroupDetailPage />);
    const name = await screen.findByLabelText('Grup adı');
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
    render(<GroupDetailPage />);
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
    render(<GroupDetailPage />);
    expect((await screen.findAllByText('Bora D')).length).toBeGreaterThan(0);
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(await screen.findByText('skyforms:access')).toBeInTheDocument();
    for (const name of ['Üye ekle', 'Çıkar', 'Rol ekle', 'Kaldır', 'Kaydet', 'Ekle']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.getByLabelText('Grup adı')).toBeDisabled();
  });
});

describe('Group deletion', () => {
  beforeEach(() => {
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
    render(<GroupDetailPage />);
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
    render(<GroupDetailPage />);
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
    render(<GroupDetailPage />);
    await screen.findByText('TANISMAYEMEGIGRUBU', { selector: 'h1' });
    expect(screen.queryByRole('button', { name: 'Grubu sil' })).not.toBeInTheDocument();
  });
});
