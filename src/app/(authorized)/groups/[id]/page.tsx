'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Field } from '@/components/chrome/Field';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { identityApi, type ClientRole, type Group, type Person } from '@/lib/api/identity';
import { ProblemError } from '@/lib/api/core';
import { listStatus } from '@/lib/list-status';
import { pickerMatch, roleKey } from '@/lib/picker';

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Person[]>([]);
  const [roles, setRoles] = useState<ClientRole[]>([]);
  const [attrKey, setAttrKey] = useState('');
  const [attrValue, setAttrValue] = useState('');
  const [rename, setRename] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberOpen, setMemberOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [roleQuery, setRoleQuery] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [catalog, setCatalog] = useState<ClientRole[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerFailed, setPickerFailed] = useState(false);

  async function load() {
    try {
      const [g, mem, mapped] = await Promise.all([
        identityApi.getGroup(id),
        identityApi.members(id),
        identityApi.groupRoles(id),
      ]);
      setGroup(g);
      setMembers(mem);
      setRoles(mapped);
      setError(null);
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  useEffect(() => {
    if (!memberOpen) return;
    const handle = window.setTimeout(
      () => {
        setPickerLoading(true);
        identityApi
          .listUsers(memberQuery)
          .then((rows) => {
            setPeople(rows);
            setPickerFailed(false);
          })
          .catch(() => setPickerFailed(true))
          .finally(() => setPickerLoading(false));
      },
      memberQuery.trim() ? 250 : 0,
    );
    return () => window.clearTimeout(handle);
  }, [memberOpen, memberQuery]);

  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);
  const mappedKeys = useMemo(() => new Set(roles.map(roleKey)), [roles]);
  const attrs = group?.attributes ?? {};

  const memberOptions = people
    .filter((person) => !memberIds.has(person.id))
    .map((person) => ({
      id: person.id,
      title: `${person.firstName} ${person.lastName}`.trim() || person.email,
      subtitle: person.email,
    }));

  const roleOptions = catalog
    .filter((role) => !mappedKeys.has(roleKey(role)) && pickerMatch(roleQuery, role.role, role.clientId))
    .map((role) => ({
      id: roleKey(role),
      title: role.role,
      subtitle: role.clientId,
    }));

  if (error && !group) return <p className="text-sm text-red-300">{error}</p>;
  if (loading && !group) return <p className="text-sm text-neutral-500">Yükleniyor…</p>;

  return (
    <div className="space-y-6">
      <PageHeader title={group?.name ?? id} description={group?.path} />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!rename.trim()) return;
          await identityApi.updateGroup(id, { name: rename.trim() });
          setRename('');
          await load();
        }}
      >
        <Field
          className="w-48"
          value={rename}
          onChange={(e) => setRename(e.target.value)}
          placeholder="Yeni ad"
          required
        />
        <button
          type="submit"
          className="border-skylab-400/40 bg-skylab-500/10 text-2xs text-skylab-300 h-8 rounded-md border px-3 font-medium"
        >
          Yeniden adlandır
        </button>
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">Üyeler</h2>
          <ActionButton
            icon={Plus}
            variant="primary"
            label="Üye ekle"
            onClick={() => {
              setMemberQuery('');
              setPeople([]);
              setMemberOpen(true);
            }}
          />
        </div>
        <ListPanel
          status={listStatus({
            loading: false,
            failed: Boolean(error),
            rowCount: members.length,
            emptyMessage: 'Üye yok',
          })}
        >
          {members.map((m) => (
            <ListItem
              key={m.id}
              href={`/users/${m.id}`}
              title={`${m.firstName} ${m.lastName}`.trim() || m.email}
              subtitle={m.email}
              trailing={
                <ActionButton
                  icon={X}
                  label="Çıkar"
                  onClick={async () => {
                    await identityApi.removeMember(id, m.id);
                    await load();
                  }}
                />
              }
            />
          ))}
        </ListPanel>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">
            Group → client-role
          </h2>
          <ActionButton
            icon={Plus}
            variant="primary"
            label="Rol ekle"
            onClick={async () => {
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
            }}
          />
        </div>
        <ListPanel
          status={listStatus({
            loading: false,
            failed: Boolean(error),
            rowCount: roles.length,
            emptyMessage: 'Client rol yok',
          })}
        >
          {roles.map((r) => (
            <ListItem
              key={roleKey(r)}
              title={r.role}
              subtitle={r.clientId}
              trailing={
                <ActionButton
                  icon={X}
                  label="Kaldır"
                  onClick={async () => {
                    await identityApi.setGroupRoles(
                      id,
                      roles.filter((x) => x.clientId !== r.clientId || x.role !== r.role),
                    );
                    await load();
                  }}
                />
              }
            />
          ))}
        </ListPanel>
      </section>

      <section className="space-y-3">
        <h2 className="text-3xs tracking-[0.18em] text-neutral-500 uppercase">Öznitelikler</h2>
        <ListPanel
          status={listStatus({
            loading: false,
            failed: Boolean(error),
            rowCount: Object.keys(attrs).length,
            emptyMessage: 'Öznitelik yok',
          })}
        >
          {Object.entries(attrs).map(([k, v]) => (
            <ListItem
              key={k}
              title={v}
              subtitle={k}
              trailing={
                <ActionButton
                  icon={X}
                  label="Kaldır"
                  onClick={async () => {
                    const next = { ...attrs };
                    delete next[k];
                    await identityApi.updateGroup(id, { attributes: next });
                    await load();
                  }}
                />
              }
            />
          ))}
        </ListPanel>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!attrKey) return;
            await identityApi.updateGroup(id, { attributes: { ...attrs, [attrKey]: attrValue } });
            setAttrKey('');
            setAttrValue('');
            await load();
          }}
        >
          <Field
            className="w-40"
            value={attrKey}
            onChange={(e) => setAttrKey(e.target.value)}
            placeholder="key"
          />
          <Field
            className="w-40"
            value={attrValue}
            onChange={(e) => setAttrValue(e.target.value)}
            placeholder="value"
          />
          <button
            type="submit"
            className="border-skylab-400/40 bg-skylab-500/10 text-2xs text-skylab-300 h-8 rounded-md border px-3 font-medium"
          >
            Kaydet
          </button>
        </form>
      </section>

      <PickerDrawer
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
        title="Üye ekle"
        query={memberQuery}
        onQuery={setMemberQuery}
        placeholder="Ad, e-posta"
        loading={pickerLoading}
        failed={pickerFailed}
        options={memberOptions}
        emptyMessage="Kullanıcı yok"
        onPick={async (userId) => {
          await identityApi.addMember(id, userId);
          setMemberOpen(false);
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
        onPick={async (picked) => {
          const role = catalog.find((row) => roleKey(row) === picked);
          if (!role) return;
          await identityApi.setGroupRoles(id, [...roles, role]);
          setRoleOpen(false);
          await load();
        }}
      />
    </div>
  );
}
