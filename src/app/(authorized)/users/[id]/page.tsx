'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { SaveButton } from '@/components/chrome/SaveButton';
import { StateCard } from '@/components/chrome/StateCard';
import { UserCardView } from '@/components/identity/UserCardView';
import { useMemberAdd } from '@/components/identity/use-member-add';
import { useChromeCrumbName } from '@/components/layout/chrome-crumb-names';
import { identityApi, type Group, type UserCard } from '@/lib/api/identity';
import { coreProblemMessage } from '@/lib/core-problems';
import { isPrivileged } from '@/lib/auth/groups';
import { pickerMatch } from '@/lib/picker';
import { useAppCan } from '@/lib/use-app-can';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  // core's capabilities decide the buttons (a DK member reads, writes nothing);
  // the group rule stands in only when they cannot be read
  const can = useAppCan(isPrivileged(user?.groups ?? []));
  const canWrite = can('user.write');
  const canAddGroup = can('group.write');
  const [card, setCard] = useState<UserCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupQuery, setGroupQuery] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerFailed, setPickerFailed] = useState(false);
  // A refused change (403 included) stays on the card; `error` replaces the card when it cannot load
  const [actionError, setActionError] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  const [addMember, addMemberDialog] = useMemberAdd();

  async function load() {
    try {
      setCard(await identityApi.getUser(params.id));
      setError(null);
    } catch (err) {
      setError(coreProblemMessage(err, 'Yüklenemedi'));
    }
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  /** Runs a change on the card: says it went through, or why it did not. */
  async function change(action: () => Promise<unknown>, done: string, failed: string) {
    setActionError(null);
    try {
      await action();
      notify.success(done);
      await load();
    } catch (err) {
      setActionError(coreProblemMessage(err, failed));
    }
  }

  async function openGroups() {
    setGroupQuery('');
    setPickError(null);
    setGroupOpen(true);
    setPickerLoading(true);
    try {
      setGroups(await identityApi.listGroups());
      setPickerFailed(false);
    } catch {
      setPickerFailed(true);
    } finally {
      setPickerLoading(false);
    }
  }

  const groupOptions = useMemo(() => {
    const have = new Set((card?.groups ?? []).map((g) => g.id));
    return groups
      .filter((g) => !have.has(g.id) && pickerMatch(groupQuery, g.path, g.name))
      .map((g) => ({ id: g.id, title: g.path, subtitle: g.name }));
  }, [groups, card, groupQuery]);

  useChromeCrumbName(
    `/users/${params.id}`,
    card ? `${card.firstName ?? ''} ${card.lastName ?? ''}`.trim() || card.email : null,
  );

  if (error) {
    return <StateCard title={error} description="Kişi kartına dönemiyor." tone="danger" />;
  }
  if (!card) return <StateCard title="Yükleniyor…" isLoading />;
  const name = `${card.firstName ?? ''} ${card.lastName ?? ''}`.trim() || card.email;

  return (
    <div className="space-y-6">
      {actionError ? (
        <p role="alert" className="text-destructive text-sm">
          {actionError}
        </p>
      ) : null}
      <UserCardView
        card={card}
        canEditProfile={canWrite}
        canReadFull={can('user.readFull')}
        onSaveProfile={
          canWrite
            ? (patch) =>
                change(
                  () => identityApi.updateUser(card.id, patch),
                  'Profil kaydedildi',
                  'Profil kaydedilemedi',
                )
            : undefined
        }
        onAddGroup={canAddGroup ? () => void openGroups() : undefined}
        onRemoveRole={
          canWrite
            ? (role) =>
                confirm({
                  title: `${role.role} rolü ${name} kişisinden kaldırılsın mı?`,
                  description: `${role.clientId} uygulamasında bu rolün verdiği yetkiler gider. Kişi bu yetkiyi sürdürecekse önce rolü taşıyan gruba ekle.`,
                  actionLabel: 'Rolü kaldır',
                  onConfirm: async () => {
                    await identityApi.removeExtraRole(card.id, role);
                    notify.success('Rol kaldırıldı');
                    await load();
                  },
                  failure: 'Rol kaldırılamadı',
                })
            : undefined
        }
      />
      {canWrite ? (
        <SaveButton
          type="button"
          onClick={() =>
            confirm({
              title: `${name} için bütün oturumlar kapatılsın mı?`,
              description:
                'Kişi açık olduğu her yerden çıkış yapar ve yeniden giriş yapması gerekir.',
              actionLabel: 'Oturumları kapat',
              onConfirm: async () => {
                await identityApi.logoutUser(card.id);
                notify.success('Oturumlar kapatıldı');
              },
              failure: 'Oturumlar kapatılamadı',
            })
          }
        >
          <LogOut className="h-4 w-4" />
          Oturumları kapat
        </SaveButton>
      ) : null}
      {confirmDialog}
      {canAddGroup ? (
        <PickerDrawer
          open={groupOpen}
          onClose={() => setGroupOpen(false)}
          title="Grup ekle"
          query={groupQuery}
          onQuery={setGroupQuery}
          placeholder="Grup yolu veya adı"
          loading={pickerLoading}
          failed={pickerFailed}
          options={groupOptions}
          emptyMessage="Grup yok"
          error={pickError}
          onPick={async (groupId) => {
            setPickError(null);
            try {
              await addMember({
                groupId,
                userId: card.id,
                personName: name,
                groupName: groups.find((g) => g.id === groupId)?.name ?? groupId,
                failure: 'Gruba eklenemedi',
                onAdded: async () => {
                  setGroupOpen(false);
                  notify.success('Gruba eklendi');
                  await load();
                },
              });
            } catch (err) {
              setPickError(coreProblemMessage(err, 'Gruba eklenemedi'));
            }
          }}
        >
          {addMemberDialog}
        </PickerDrawer>
      ) : null}
    </div>
  );
}
