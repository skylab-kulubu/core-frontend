import type { AccountCredential, LoginEvent, UserAccount } from '@/lib/api/user-account';

const CREDENTIAL_TYPES: Record<string, string> = {
  password: 'Parola',
  otp: 'Doğrulama uygulaması',
  'webauthn-passwordless': 'Passkey',
  webauthn: 'Güvenlik anahtarı',
};

export function credentialLabel(credential: Pick<AccountCredential, 'type'>): string {
  return CREDENTIAL_TYPES[credential.type] ?? credential.type;
}

const REQUIRED_ACTIONS: Record<string, string> = {
  UPDATE_PASSWORD: 'Parolasını değiştirsin',
  CONFIGURE_TOTP: 'Doğrulama uygulaması kursun',
  'webauthn-register-passwordless': 'Passkey eklesin',
  VERIFY_EMAIL: 'E-postasını doğrulasın',
  TERMS_AND_CONDITIONS: 'Koşulları kabul etsin',
  UPDATE_PROFILE: 'Profilini gözden geçirsin',
};

export function requiredActionLabel(alias: string): string {
  return REQUIRED_ACTIONS[alias] ?? alias;
}

const EVENTS: Record<string, string> = {
  LOGIN: 'Giriş',
  LOGIN_ERROR: 'Başarısız giriş',
  LOGOUT: 'Çıkış',
  UPDATE_PASSWORD: 'Parola değişti',
  UPDATE_CREDENTIAL: 'Kimlik bilgisi değişti',
  REMOVE_CREDENTIAL: 'Kimlik bilgisi kaldırıldı',
  UPDATE_EMAIL: 'E-posta değişti',
  VERIFY_EMAIL: 'E-posta doğrulandı',
};

export function eventLabel(event: Pick<LoginEvent, 'type'>): string {
  return EVENTS[event.type] ?? event.type;
}

const CLIENTS: Record<string, string> = {
  admin: 'Yönetim paneli',
  'account-center': 'Hesap merkezi',
  skyforms: 'Form',
  skymail: 'SkyMail',
  'frontend-main': 'Site',
  'frontend-arge': 'AR-GE sitesi',
  'sky-app': 'SkyApp',
  skyapp: 'SkyApp',
  place: 'YıldızPlace',
  'security-admin-console': 'Yönetim konsolu',
  account: 'Hesap',
  'account-console': 'Hesap',
};

export function clientLabel(clientId: string): string {
  return CLIENTS[clientId] ?? clientId;
}

/** Why the reader may not change the account here, in one line; none for a reader (DK). */
export function manageReason(reason?: string): string | null {
  switch (reason) {
    case 'own_account':
      return 'Kendi hesabın: Hesap merkezinden değiştir.';
    case 'privileged_target':
      return 'Yönetim üyesinin hesabını yalnız ADMIN değiştirir.';
    case 'service_account':
      return 'Servis hesabı.';
    case 'account_not_active':
      return 'Hesap silinmiş ya da siliniyor.';
    default:
      return null;
  }
}

export function hasPassword(account: Pick<UserAccount, 'credentials'>): boolean {
  return account.credentials.some((credential) => credential.type === 'password');
}

const WHEN = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});

const DAY = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeZone: 'Europe/Istanbul' });

export function formatWhen(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : WHEN.format(d);
}

export function formatDay(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : DAY.format(d);
}

const PASSWORD_POLICY: Record<string, string> = {
  invalidPasswordMinLengthMessage: 'Parola en az 8 karakter olmalı.',
  invalidPasswordNotUsernameMessage: 'Parola kullanıcı adıyla aynı olamaz.',
  invalidPasswordNotEmailMessage: 'Parola e-posta adresiyle aynı olamaz.',
  invalidPasswordHistoryMessage: 'Parola son kullanılanlardan biri olamaz.',
};

/** The realm's password rule a refused password broke (core's `policy`). */
export function passwordPolicyMessage(policy: unknown): string {
  return (typeof policy === 'string' && PASSWORD_POLICY[policy]) || 'Parola kurallara uymuyor.';
}
