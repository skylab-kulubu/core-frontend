'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArchiveRestore, Trash2 } from 'lucide-react';
import { NewsEditor } from '@/components/announcements/NewsEditor';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { EmptyState, Forbidden } from '@/components/chrome/PageState';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { useChromeCrumbName } from '@/components/layout/chrome-crumb-names';
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
  // Bumped after a publish or a restore, so the editor starts again from what is stored
  const [round, setRound] = useState(0);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();

  const load = useCallback(() => {
    if (!privileged || !slug) return;
    newsApi
      .get(slug)
      .then((next) => {
        setItem(next);
        setError(null);
        setRound((value) => value + 1);
      })
      .catch((err) => setError(coreProblemMessage(err, 'Duyuru yüklenemedi')));
  }, [privileged, slug]);

  useEffect(() => {
    load();
  }, [load]);
  useChromeCrumbName(`/announcements/${params.id}`, item ? item.data?.title || item.slug : null);

  if (!privileged) return <Forbidden pageTitle="Duyuruyu düzenle" />;
  if (error) return <EmptyState kind="failed" title={error} onRetry={load} />;
  if (!item) return <PageSkeleton variant="detail" />;

  const title = item.data?.title || item.slug;

  async function restore(target: NewsItem) {
    await newsApi.restore(target.slug, target.version);
    load();
  }

  if (item.isArchived) {
    return (
      <div className="space-y-4">
        <PageHeader title={title} />
        <EmptyState
          kind="first-use"
          title="Bu duyuru silindi"
          action={
            <Command
              primary
              icon={ArchiveRestore}
              label="Geri getir"
              onClick={() => {
                setRestoreError(null);
                void restore(item).then(
                  () => notify.success('Duyuru geri getirildi'),
                  (err) => setRestoreError(newsProblemMessage(err, 'Geri getirilemedi')),
                );
              }}
            />
          }
        />
        {restoreError ? (
          <p role="alert" className="text-destructive text-center text-sm">
            {restoreError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PageHeader title={title} />
      <CommandBar label="Duyuru komutları">
        <Command
          icon={Trash2}
          label="Sil"
          onClick={() =>
            confirm({
              title: `"${title}" duyurusu silinsin mi?`,
              description: 'Duyuru sitede ve uygulamada görünmez olur. Geri getirebilirsin.',
              actionLabel: 'Duyuruyu sil',
              onConfirm: async () => {
                await newsApi.remove(item.slug, item.version);
                notify.undoable(
                  'Duyuru silindi',
                  () => newsApi.restore(item.slug, item.version),
                  'Duyuru geri getirildi',
                );
                router.push('/announcements');
              },
              failure: (err) => newsProblemMessage(err, 'Duyuru silinemedi'),
            })
          }
        />
      </CommandBar>
      {confirmDialog}
      <NewsEditor
        key={`${item.slug}-${round}`}
        source={{ kind: 'edit', item }}
        onPublished={() => {
          notify.success('Duyuru güncellendi');
          load();
        }}
      />
    </div>
  );
}
