'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ShieldAlert, Trash2 } from 'lucide-react';
import { StateCard } from '@/components/chrome/StateCard';
import { ActionButton } from '@/components/chrome/ActionButton';
import { PageHeader } from '@/components/layout/PageHeader';
import { NewsForm } from '../../NewsForm';
import { useAuth } from '@/context/AuthContext';
import { isPrivileged } from '@/lib/auth/groups';
import { newsApi, newsProblemMessage, type NewsItem } from '@/lib/api/cms';
import { ProblemError } from '@/lib/api/core';

export default function EditAnnouncementPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const slug = decodeURIComponent(params.id);
  const { user } = useAuth();
  const privileged = isPrivileged(user?.groups ?? []);
  const [item, setItem] = useState<NewsItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
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
    return (
      <StateCard
        title="Duyurular yalnızca YK ve kurul içindir."
        description="Bu ekran yayın yetkisi ister."
        Icon={ShieldAlert}
        tone="warning"
      />
    );
  }

  if (error) {
    return <StateCard title={error} description="Duyuruya dönemiyor." tone="danger" />;
  }
  if (!item) return <StateCard title="Yükleniyor…" isLoading />;

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
              setRemoveError(null);
              try {
                await newsApi.remove(item.slug, item.version);
                router.push('/announcements');
              } catch (err) {
                setRemoveError(newsProblemMessage(err, 'Silinemedi'));
              }
            }}
          />
        }
      />
      {removeError ? <p className="text-sm text-red-300">{removeError}</p> : null}
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
            throw new Error(newsProblemMessage(err, 'Güncellenemedi'));
          } finally {
            setPending(false);
          }
        }}
      />
    </div>
  );
}
