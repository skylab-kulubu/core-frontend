'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { identityApi } from '@/lib/api/identity';
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
  const can = useAppCan(isPrivileged(user?.groups ?? []));
  const canCreate = can('user.create');
  const canAddToGroup = can('group.write');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const notify = useNotify();
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { firstName: '', lastName: '', email: '' },
  });

  return (
    <>
      <UsersDirectory
        canCreate={canCreate}
        onCreate={() => setCreating(true)}
        canAddToGroup={canAddToGroup}
        canFilter={can('user.readFull')}
        reloadKey={reloadKey}
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
                setReloadKey((n) => n + 1);
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
                <p className="text-destructive text-[13px]/5">{errors.email.message}</p>
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
    </>
  );
}
