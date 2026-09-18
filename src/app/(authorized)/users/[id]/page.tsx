'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { UserCardView } from '@/components/identity/UserCardView';
import { identityApi, type ClientRole, type Group, type UserCard } from '@/lib/api/identity';
import { ProblemError } from '@/lib/api/core';
import { pickerMatch, roleKey } from '@/lib/picker';

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
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
      .filter((role) => !heldRoles.has(roleKey(role)) && pickerMatch(roleQuery, role.role, role.clientId))
      .map((role) => ({
        id: roleKey(role),
        title: role.role,
        subtitle: role.clientId,
      }));
  }, [catalog, heldRoles, roleQuery]);

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!card) return <p className="text-sm text-neutral-500">Yükleniyor…</p>;

  return (
    <div className="space-y-6">
      <UserCardView
        card={card}
        onAddGroup={() => void openGroups()}
        onAddRole={() => void openRoles()}
        onRemoveRole={async (role) => {
          await identityApi.removeExtraRole(card.id, role);
          await load();
        }}
      />
      <button
        type="button"
        className="border-skylab-400/40 bg-skylab-500/10 text-2xs text-skylab-300 inline-flex h-8 items-center gap-2 rounded-md border px-3 font-medium"
        onClick={async () => {
          await identityApi.logoutUser(card.id);
        }}
      >
        <LogOut className="h-4 w-4" />
        Oturumları kapat
      </button>
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
    </div>
  );
}
