'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Avatar } from '@/components/chrome/Avatar';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { ListItem } from '@/components/chrome/ListItem';
import { Pagination } from '@/components/chrome/Pagination';
import { identityApi, type Person } from '@/lib/api/identity';
import { ProblemError } from '@/lib/api/core';

const PAGE_SIZE = 10;

export default function UsersPage() {
  const [users, setUsers] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  async function load() {
    try {
      setUsers(await identityApi.listUsers());
      setError(null);
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Kullanıcılar yüklenemedi');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const slice = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return users.slice(start, start + PAGE_SIZE);
  }, [users, page]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kullanıcılar"
        description="Keycloak dizini. Promote grup üyeliğidir."
        actions={
          <ActionButton
            icon={Plus}
            variant="primary"
            label="Kullanıcı ekle"
            onClick={() => setCreating(true)}
          />
        }
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
        {slice.map((u) => {
          const name = `${u.firstName} ${u.lastName}`.trim();
          return (
            <ListItem
              key={u.id}
              href={`/users/${u.id}`}
              title={name || u.email}
              subtitle={u.email}
              leading={<Avatar name={name} email={u.email} />}
            />
          );
        })}
      </div>
      <Pagination current={page} totalPages={totalPages} onPageChange={setPage} />
      <Drawer open={creating} onClose={() => setCreating(false)} title="Kullanıcı ekle">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await identityApi.createUser({ email, firstName, lastName });
              setEmail('');
              setFirstName('');
              setLastName('');
              setCreating(false);
              await load();
            } catch (err) {
              setError(err instanceof ProblemError ? err.title : 'Oluşturulamadı');
            }
          }}
        >
          <Field
            placeholder="Ad"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Field
            placeholder="Soyad"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <Field
            placeholder="E-posta"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            className="border-skylab-400/40 bg-skylab-500/10 text-2xs text-skylab-300 h-8 rounded-md border px-3 font-medium"
          >
            Kaydet
          </button>
        </form>
      </Drawer>
    </div>
  );
}
