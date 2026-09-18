'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Avatar } from '@/components/chrome/Avatar';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { Pagination } from '@/components/chrome/Pagination';
import { identityApi, type Person } from '@/lib/api/identity';
import { ProblemError } from '@/lib/api/core';
import { listStatus } from '@/lib/list-status';

const PAGE_SIZE = 10;

export default function UsersPage() {
  const [users, setUsers] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  async function load(q: string) {
    try {
      setUsers(await identityApi.listUsers(q));
      setError(null);
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Kullanıcılar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(
      () => {
        void load(query);
      },
      query.trim() ? 250 : 0,
    );
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

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
      <Field
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ad, e-posta, okul maili"
        aria-label="Kullanıcı ara"
      />
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: users.length,
          emptyMessage: 'Kullanıcı yok',
        })}
      >
        {slice.map((u) => {
          const name = `${u.firstName} ${u.lastName}`.trim();
          return (
            <ListItem
              key={u.id}
              href={`/users/${u.id}`}
              title={name || u.email}
              subtitle={u.skyNumber || u.schoolEmail || u.email}
              leading={<Avatar name={name} email={u.email} />}
            />
          );
        })}
      </ListPanel>
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
              await load(query);
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
