import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import ManagementMembershipsPage from '@/app/(authorized)/management-memberships/page';
import { capabilitiesApi } from '@/lib/api/capabilities';
import { ProblemError } from '@/lib/api/core';
import { identityApi } from '@/lib/api/identity';
import { managementMembershipsApi, type ManagementTerm } from '@/lib/api/management-memberships';

jest.mock('@/lib/api/capabilities', () => ({ capabilitiesApi: { get: jest.fn() } }));
jest.mock('@/lib/api/management-memberships', () => ({
  managementMembershipsApi: {
    list: jest.fn(),
    extend: jest.fn(),
    handover: jest.fn(),
    remove: jest.fn(),
  },
}));
jest.mock('@/lib/api/identity', () => ({
  identityApi: { memberCandidates: jest.fn(), getUser: jest.fn() },
}));

const term = (over: Partial<ManagementTerm>): ManagementTerm => ({
  id: 't1',
  userId: 'u1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  groupId: 'g-yk',
  groupPath: '/UYELER/YK',
  role: 'board',
  status: 'active',
  endsAt: '2099-06-30T20:59:59Z',
  seasonId: 's1',
  source: 'backfill',
  startedAt: '2026-11-08T10:00:00Z',
  grantedBy: null,
  warned14dAt: null,
  warned1dAt: null,
  expiredAt: null,
  ...over,
});

const writer = { can: { 'group.read': true, 'group.write': true } };

// jsdom has no PointerEvent; base-ui's Checkbox (the table's row picks) sends one on a click
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  (capabilitiesApi.get as jest.Mock).mockResolvedValue(writer);
  (managementMembershipsApi.list as jest.Mock).mockResolvedValue([
    term({}),
    term({
      id: 't2',
      userId: 'u2',
      firstName: 'Grace',
      lastName: 'Hopper',
      groupId: 'g-lead',
      groupPath: '/UYELER/ARGE/WEBLAB/LIDERLER',
      role: 'team-leaders',
      status: 'expired',
      endsAt: '2026-06-30T20:59:59Z',
      expiredAt: '2026-07-01T06:00:00Z',
    }),
  ]);
});

function rowOf(name: string): HTMLElement {
  return screen.getByText(name).closest('tr') as HTMLElement;
}

describe('Dönem devri', () => {
  it('lists the terms with the expired one first and counts it', async () => {
    render(<ManagementMembershipsPage />);
    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('1 üyeliğin süresi doldu')).toBeInTheDocument();
    const rows = within(screen.getByRole('table', { name: 'Yönetim üyelikleri' })).getAllByRole(
      'row',
    );
    expect(rows[1]).toHaveTextContent('Grace Hopper');
    expect(rows[1]).toHaveTextContent('Süresi dolmuş');
    expect(rows[2]).toHaveTextContent('Ada Lovelace');
    expect(rows[2]).toHaveTextContent('30.06.2099');
    // Gruptan çıkar only on the expired row
    expect(
      within(rowOf('Grace Hopper')).getByRole('button', { name: 'Gruptan çıkar' }),
    ).toBeInTheDocument();
    expect(
      within(rowOf('Ada Lovelace')).queryByRole('button', { name: 'Gruptan çıkar' }),
    ).toBeNull();
  });

  it('shows a reader who may not write (DK) no buttons', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'group.read': true, 'group.write': false },
    });
    render(<ManagementMembershipsPage />);
    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument();
    await waitFor(() => expect(capabilitiesApi.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Uzat' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Devret' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /seç/i })).toBeNull();
  });

  it('says the terms are off when core does not serve them', async () => {
    (managementMembershipsApi.list as jest.Mock).mockRejectedValue(
      new ProblemError(404, 'Not Found'),
    );
    render(<ManagementMembershipsPage />);
    expect(await screen.findByText('Süreli yönetim üyelikleri kapalı')).toBeInTheDocument();
  });

  it('extends a term to the day picked and says core’s refusal in Turkish', async () => {
    const user = userEvent.setup();
    (managementMembershipsApi.extend as jest.Mock)
      .mockRejectedValueOnce(
        new ProblemError(422, 'Unprocessable Entity', { code: 'term_too_long' }),
      )
      .mockResolvedValueOnce(term({ endsAt: '2099-09-30T20:59:59Z' }));
    render(<ManagementMembershipsPage />);
    await screen.findByText('Ada Lovelace');
    await user.click(await within(rowOf('Ada Lovelace')).findByRole('button', { name: 'Uzat' }));
    const dialog = await screen.findByRole('dialog', { name: 'Uzat: Ada Lovelace' });
    await user.type(within(dialog).getByLabelText('Yeni bitiş'), '2099-09-30');
    await user.click(within(dialog).getByRole('button', { name: 'Uzat' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/bir sonraki sezonun sonu/);
    await user.click(within(dialog).getByRole('button', { name: 'Uzat' }));
    await waitFor(() => expect(managementMembershipsApi.extend).toHaveBeenCalledTimes(2));
    expect(managementMembershipsApi.extend).toHaveBeenLastCalledWith('t1', '2099-09-30');
    await waitFor(() => expect(managementMembershipsApi.list).toHaveBeenCalledTimes(2));
  });

  it('removes an expired holder after the question', async () => {
    const user = userEvent.setup();
    (managementMembershipsApi.remove as jest.Mock).mockResolvedValue(undefined);
    render(<ManagementMembershipsPage />);
    await screen.findByText('Grace Hopper');
    await user.click(
      await within(rowOf('Grace Hopper')).findByRole('button', { name: 'Gruptan çıkar' }),
    );
    const question = await screen.findByRole('alertdialog');
    expect(question).toHaveTextContent(
      'Grace Hopper /UYELER/ARGE/WEBLAB/LIDERLER grubundan çıkarılsın mı?',
    );
    await user.click(within(question).getByRole('button', { name: 'Gruptan çıkar' }));
    await waitFor(() => expect(managementMembershipsApi.remove).toHaveBeenCalledWith('t2'));
  });

  it('hands a term over to a candidate of its Group, acknowledging core’s YTÜ warning', async () => {
    const user = userEvent.setup();
    (identityApi.memberCandidates as jest.Mock).mockResolvedValue([
      {
        id: 'u9',
        firstName: 'Katherine',
        lastName: 'Johnson',
        email: 'k***@example.test',
        alreadyMember: false,
        ytuLinked: false,
        warnings: ['not_ytu_verified'],
      },
    ]);
    let answerCard: (card: { id: string; email: string }) => void = () => undefined;
    (identityApi.getUser as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        answerCard = resolve;
      }),
    );
    (managementMembershipsApi.handover as jest.Mock).mockResolvedValue(
      term({ id: 't9', userId: 'u9' }),
    );
    render(<ManagementMembershipsPage />);
    await screen.findByText('Ada Lovelace');
    await user.click(await within(rowOf('Ada Lovelace')).findByRole('button', { name: 'Devret' }));
    const picker = await screen.findByRole('dialog', { name: 'Devret: /UYELER/YK' });
    await user.type(within(picker).getByRole('searchbox'), 'kat');
    const candidate = await within(picker).findByRole('button', { name: 'Katherine Johnson' });
    // A second pick while the whole address is read asks nothing more
    await user.click(candidate);
    await user.click(candidate);
    answerCard({ id: 'u9', email: 'kat@example.test' });
    expect(identityApi.memberCandidates).toHaveBeenCalledWith('g-yk', 'kat');
    const question = await screen.findByRole('alertdialog');
    expect(identityApi.getUser).toHaveBeenCalledTimes(1);
    expect(question).toHaveTextContent('Ada Lovelace → Katherine Johnson');
    expect(question).toHaveTextContent(/YTÜ hesabıyla doğrulanmamış.*\(kat@example\.test\)/);
    // The holder stays to their end unless the reader says otherwise
    expect(within(question).getByLabelText('Eski üye')).toHaveValue('at_term_end');
    expect(within(question).getByRole('button', { name: 'Devret' }).className).not.toMatch(
      /bg-destructive/,
    );
    await user.click(within(question).getByRole('button', { name: 'Devret' }));
    await waitFor(() =>
      expect(managementMembershipsApi.handover).toHaveBeenCalledWith('t1', {
        userId: 'u9',
        mode: 'at_term_end',
        unverifiedAck: true,
      }),
    );
  });

  it('hands over at once with a destructive question, and reloads after a refusal', async () => {
    const user = userEvent.setup();
    (identityApi.memberCandidates as jest.Mock).mockResolvedValue([
      {
        id: 'u8',
        firstName: 'Mary',
        lastName: 'Jackson',
        email: 'mary@example.test',
        alreadyMember: false,
        ytuLinked: true,
        warnings: [],
      },
    ]);
    (managementMembershipsApi.handover as jest.Mock)
      .mockRejectedValueOnce(
        new ProblemError(503, 'Service Unavailable', { code: 'audit_unavailable' }),
      )
      .mockResolvedValueOnce(term({ id: 't8', userId: 'u8' }));
    render(<ManagementMembershipsPage />);
    await screen.findByText('Ada Lovelace');
    await user.click(await within(rowOf('Ada Lovelace')).findByRole('button', { name: 'Devret' }));
    const picker = await screen.findByRole('dialog', { name: 'Devret: /UYELER/YK' });
    await user.type(within(picker).getByRole('searchbox'), 'mar');
    await user.click(await within(picker).findByRole('button', { name: 'Mary Jackson' }));
    const question = await screen.findByRole('alertdialog');
    await user.selectOptions(within(question).getByLabelText('Eski üye'), 'immediate');
    await waitFor(() =>
      expect(within(question).getByRole('button', { name: 'Devret' }).className).toMatch(
        /bg-destructive/,
      ),
    );
    expect(within(question).getByLabelText('Eski üye')).toHaveValue('immediate');
    await user.click(within(question).getByRole('button', { name: 'Devret' }));
    expect(await within(question).findByRole('alert')).toHaveTextContent(
      /Denetim kaydı yazılamadı/,
    );
    expect(managementMembershipsApi.list).toHaveBeenCalledTimes(2);
    await user.click(within(question).getByRole('button', { name: 'Devret' }));
    await waitFor(() => expect(managementMembershipsApi.handover).toHaveBeenCalledTimes(2));
    expect(managementMembershipsApi.handover).toHaveBeenLastCalledWith('t1', {
      userId: 'u8',
      mode: 'immediate',
    });
  });

  it('extends the picked rows and says how many went through when some are refused', async () => {
    const user = userEvent.setup();
    (managementMembershipsApi.extend as jest.Mock)
      .mockResolvedValueOnce(term({}))
      .mockRejectedValueOnce(new ProblemError(403, 'Forbidden'));
    render(<ManagementMembershipsPage />);
    await screen.findByText('Ada Lovelace');
    await user.click(within(rowOf('Grace Hopper')).getByRole('checkbox'));
    await user.click(within(rowOf('Ada Lovelace')).getByRole('checkbox'));
    await user.click(await screen.findByRole('button', { name: 'Seçilenleri uzat' }));
    const dialog = await screen.findByRole('dialog', { name: '2 görevi uzat' });
    await user.type(within(dialog).getByLabelText('Yeni bitiş'), '2099-09-30');
    await user.click(within(dialog).getByRole('button', { name: 'Uzat' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '1/2 görev uzatıldı. Bu işlem için yetkin yok.',
    );
    expect(managementMembershipsApi.extend).toHaveBeenCalledTimes(2);
    // The one that went through shows: the list is read again
    await waitFor(() => expect(managementMembershipsApi.list).toHaveBeenCalledTimes(2));
  });

  it('removes the picked expired holders and says how many were refused', async () => {
    const user = userEvent.setup();
    (managementMembershipsApi.list as jest.Mock).mockResolvedValue([
      term({ id: 't3', status: 'expired', endsAt: '2026-06-30T20:59:59Z' }),
      term({
        id: 't4',
        userId: 'u4',
        firstName: 'Cem',
        lastName: 'Yıldız',
        status: 'expired',
        endsAt: '2026-06-30T20:59:59Z',
      }),
    ]);
    (managementMembershipsApi.remove as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ProblemError(409, 'Conflict', { code: 'term_not_expired' }));
    render(<ManagementMembershipsPage />);
    await screen.findByText('Cem Yıldız');
    await user.click(within(rowOf('Ada Lovelace')).getByRole('checkbox'));
    await user.click(within(rowOf('Cem Yıldız')).getByRole('checkbox'));
    await user.click(await screen.findByRole('button', { name: 'Süresi dolmuşları çıkar' }));
    const question = await screen.findByRole('alertdialog', {
      name: '2 kişi grubundan çıkarılsın mı?',
    });
    await user.click(within(question).getByRole('button', { name: 'Gruptan çıkar' }));
    expect(await within(question).findByRole('alert')).toHaveTextContent(
      /^1\/2 kişi çıkarıldı\. Süresi dolmamış görev/,
    );
    expect(managementMembershipsApi.list).toHaveBeenCalledTimes(2);
  });

  it('gives a Leader who reads no Groups the buttons on the terms core lists them', async () => {
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: { 'group.read': false, 'group.write': false },
      managedTeams: [{ id: 'g-arge', path: '/UYELER/ARGE/WEBLAB', code: 'WEBLAB' }],
    });
    render(<ManagementMembershipsPage />);
    await screen.findByText('Grace Hopper');
    expect(
      await within(rowOf('Grace Hopper')).findByRole('button', { name: 'Uzat' }),
    ).toBeInTheDocument();
    expect(
      within(rowOf('Grace Hopper')).getByRole('button', { name: 'Devret' }),
    ).toBeInTheDocument();
    expect(
      within(rowOf('Grace Hopper')).getByRole('button', { name: 'Gruptan çıkar' }),
    ).toBeInTheDocument();
  });

  it('says why the list is empty: nothing to change, or no term at all', async () => {
    (managementMembershipsApi.list as jest.Mock).mockResolvedValue([]);
    (capabilitiesApi.get as jest.Mock).mockResolvedValue({
      can: {},
      managedTeams: [{ id: 'g-arge', path: '/UYELER/ARGE/WEBLAB', code: 'WEBLAB' }],
    });
    const { unmount } = render(<ManagementMembershipsPage />);
    expect(await screen.findByText('Değiştirebileceğin süreli üyelik yok.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    unmount();
    (capabilitiesApi.get as jest.Mock).mockResolvedValue(writer);
    render(<ManagementMembershipsPage />);
    expect(await screen.findByText('Süreli yönetim üyeliği yok.')).toBeInTheDocument();
  });
});
