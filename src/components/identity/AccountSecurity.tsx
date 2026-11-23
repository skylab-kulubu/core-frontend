'use client';

import { Badge, Button, Notice } from '@skylab-kulubu/skylcn-ui';
import { KeyRound, Mail, Pencil, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { CardSection } from '@/components/identity/UserCardView';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { accountCenterUrl } from '@/lib/club-switcher';
import {
  REQUIRED_ACTIONS,
  userAccountApi,
  type PasswordResult,
  type UserAccount,
} from '@/lib/api/user-account';
import { coreProblemMessage } from '@/lib/core-problems';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';
import {
  clientLabel,
  credentialLabel,
  eventLabel,
  formatDay,
  formatWhen,
  hasPassword,
  manageReason,
  requiredActionLabel,
} from '@/lib/user-account';
import { EmailChangeDialog, TemporaryPasswordDialog } from './AccountDialogs';

/** A titled block inside the card. */
function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border-subtle space-y-2 border-t pt-3 first:border-t-0 first:pt-0">
      <h3 className={`text-subtle-foreground font-medium ${TEXT_SECONDARY}`}>{title}</h3>
      {children}
    </section>
  );
}

/** One line: what, its value, and what can be done with it. */
function Row({
  label,
  children,
  actions,
}: {
  label: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
      <span className="text-muted-foreground w-28 shrink-0 sm:w-36">{label}</span>
      {/* Room for an address: the actions go below it before they squeeze it */}
      <span className="text-secondary-foreground flex min-w-0 flex-1 basis-44 flex-wrap items-center gap-1.5">
        {children}
      </span>
      {actions ? (
        <span className="ml-auto flex flex-wrap items-center gap-1.5">{actions}</span>
      ) : null}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-subtle-foreground text-sm">{children}</p>;
}

function Verified({ on }: { on: boolean }) {
  return on ? <Badge tone="success">Onaylı</Badge> : <Badge tone="warning">Onaylanmadı</Badge>;
}

/**
 * "Hesap ve güvenlik" on the person card: the person's Keycloak account
 * through core (core docs/user-accounts.md). Every change asks core; the
 * buttons show only where core said the reader may (`account.can`).
 */
export function AccountSecurity({
  account,
  personName,
  onChanged,
}: {
  account: UserAccount;
  personName: string;
  onChanged: () => Promise<void> | void;
}) {
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [editingActions, setEditingActions] = useState(false);
  const [actions, setActions] = useState<string[]>([]);
  const [rowError, setRowError] = useState<string | null>(null);
  const [savingActions, setSavingActions] = useState(false);
  const id = account.id;
  const manage = account.can.manage;
  const reason = manageReason(account.can.reason);
  const email = account.email;

  /** A change without a question: says it went through, or why not, at the card's top. */
  async function run(action: () => Promise<unknown>, done: string, failed: string) {
    setRowError(null);
    try {
      await action();
    } catch (err) {
      setRowError(coreProblemMessage(err, failed));
      return;
    }
    notify.success(done);
    await onChanged();
  }

  function ask(
    title: string,
    actionLabel: string,
    action: () => Promise<unknown>,
    done: string,
    failure: string,
    options: { description?: string; destructive?: boolean } = {},
  ) {
    confirm({
      title,
      description: options.description,
      actionLabel,
      destructive: options.destructive,
      onConfirm: async () => {
        await action();
        notify.success(done);
        await onChanged();
      },
      failure,
    });
  }

  const askEnabled = () =>
    account.enabled
      ? ask(
          `${personName} devre dışı bırakılsın mı?`,
          'Devre dışı bırak',
          () => userAccountApi.setEnabled(id, false),
          'Hesap devre dışı',
          'Hesap devre dışı bırakılamadı',
          { description: 'Giriş yapamaz; açık oturumları kapanır.', destructive: true },
        )
      : void run(
          () => userAccountApi.setEnabled(id, true),
          'Hesap etkin',
          'Hesap etkinleştirilemedi',
        );

  const passwordLine = hasPassword(account) ? 'Var' : 'Yok';
  const pendingActions = account.requiredActions;

  function startActions() {
    setActions(
      pendingActions.filter((alias) => (REQUIRED_ACTIONS as readonly string[]).includes(alias)),
    );
    setEditingActions(true);
  }

  async function saveActions() {
    setSavingActions(true);
    setRowError(null);
    try {
      await userAccountApi.setRequiredActions(id, actions);
      setEditingActions(false);
      notify.success('Gerekli eylemler kaydedildi');
      await onChanged();
    } catch (err) {
      setRowError(coreProblemMessage(err, 'Gerekli eylemler kaydedilemedi'));
    } finally {
      setSavingActions(false);
    }
  }

  if (account.status !== 'active') {
    return (
      <CardSection id="hesap" title="Hesap ve güvenlik">
        <Empty>Hesap silinmiş ya da siliniyor.</Empty>
      </CardSection>
    );
  }
  return (
    <CardSection
      id="hesap"
      title="Hesap ve güvenlik"
      actions={
        account.enabled ? (
          <Badge tone="success">Etkin</Badge>
        ) : (
          <Badge tone="danger">Devre dışı</Badge>
        )
      }
    >
      {reason ? (
        <p className={`text-muted-foreground ${TEXT_SECONDARY}`}>
          {reason}{' '}
          {account.can.reason === 'own_account' ? (
            <a href={accountCenterUrl()} className="text-skylab-300 hover:underline">
              Hesap merkezi
            </a>
          ) : null}
        </p>
      ) : null}
      {rowError ? (
        <p role="alert" className="text-destructive text-sm">
          {rowError}
        </p>
      ) : null}
      {account.lockout.locked ? (
        <Notice tone="warning" title={`Geçici kilitli · ${account.lockout.failures} hatalı deneme`}>
          {manage ? (
            <Button
              size="xs"
              variant="outline"
              className={`mt-2 ${BUTTON_TEXT}`}
              onClick={() =>
                void run(() => userAccountApi.clearLockout(id), 'Kilit açıldı', 'Kilit açılamadı')
              }
            >
              Kilidi aç
            </Button>
          ) : null}
        </Notice>
      ) : null}
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Block title="Hesap">
            <Row
              label="Durum"
              actions={
                manage ? (
                  <Button className={BUTTON_TEXT} size="xs" variant="outline" onClick={askEnabled}>
                    {account.enabled ? 'Devre dışı bırak' : 'Etkinleştir'}
                  </Button>
                ) : null
              }
            >
              {account.enabled ? 'Giriş yapabilir' : 'Giriş yapamaz'}
            </Row>
            <Row label="Kullanıcı adı">{account.username || '—'}</Row>
            <Row label="Açıldı">{formatDay(account.createdAt)}</Row>
            <Row label="Son giriş">
              {account.logins ? formatWhen(account.logins.last) : 'Okunamıyor'}
            </Row>
          </Block>

          <Block title="E-posta">
            <Row
              label="Birincil"
              actions={
                manage ? (
                  <>
                    {email?.primary && !email.primaryVerified ? (
                      <>
                        <Button
                          className={BUTTON_TEXT}
                          size="xs"
                          variant="outline"
                          onClick={() =>
                            ask(
                              `${email.primary} onaylı sayılsın mı?`,
                              'Onaylı işaretle',
                              () => userAccountApi.verifyEmail(id),
                              'E-posta onaylı',
                              'Onaylanamadı',
                            )
                          }
                        >
                          Onaylı işaretle
                        </Button>
                        <Button
                          className={BUTTON_TEXT}
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            void run(
                              () => userAccountApi.sendVerificationMail(id),
                              'Doğrulama e-postası gönderildi',
                              'E-posta gönderilemedi',
                            )
                          }
                        >
                          <Mail className="size-3.5" />
                          Doğrulama e-postası
                        </Button>
                      </>
                    ) : null}
                    <Button
                      className={BUTTON_TEXT}
                      size="xs"
                      variant="outline"
                      onClick={() => setEmailOpen(true)}
                    >
                      <Pencil className="size-3.5" />
                      Değiştir
                    </Button>
                  </>
                ) : null
              }
            >
              {email?.primary ? (
                <>
                  <span className="truncate">{email.primary}</span>
                  <Verified on={email.primaryVerified} />
                </>
              ) : (
                '—'
              )}
            </Row>
            <Row
              label="Okul"
              actions={
                manage && email?.school && email.primaryKind !== 'school' ? (
                  <Button
                    className={BUTTON_TEXT}
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      ask(
                        `${email.school} birincil olsun mu?`,
                        'Birincil yap',
                        () => userAccountApi.setPrimary(id, 'school'),
                        'Birincil adres değişti',
                        'Birincil adres değiştirilemedi',
                      )
                    }
                  >
                    Birincil yap
                  </Button>
                ) : null
              }
            >
              {email?.school ? (
                <>
                  <span className="truncate">{email.school}</span>
                  {account.ytuVerified ? <Badge tone="brand">YTÜ</Badge> : null}
                </>
              ) : (
                '—'
              )}
            </Row>
            <Row
              label="Kişisel"
              actions={
                manage && email?.personal ? (
                  <>
                    {!email.personalVerified &&
                    !(email.primaryKind === 'personal' && !email.primaryVerified) ? (
                      // The Birincil row offers it for an unproven personal primary; here also
                      // for a personal primary a verification link proved (Keycloak's flag, no stamp)
                      <Button
                        className={BUTTON_TEXT}
                        size="xs"
                        variant="outline"
                        onClick={() =>
                          ask(
                            `${email.personal} onaylı sayılsın mı?`,
                            'Onaylı işaretle',
                            () => userAccountApi.verifyEmail(id, 'personal'),
                            'E-posta onaylı',
                            'Onaylanamadı',
                          )
                        }
                      >
                        Onaylı işaretle
                      </Button>
                    ) : null}
                    {email.personalVerified && email.primaryKind !== 'personal' ? (
                      <Button
                        className={BUTTON_TEXT}
                        size="xs"
                        variant="ghost"
                        onClick={() =>
                          ask(
                            `${email.personal} birincil olsun mu?`,
                            'Birincil yap',
                            () => userAccountApi.setPrimary(id, 'personal'),
                            'Birincil adres değişti',
                            'Birincil adres değiştirilemedi',
                          )
                        }
                      >
                        Birincil yap
                      </Button>
                    ) : null}
                  </>
                ) : null
              }
            >
              {email?.personal ? (
                <>
                  <span className="truncate">{email.personal}</span>
                  <Verified on={email.personalVerified} />
                </>
              ) : (
                '—'
              )}
            </Row>
          </Block>

          <Block title="Parola">
            <Row
              label="Parola"
              actions={
                manage ? (
                  <>
                    <Button
                      className={BUTTON_TEXT}
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        ask(
                          'Parola sıfırlama e-postası gönderilsin mi?',
                          'Gönder',
                          () => userAccountApi.sendPasswordMail(id),
                          'Sıfırlama e-postası gönderildi',
                          'E-posta gönderilemedi',
                          { description: email?.primary ? `Alıcı: ${email.primary}` : undefined },
                        )
                      }
                    >
                      <Mail className="size-3.5" />
                      Sıfırlama e-postası
                    </Button>
                    <Button
                      className={BUTTON_TEXT}
                      size="xs"
                      variant="outline"
                      onClick={() => setPasswordOpen(true)}
                    >
                      <KeyRound className="size-3.5" />
                      Geçici parola
                    </Button>
                  </>
                ) : null
              }
            >
              {passwordLine}
            </Row>
            {editingActions ? (
              <fieldset className="space-y-2 pt-1">
                <legend className="text-muted-foreground mb-1 text-sm">Gerekli eylemler</legend>
                {REQUIRED_ACTIONS.map((alias) => (
                  <label
                    key={alias}
                    className="text-secondary-foreground flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={actions.includes(alias)}
                      onChange={(event) =>
                        setActions((current) =>
                          event.target.checked
                            ? [...current, alias]
                            : current.filter((row) => row !== alias),
                        )
                      }
                    />
                    {requiredActionLabel(alias)}
                  </label>
                ))}
                <div className="flex gap-2 pt-1">
                  <Button
                    className={BUTTON_TEXT}
                    size="xs"
                    variant="primary"
                    pending={savingActions}
                    onClick={() => void saveActions()}
                  >
                    Kaydet
                  </Button>
                  <Button
                    className={BUTTON_TEXT}
                    size="xs"
                    variant="ghost"
                    disabled={savingActions}
                    onClick={() => setEditingActions(false)}
                  >
                    Vazgeç
                  </Button>
                </div>
              </fieldset>
            ) : (
              <Row
                label="Gerekli eylemler"
                actions={
                  manage ? (
                    <Button
                      className={BUTTON_TEXT}
                      size="xs"
                      variant="ghost"
                      onClick={startActions}
                    >
                      <Pencil className="size-3.5" />
                      Düzenle
                    </Button>
                  ) : null
                }
              >
                {pendingActions.length
                  ? pendingActions.map((alias) => (
                      <Badge key={alias} tone="warning">
                        {requiredActionLabel(alias)}
                      </Badge>
                    ))
                  : 'Yok'}
              </Row>
            )}
          </Block>
        </div>
        <div className="space-y-4">
          <Block title="Kimlik bilgileri">
            {account.credentials.length ? (
              <ul className="space-y-1.5">
                {account.credentials.map((credential) => (
                  <li key={credential.id}>
                    <Row
                      label={credentialLabel(credential)}
                      actions={
                        manage ? (
                          <Button
                            className={BUTTON_TEXT}
                            size="xs"
                            variant="ghost"
                            onClick={() =>
                              ask(
                                `${credentialLabel(credential)} kaldırılsın mı?`,
                                'Kaldır',
                                () => userAccountApi.deleteCredential(id, credential.id),
                                'Kimlik bilgisi kaldırıldı',
                                'Kaldırılamadı',
                                { destructive: true },
                              )
                            }
                          >
                            <X className="size-3.5" />
                            Kaldır
                          </Button>
                        ) : null
                      }
                    >
                      {credential.label ? (
                        <span className="truncate">{credential.label}</span>
                      ) : null}
                      <span className="text-subtle-foreground text-xs">
                        {formatDay(credential.createdAt)}
                      </span>
                    </Row>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Yok</Empty>
            )}
          </Block>

          <Block title="Bağlı hesaplar">
            {account.identityProviders.length ? (
              account.identityProviders.map((link) => (
                <Row
                  key={link.provider}
                  label={link.ytu ? 'YTÜ (Microsoft)' : link.provider}
                  actions={
                    manage ? (
                      <Button
                        className={BUTTON_TEXT}
                        size="xs"
                        variant="ghost"
                        onClick={() =>
                          ask(
                            `${link.ytu ? 'YTÜ' : link.provider} bağlantısı kaldırılsın mı?`,
                            'Bağlantıyı kaldır',
                            () => userAccountApi.unlinkIdentity(id, link.provider),
                            'Bağlantı kaldırıldı',
                            'Bağlantı kaldırılamadı',
                            {
                              description: link.ytu
                                ? 'Ad ve okul e-postası kilidi kalkar.'
                                : undefined,
                              destructive: true,
                            },
                          )
                        }
                      >
                        <X className="size-3.5" />
                        Ayır
                      </Button>
                    ) : null
                  }
                >
                  <span className="truncate">{link.userName || '—'}</span>
                </Row>
              ))
            ) : (
              <Empty>Yok</Empty>
            )}
          </Block>

          <Block title={`Oturumlar · ${account.sessions.length}`}>
            {account.sessions.length ? (
              <ul className="space-y-1.5">
                {account.sessions.map((session, index) => (
                  <li key={`${session.start}-${index}`}>
                    <Row label={formatWhen(session.lastAccess)}>
                      {session.clients.map(clientLabel).join(', ') || '—'}
                    </Row>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Açık oturum yok</Empty>
            )}
          </Block>

          <Block title="Son girişler">
            {account.logins === null ? (
              <Empty>Okunamıyor</Empty>
            ) : account.logins.events.length ? (
              <ul className="space-y-1.5">
                {account.logins.events.map((event, index) => (
                  <li key={`${event.time}-${index}`}>
                    <Row label={formatWhen(event.time)}>
                      <span className={event.type === 'LOGIN_ERROR' ? 'text-warning' : undefined}>
                        {eventLabel(event)}
                      </span>
                      {event.client ? (
                        <span className="text-subtle-foreground text-xs">
                          {clientLabel(event.client)}
                        </span>
                      ) : null}
                    </Row>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Son 30 günde yok</Empty>
            )}
          </Block>
        </div>
      </div>
      {confirmDialog}
      {manage ? (
        <>
          <TemporaryPasswordDialog
            open={passwordOpen}
            onOpenChange={(open) => {
              setPasswordOpen(open);
              if (!open) void onChanged();
            }}
            personName={personName}
            onSet={(password): Promise<PasswordResult> => userAccountApi.setPassword(id, password)}
          />
          <EmailChangeDialog
            open={emailOpen}
            onOpenChange={setEmailOpen}
            current={email?.primary}
            // The personal address is the primary (or there is none): the new one becomes it
            primaryForced={!email?.primary || email.primaryKind === 'personal'}
            onSave={async (change) => {
              await userAccountApi.changeEmail(id, change);
              notify.success('E-posta değişti');
              await onChanged();
            }}
          />
        </>
      ) : null}
    </CardSection>
  );
}
