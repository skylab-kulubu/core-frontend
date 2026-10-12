'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { SaveButton } from '@/components/chrome/SaveButton';
import { StateCard } from '@/components/chrome/StateCard';
import { UserCardView } from '@/components/identity/UserCardView';
import { identityApi, type ClientRole, type Group, type UserCard } from '@/lib/api/identity';
import { ProblemError } from '@/lib/api/core';
import { isPrivileged } from '@/lib/auth/groups';
import { pickerMatch, roleKey } from '@/lib/picker';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const privileged = isPrivileged(user?.groups ?? []);
  const [card, setCard] = useState<UserCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [groupQuery, setGroupQuery] = useState('');
  const [roleQuery, setRoleQuery] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [catalog, setCatalog] = useState<ClientRole[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerFailed, setPickerFailed] = useState(false);
  // A refused change (403 included) stays on the card; `error` replaces the card when it cannot load
  const [actionError, setActionError] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();

  async function load() {
    try {
      setCard(await identityApi.getUser(params.id));
      setError(null);
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Yüklenemedi');
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
      setActionError(err instanceof ProblemError ? err.title : failed);
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

  async function openRoles() {
    setRoleQuery('');
    setPickError(null);
    setRoleOpen(true);
    setPickerLoading(true);
    try {
      setCatalog(await identityApi.listClientRoles());
      setPickerFailed(false);
    } catch {
      setPickerFailed(true);
    } finally {
      setPickerLoading(false);
    }
  }

  const heldRoles = useMemo(() => {
    const held = new Set<string>();
    for (const role of card?.inheritedRoles ?? []) held.add(roleKey(role));
    for (const role of card?.extraRoles ?? []) held.add(roleKey(role));
    return held;
  }, [card]);

  const groupOptions = useMemo(() => {
    const have = new Set((card?.groups ?? []).map((g) => g.id));
    return groups
      .filter((g) => !have.has(g.id) && pickerMatch(groupQuery, g.path, g.name))
      .map((g) => ({ id: g.id, title: g.path, subtitle: g.name }));
  }, [groups, card, groupQuery]);

  const roleOptions = useMemo(() => {
    return catalog
      .filter(
        (role) => !heldRoles.has(roleKey(role)) && pickerMatch(roleQuery, role.role, role.clientId),
      )
      .map((role) => ({
        id: roleKey(role),
        title: role.role,
        subtitle: role.clientId,
      }));
  }, [catalog, heldRoles, roleQuery]);

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
        canEditProfile={privileged}
        onSaveProfile={
          privileged
            ? (patch) =>
                change(
                  () => identityApi.updateUser(card.id, patch),
                  'Profil kaydedildi',
                  'Profil kaydedilemedi',
                )
            : undefined
        }
        onAddGroup={privileged ? () => void openGroups() : undefined}
        onAddRole={privileged ? () => void openRoles() : undefined}
        onRemoveRole={
          privileged
            ? (role) =>
                confirm({
                  title: `${role.role} rolü ${name} kişisinden kaldırılsın mı?`,
                  description: `${role.clientId} uygulamasında bu rolün verdiği yetkiler gider.`,
                  actionLabel: 'Rolü kaldır',
                  onConfirm: () =>
                    change(
                      () => identityApi.removeExtraRole(card.id, role),
                      'Rol kaldırıldı',
                      'Rol kaldırılamadı',
                    ),
                })
            : undefined
        }
      />
      {privileged ? (
        <SaveButton
          type="button"
          onClick={() =>
            confirm({
              title: `${name} için bütün oturumlar kapatılsın mı?`,
              description:
                'Kişi açık olduğu her yerden çıkış yapar ve yeniden giriş yapması gerekir.',
              actionLabel: 'Oturumları kapat',
              onConfirm: async () => {
                setActionError(null);
                try {
                  await identityApi.logoutUser(card.id);
                  notify.success('Oturumlar kapatıldı');
                } catch (err) {
                  setActionError(
                    err instanceof ProblemError ? err.title : 'Oturumlar kapatılamadı',
                  );
                }
              },
            })
          }
        >
          <LogOut className="h-4 w-4" />
          Oturumları kapat
        </SaveButton>
      ) : null}
      {confirmDialog}
      {privileged ? (
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
              await identityApi.addMember(groupId, card.id);
              setGroupOpen(false);
              notify.success('Gruba eklendi');
              await load();
            } catch (err) {
              setPickError(err instanceof ProblemError ? err.title : 'Gruba eklenemedi');
            }
          }}
        />
      ) : null}
      {privileged ? (
        <PickerDrawer
          open={roleOpen}
          onClose={() => setRoleOpen(false)}
          title="Rol ekle"
          query={roleQuery}
          onQuery={setRoleQuery}
          placeholder="Client veya rol"
          loading={pickerLoading}
          failed={pickerFailed}
          options={roleOptions}
          emptyMessage="Rol yok"
          error={pickError}
          onPick={async (id) => {
            const role = catalog.find((row) => roleKey(row) === id);
            if (!role) return;
            setPickError(null);
            try {
              await identityApi.addExtraRole(card.id, role);
              setRoleOpen(false);
              notify.success('Rol eklendi');
              await load();
            } catch (err) {
              setPickError(err instanceof ProblemError ? err.title : 'Rol eklenemedi');
            }
          }}
        />
      ) : null}
    </div>
  );
}
