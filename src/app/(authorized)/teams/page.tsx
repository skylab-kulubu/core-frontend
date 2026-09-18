'use client';

import { useEffect, useMemo, useState } from 'react';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { Pagination } from '@/components/chrome/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProblemError } from '@/lib/api/core';
import { teamsApi, type PublicTeam } from '@/lib/api/teams';
import { listStatus } from '@/lib/list-status';

const PAGE_SIZE = 10;

export default function TeamsPage() {
  const [teams, setTeams] = useState<PublicTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    teamsApi
      .list()
      .then(setTeams)
      .catch((err) => setError(err instanceof ProblemError ? err.title : 'Ekipler yüklenemedi'))
      .finally(() => setLoading(false));
  }, []);

  const totalPages = Math.max(1, Math.ceil(teams.length / PAGE_SIZE));
  const slice = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return teams.slice(start, start + PAGE_SIZE);
  }, [teams, page]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ekipler"
        description="Sitede görünen ekipler. Etkinlikler bu ekibe bağlanır."
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: teams.length,
          emptyMessage: 'Ekip yok',
        })}
      >
        {slice.map((team) => (
          <ListItem
            key={team.path}
            href={`/events?ownerTeam=${encodeURIComponent(team.team)}`}
            title={team.displayName?.tr || team.team}
            subtitle={team.path}
          />
        ))}
      </ListPanel>
      <Pagination current={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
