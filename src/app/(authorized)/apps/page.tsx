'use client';

import { useEffect, useState } from 'react';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { StateCard } from '@/components/chrome/StateCard';
import { StatusChip } from '@/components/chrome/StatusChip';
import { PageHeader } from '@/components/layout/PageHeader';
import { appsApi, type AppSummary } from '@/lib/api/apps';
import { useCapabilities } from '@/lib/capabilities-context';
import { coreProblemMessage } from '@/lib/core-problems';
import { listStatus } from '@/lib/list-status';
import { useAppCan } from '@/lib/use-app-can';

/** Uygulamalar: Entra's Enterprise apps list (core /v1/apps). */
export default function AppsPage() {
  const capabilities = useCapabilities();
  const canRead = useAppCan(false)('apps.read');
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canRead) return;
    appsApi
      .list()
      .then(setApps)
      .catch((err) => setError(coreProblemMessage(err, 'Uygulamalar yüklenemedi')))
      .finally(() => setLoading(false));
  }, [canRead]);

  if (capabilities.status === 'loading') return <StateCard title="Yükleniyor…" isLoading />;
  if (!canRead) return <StateCard title="Uygulama atamaları açık değil" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Uygulamalar"
        description="Hangi ekip, alt ekip ya da kişinin hangi uygulamaya gireceği."
      />
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: apps.length,
          emptyMessage: 'Uygulama yok',
        })}
      >
        {apps.map((app) => (
          <ListItem
            key={app.clientId}
            href={`/apps/${encodeURIComponent(app.clientId)}`}
            title={app.name}
            subtitle={`${app.clientId} · Atama gerekli: ${app.assignmentRequired ? 'Evet' : 'Hayır'}`}
            trailing={
              <StatusChip kind="neutral" label={`${app.groups} grup · ${app.users} kişi`} />
            }
          />
        ))}
      </ListPanel>
    </div>
  );
}
