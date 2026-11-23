'use client';

import { Card } from '@skylab-kulubu/skylcn-ui';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { EmptyState } from '@/components/chrome/PageState';
import { PageHeader } from '@/components/layout/PageHeader';
import type { ManagedGroup } from '@/lib/api/identity';
import { flattenManagedGroups, useManagedGroups } from '@/lib/managed-groups';
import { teamName } from '@/lib/sub-teams';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';

function TeamCard({ team, depth }: { team: ManagedGroup; depth: number }) {
  const facts = [
    `${team.memberCount ?? 0} üye`,
    `${team.leaderCount ?? 0} lider`,
    team.children?.length ? `${team.children.length} alt ekip` : null,
  ].filter(Boolean);
  return (
    <Card className="p-0">
      <Link
        href={`/my-teams/${encodeURIComponent(team.id)}`}
        className="hover:bg-background flex items-center gap-3 rounded-[inherit] p-4"
      >
        <span className="min-w-0 flex-1 space-y-1">
          <span className="text-foreground-strong block truncate text-sm font-semibold">
            {teamName(team)}
          </span>
          <span className={`text-subtle-foreground block truncate ${TEXT_SECONDARY}`}>
            {depth > 0 ? `${team.path.split('/').slice(-2, -1)[0]} altında · ` : ''}
            {facts.join(' · ')}
          </span>
        </span>
        {team.leaderCount === 0 ? (
          <span className={`text-warning shrink-0 ${TEXT_SECONDARY}`}>Lider yok</span>
        ) : null}
        <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </Link>
    </Card>
  );
}

/**
 * Ekibim: the Teams the reader leads (core's managed tree, ekip-yetkileri
 * ticket 08). A Leader of one Team goes straight to its page; a Leader of
 * several picks one from the cards, the Teams below them included.
 */
export default function MyTeamsPage() {
  const managed = useManagedGroups();
  const router = useRouter();
  const only =
    managed.status === 'ready' && managed.groups.length === 1 ? managed.groups[0] : undefined;

  useEffect(() => {
    if (only) router.replace(`/my-teams/${encodeURIComponent(only.id)}`);
  }, [only, router]);

  if (managed.status === 'loading' || only) return <PageSkeleton />;
  const rows = managed.status === 'ready' ? flattenManagedGroups(managed.groups) : [];

  return (
    <div className="space-y-4">
      <PageHeader title="Ekibim" />
      {managed.status === 'failed' ? (
        <EmptyState kind="failed" title="Ekipler yüklenemedi" onRetry={managed.reload} />
      ) : rows.length === 0 ? (
        <EmptyState kind="first-use" title="Yönettiğin ekip yok" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(({ group, depth }) => (
            <TeamCard key={group.id} team={group} depth={depth} />
          ))}
        </div>
      )}
    </div>
  );
}
