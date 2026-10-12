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
import { coreProblemMessage } from '@/lib/core-problems';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

export default function EditAnnouncementPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const slug = decodeURIComponent(params.id);
  const { user } = useAuth();
  const privileged = isPrivileged(user?.groups ?? []);
  const [item, setItem] = useState<NewsItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();

  useEffect(() => {
    if (!privileged || !slug) return;
    newsApi
      .get(slug)
      .then((next) => {
        setItem(next);
        setError(null);
      })
      .catch((err) => setError(coreProblemMessage(err, 'Duyuru yüklenemedi')));
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
            onClick={() =>
              confirm({
                title: `"${item.data?.title || item.slug}" duyurusu silinsin mi?`,
                description: 'Duyuru sitede ve duyuru listesinde görünmez olur.',
                actionLabel: 'Duyuruyu sil',
                onConfirm: async () => {
                  await newsApi.remove(item.slug, item.version);
                  notify.success('Duyuru silindi');
                  router.push('/announcements');
                },
                failure: (err) => newsProblemMessage(err, 'Duyuru silinemedi'),
              })
            }
          />
        }
      />
      {confirmDialog}
      <NewsForm
        key={item.slug}
        initial={item.data}
        submitLabel="Güncelle"
        pending={pending}
        onSubmit={async (data) => {
          setPending(true);
          try {
            await newsApi.update(item.slug, data, item.version);
            notify.success('Duyuru güncellendi');
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
