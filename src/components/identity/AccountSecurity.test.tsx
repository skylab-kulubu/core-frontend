import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { userAccountApi, type UserAccount } from '@/lib/api/user-account';
import { AccountSecurity } from './AccountSecurity';

jest.mock('@/lib/api/user-account', () => ({
  ...jest.requireActual('@/lib/api/user-account'),
  userAccountApi: {
    setEnabled: jest.fn(),
    setPassword: jest.fn(),
    sendPasswordMail: jest.fn(),
    changeEmail: jest.fn(),
    verifyEmail: jest.fn(),
    sendVerificationMail: jest.fn(),
    setPrimary: jest.fn(),
    setRequiredActions: jest.fn(),
    deleteCredential: jest.fn(),
    unlinkIdentity: jest.fn(),
    clearLockout: jest.fn(),
  },
}));

const api = userAccountApi as jest.Mocked<typeof userAccountApi>;

// jsdom has no PointerEvent; base-ui's Checkbox sends one to its hidden input on a click
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    Object.defineProperty(window, 'PointerEvent', { value: MouseEvent, configurable: true });
  }
});

function account(over: Partial<UserAccount> = {}): UserAccount {
  return {
    id: 'u1',
    status: 'active',
    username: 'ada',
    enabled: true,
    createdAt: '2025-10-01T09:00:00Z',
    email: {
      primary: 'ada@example.com',
      primaryVerified: false,
      primaryKind: 'personal',
      school: 'ada@std.yildiz.edu.tr',
      personal: 'ada@example.com',
      personalVerified: false,
    },
    ytuVerified: true,
    requiredActions: ['TERMS_AND_CONDITIONS'],
    credentials: [
      { id: 'c-pass', type: 'password', createdAt: '2025-10-01T09:00:00Z' },
      { id: 'c-key', type: 'webauthn-passwordless', label: 'MacBook' },
    ],
    identityProviders: [{ provider: 'OBS', userName: 'ada@std.yildiz.edu.tr', ytu: true }],
    sessions: [
      { start: '2026-11-22T08:00:00Z', lastAccess: '2026-11-22T09:00:00Z', clients: ['admin'] },
    ],
    lockout: { locked: true, failures: 10 },
    logins: {
      last: '2026-11-22T08:00:00Z',
      events: [{ type: 'LOGIN_ERROR', time: '2026-11-22T07:59:00Z', client: 'admin' }],
    },
    can: { manage: true },
    ...over,
  };
}

beforeEach(() => jest.clearAllMocks());

it('shows the account and every action the reader may take', () => {
  render(<AccountSecurity account={account()} personName="Ada Lovelace" onChanged={jest.fn()} />);
  expect(screen.getByRole('heading', { name: 'Hesap ve güvenlik' })).toBeInTheDocument();
  expect(screen.getByText('Etkin')).toBeInTheDocument();
  expect(screen.getByText('Geçici kilitli · 10 hatalı deneme')).toBeInTheDocument();
  expect(screen.getByText('Passkey')).toBeInTheDocument();
  expect(screen.getByText('YTÜ (Microsoft)')).toBeInTheDocument();
  expect(screen.getByText('Başarısız giriş')).toBeInTheDocument();
  expect(screen.getByText('Koşulları kabul etsin')).toBeInTheDocument();
  for (const name of [
    'Devre dışı bırak',
    'Onaylı işaretle',
    'Geçici parola',
    'Kilidi aç',
    'Ayır',
    'Değiştir',
  ]) {
    expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
  }
});

it('offers nothing to change on the own account, and says where it changes', () => {
  render(
    <AccountSecurity
      account={account({ can: { manage: false, reason: 'own_account' }, logins: null })}
      personName="Ada Lovelace"
      onChanged={jest.fn()}
    />,
  );
  expect(screen.getByText(/Kendi hesabın/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Hesap merkezi' })).toHaveAttribute(
    'href',
    'https://my.yildizskylab.com',
  );
  expect(screen.queryByRole('button', { name: /Geçici parola|Devre dışı|Kaldır|Ayır/ })).toBeNull();
  expect(screen.getAllByText('Okunamıyor').length).toBeGreaterThan(0);
});

it('sets a temporary password and shows the one core made up once', async () => {
  api.setPassword.mockResolvedValue({
    generated: true,
    password: 'hT7k-Pq3m-Zx9r-Wd2n',
    temporary: true,
    sessionsClosed: true,
  });
  const onChanged = jest.fn();
  render(<AccountSecurity account={account()} personName="Ada Lovelace" onChanged={onChanged} />);
  await userEvent.click(screen.getByRole('button', { name: /Geçici parola/ }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Ada Lovelace için geçici parola')).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Parolayı belirle' }));
  expect(api.setPassword).toHaveBeenCalledWith('u1', undefined);
  expect(await screen.findByTestId('temporary-password')).toHaveTextContent('hT7k-Pq3m-Zx9r-Wd2n');
  const closes = screen.getAllByRole('button', { name: 'Kapat' });
  await userEvent.click(closes[closes.length - 1]);
  await waitFor(() => expect(screen.queryByTestId('temporary-password')).toBeNull());
  expect(onChanged).toHaveBeenCalled();
});

it('sends a typed password and says why core refused it', async () => {
  const { ProblemError } = jest.requireActual('@/lib/api/core');
  api.setPassword.mockRejectedValue(
    new ProblemError(422, 'Unprocessable Content', {
      code: 'password_policy',
      fields: { policy: 'invalidPasswordMinLengthMessage' },
    }),
  );
  render(<AccountSecurity account={account()} personName="Ada" onChanged={jest.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: /Geçici parola/ }));
  await userEvent.click(await screen.findByLabelText('Ben yazayım'));
  await userEvent.type(screen.getByLabelText('Parola'), 'kisa');
  await userEvent.click(screen.getByRole('button', { name: 'Parolayı belirle' }));
  expect(api.setPassword).toHaveBeenCalledWith('u1', 'kisa');
  expect(await screen.findByText('Parola en az 8 karakter olmalı.')).toBeInTheDocument();
});

it('changes the e-mail as the personal and primary address', async () => {
  api.changeEmail.mockResolvedValue(undefined);
  const onChanged = jest.fn();
  const user = userEvent.setup();
  render(<AccountSecurity account={account()} personName="Ada" onChanged={onChanged} />);
  await user.click(screen.getByRole('button', { name: /Değiştir/ }));
  await user.type(await screen.findByLabelText('Yeni adres'), 'yeni@example.com');
  await user.click(screen.getByRole('checkbox', { name: 'Onaylı say' }));
  await user.click(screen.getByRole('button', { name: 'Kaydet' }));
  await waitFor(() =>
    expect(api.changeEmail).toHaveBeenCalledWith('u1', {
      address: 'yeni@example.com',
      verified: true,
      primary: true,
    }),
  );
  expect(onChanged).toHaveBeenCalled();
});

it('sets the panel required actions and keeps the others to core', async () => {
  api.setRequiredActions.mockResolvedValue(undefined);
  render(<AccountSecurity account={account()} personName="Ada" onChanged={jest.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: /Düzenle/ }));
  await userEvent.click(screen.getByLabelText('Parolasını değiştirsin'));
  await userEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
  expect(api.setRequiredActions).toHaveBeenCalledWith('u1', ['UPDATE_PASSWORD']);
});

it('asks before disabling and removing', async () => {
  api.setEnabled.mockResolvedValue(undefined);
  api.deleteCredential.mockResolvedValue(undefined);
  render(<AccountSecurity account={account()} personName="Ada" onChanged={jest.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Devre dışı bırak' }));
  const question = await screen.findByRole('alertdialog');
  expect(within(question).getByText('Ada devre dışı bırakılsın mı?')).toBeInTheDocument();
  await userEvent.click(within(question).getByRole('button', { name: 'Devre dışı bırak' }));
  await waitFor(() => expect(api.setEnabled).toHaveBeenCalledWith('u1', false));
});

it('says only that an erased account is gone', () => {
  render(
    <AccountSecurity
      account={account({
        status: 'deletion_pending',
        can: { manage: false, reason: 'account_not_active' },
      })}
      personName="Ada"
      onChanged={jest.fn()}
    />,
  );
  expect(screen.getByText('Hesap silinmiş ya da siliniyor.')).toBeInTheDocument();
  expect(screen.queryByText('Kimlik bilgileri')).toBeNull();
});
