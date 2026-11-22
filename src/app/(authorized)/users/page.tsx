'use client';

import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { personSearchReady } from '@/components/identity/use-person-search';
import { PageHeader } from '@/components/layout/PageHeader';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { identityApi, type Person } from '@/lib/api/identity';
import { coreProblemMessage } from '@/lib/core-problems';
import { useAuth } from '@/context/AuthContext';
import { isPrivileged } from '@/lib/auth/groups';
import { useNotify } from '@/lib/ui/use-notify';
import { useAppCan } from '@/lib/use-app-can';
import { UsersDirectory } from '@/components/identity/UsersDirectory';

const createUserSchema = z.object({
  firstName: z.string().trim(),
  lastName: z.string().trim(),
  email: z.string().trim().email('Geçerli bir e-posta girin.'),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

export default function UsersPage() {
  const { user } = useAuth();
  // core's user.create decides the add button (a DK member reads only)
  const canCreate = useAppCan(isPrivileged(user?.groups ?? []))('user.create');
  const [users, setUsers] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const notify = useNotify();
  const [query, setQuery] = useState('');
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { firstName: '', lastName: '', email: '' },
  });

  // Only the latest search may write the list: an older, slower answer is dropped
  const latestSearch = useRef(0);

  async function load(q: string) {
    const search = ++latestSearch.current;
    try {
      const rows = await identityApi.listUsers(q);
      if (search !== latestSearch.current) return;
      setUsers(rows);
      setError(null);
    } catch (err) {
      if (search !== latestSearch.current) return;
      setError(coreProblemMessage(err, 'Kullanıcılar yüklenemedi'));
    } finally {
      if (search === latestSearch.current) setLoading(false);
    }
  }

  // The directory is searched, never listed whole (core has no paging on GET /v1/users).
  const ready = personSearchReady(query);

  useEffect(() => {
    latestSearch.current += 1;
    if (!ready) {
      setUsers([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = window.setTimeout(() => {
      void load(query);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, ready]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kullanıcılar"
        actions={
          canCreate ? (
            <ActionButton
              icon={Plus}
              variant="primary"
              label="Kullanıcı ekle"
              onClick={() => setCreating(true)}
            />
          ) : undefined
        }
      />
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <UsersDirectory
        query={query}
        onQuery={setQuery}
        results={users}
        searching={loading}
        searchFailed={Boolean(error)}
        ready={ready}
        onClearSearch={() => setQuery('')}
      />
      {canCreate ? (
        <Drawer
          open={creating}
          onClose={() => {
            setCreating(false);
            setCreateError(null);
            reset();
          }}
          title="Kullanıcı ekle"
          dirty={isDirty}
        >
          <form
            className="space-y-3"
            noValidate
            onSubmit={handleSubmit(async (values) => {
              setCreateError(null);
              try {
                await identityApi.createUser(values);
                reset();
                setCreating(false);
                notify.success('Kullanıcı eklendi');
                if (query === values.email) await load(query);
                else setQuery(values.email);
              } catch (err) {
                setCreateError(coreProblemMessage(err, 'Oluşturulamadı'));
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
              {errors.email ? (
                <p className="text-destructive text-xs">{errors.email.message}</p>
              ) : null}
            </div>
            {createError ? (
              <p role="alert" className="text-destructive text-sm">
                {createError}
              </p>
            ) : null}
            <SaveButton disabled={isSubmitting}>
              {isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}
            </SaveButton>
          </form>
        </Drawer>
      ) : null}
    </div>
  );
}
