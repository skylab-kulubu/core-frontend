'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Avatar } from '@/components/chrome/Avatar';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { SaveButton } from '@/components/chrome/SaveButton';
import { ListPanel } from '@/components/chrome/ListPanel';
import { Pagination } from '@/components/chrome/Pagination';
import { StatusChip } from '@/components/chrome/StatusChip';
import { identityApi, type Person } from '@/lib/api/identity';
import { ProblemError } from '@/lib/api/core';
import { emptyListCopy, paginateRows } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';
import { useAuth } from '@/context/AuthContext';
import { isPrivileged } from '@/lib/auth/groups';

const createUserSchema = z.object({
  firstName: z.string().trim(),
  lastName: z.string().trim(),
  email: z.string().trim().email('Geçerli bir e-posta girin.'),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

export default function UsersPage() {
  const { user } = useAuth();
  const privileged = isPrivileged(user?.groups ?? []);
  const [users, setUsers] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { firstName: '', lastName: '', email: '' },
  });

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

  const paged = paginateRows(users, page);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kullanıcılar"
        description={
          privileged ? 'Üye ekle. Grup ve roller kişi kartında.' : 'Üye dizinini görüntüle.'
        }
        actions={
          privileged ? (
            <ActionButton
              icon={Plus}
              variant="primary"
              label="Kullanıcı ekle"
              onClick={() => setCreating(true)}
            />
          ) : undefined
        }
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <ListToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Ad, e-posta, okul maili"
        searchLabel="Kullanıcı ara"
      />
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: users.length,
          emptyMessage: emptyListCopy({
            none: 'Kullanıcı yok',
            noneMatch: 'Eşleşen kullanıcı yok',
            query,
          }),
        })}
        emptyDescription={privileged ? 'Üye ekle veya aramayı temizle.' : 'Aramayı temizle.'}
      >
        {paged.slice.map((u) => {
          const name = `${u.firstName} ${u.lastName}`.trim();
          return (
            <ListItem
              key={u.id}
              href={`/users/${u.id}`}
              title={name || u.email}
              subtitle={u.skyNumber || u.schoolEmail || u.email}
              leading={<Avatar name={name} email={u.email} />}
              trailing={u.skyNumber ? <StatusChip kind="member" label={u.skyNumber} /> : undefined}
            />
          );
        })}
      </ListPanel>
      <Pagination current={paged.page} totalPages={paged.totalPages} onPageChange={setPage} />
      {privileged ? (
        <Drawer
          open={creating}
          onClose={() => {
            setCreating(false);
            reset();
          }}
          title="Kullanıcı ekle"
        >
          <form
            className="space-y-3"
            noValidate
            onSubmit={handleSubmit(async (values) => {
              try {
                await identityApi.createUser(values);
                reset();
                setCreating(false);
                await load(query);
              } catch (err) {
                setError(err instanceof ProblemError ? err.title : 'Oluşturulamadı');
              }
            })}
          >
            <label className="block space-y-1">
              <FieldLabel>Ad</FieldLabel>
              <Field {...register('firstName')} />
            </label>
            <label className="block space-y-1">
              <FieldLabel>Soyad</FieldLabel>
              <Field {...register('lastName')} />
            </label>
            <div className="space-y-1">
              <label className="block space-y-1">
                <FieldLabel>E-posta</FieldLabel>
                <Field type="email" aria-invalid={Boolean(errors.email)} {...register('email')} />
              </label>
              {errors.email ? <p className="text-xs text-red-300">{errors.email.message}</p> : null}
            </div>
            <SaveButton disabled={isSubmitting}>
              {isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}
            </SaveButton>
          </form>
        </Drawer>
      ) : null}
    </div>
  );
}
