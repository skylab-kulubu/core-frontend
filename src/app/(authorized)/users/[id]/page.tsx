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

  async function openGroups() {
    setGroupQuery('');
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

  return (
    <div className="space-y-6">
      <UserCardView
        card={card}
        canEditProfile={privileged}
        onSaveProfile={
          privileged
            ? async (patch) => {
                await identityApi.updateUser(card.id, patch);
                await load();
              }
            : undefined
        }
        onAddGroup={privileged ? () => void openGroups() : undefined}
        onAddRole={privileged ? () => void openRoles() : undefined}
        onRemoveRole={
          privileged
            ? async (role) => {
                await identityApi.removeExtraRole(card.id, role);
                await load();
              }
            : undefined
        }
      />
      {privileged ? (
        <SaveButton
          type="button"
          onClick={async () => {
            await identityApi.logoutUser(card.id);
          }}
        >
          <LogOut className="h-4 w-4" />
          Oturumları kapat
        </SaveButton>
      ) : null}
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
          onPick={async (groupId) => {
            await identityApi.addMember(groupId, card.id);
            setGroupOpen(false);
            await load();
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
          onPick={async (id) => {
            const role = catalog.find((row) => roleKey(row) === id);
            if (!role) return;
            await identityApi.addExtraRole(card.id, role);
            setRoleOpen(false);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}
