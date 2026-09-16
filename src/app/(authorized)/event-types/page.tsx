'use client';

import { useEffect, useMemo, useState } from 'react';
import { ListItem } from '@/components/chrome/ListItem';
import { Pagination } from '@/components/chrome/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProblemError } from '@/lib/api/core';
import { teamsApi, type PublicTeam } from '@/lib/api/teams';

const PAGE_SIZE = 10;

export default function EventTypesPage() {
  const [teams, setTeams] = useState<PublicTeam[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    teamsApi
      .list()
      .then(setTeams)
      .catch((err) => setError(err instanceof ProblemError ? err.title : 'Ekipler yüklenemedi'));
  }, []);

  const totalPages = Math.max(1, Math.ceil(teams.length / PAGE_SIZE));
  const slice = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return teams.slice(start, start + PAGE_SIZE);
  }, [teams, page]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Etkinlik tipleri"
        description="Go API’de ayrı event-type yok; sahip ekip bir Group adıdır."
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
        {slice.map((team) => (
          <ListItem
            key={team.path}
            href={`/events?ownerTeam=${encodeURIComponent(team.team)}`}
            title={team.displayName?.tr || team.team}
            subtitle={team.path}
          />
        ))}
      </div>
      <Pagination current={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
