'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { PageHeader } from '@/components/layout/PageHeader';
import { NewsForm } from '../../NewsForm';
import { useAuth } from '@/context/AuthContext';
import { isPrivileged } from '@/lib/auth/groups';
import { newsApi, type NewsItem } from '@/lib/api/cms';
import { ProblemError } from '@/lib/api/core';

export default function EditAnnouncementPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const slug = decodeURIComponent(params.id);
  const { user } = useAuth();
  const privileged = isPrivileged(user?.groups ?? []);
  const [item, setItem] = useState<NewsItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!privileged || !slug) return;
    newsApi
      .get(slug)
      .then((next) => {
        setItem(next);
        setError(null);
      })
      .catch((err) => setError(err instanceof ProblemError ? err.title : 'Duyuru yüklenemedi'));
  }, [privileged, slug]);

  if (!privileged) {
    return <p className="text-sm text-red-300">Duyurular yalnızca Privileged gruplar içindir.</p>;
  }

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!item) return <p className="text-sm text-neutral-500">Yükleniyor…</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Duyuru düzenle"
        description={item.data?.title || item.slug}
        actions={
          <ActionButton
            icon={Trash2}
            label="Sil"
            onClick={async () => {
              try {
                await newsApi.remove(item.slug);
                router.push('/announcements');
              } catch (err) {
                setError(err instanceof ProblemError ? err.title : 'Silinemedi');
              }
            }}
          />
        }
      />
      <NewsForm
        key={item.slug}
        initial={item.data}
        submitLabel="Güncelle"
        pending={pending}
        onSubmit={async (data) => {
          setPending(true);
          try {
            await newsApi.update(item.slug, data, item.version);
            router.push('/announcements');
          } catch (err) {
            throw err instanceof ProblemError ? err : new Error('Güncellenemedi');
          } finally {
            setPending(false);
          }
        }}
      />
    </div>
  );
}
