'use client';

import { useEffect, useMemo, useState } from 'react';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Pagination } from '@/components/chrome/Pagination';
import { StatusChip } from '@/components/chrome/StatusChip';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProblemError } from '@/lib/api/core';
import { teamsApi, type PublicTeam } from '@/lib/api/teams';
import { emptyListCopy, matchesQuery, paginateRows } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';

export default function TeamsPage() {
  const [teams, setTeams] = useState<PublicTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');

  useEffect(() => {
    teamsApi
      .list()
      .then(setTeams)
      .catch((err) => setError(err instanceof ProblemError ? err.title : 'Ekipler yüklenemedi'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => teams.filter((team) => matchesQuery(query, team.displayName?.tr, team.team, team.path)),
    [teams, query],
  );
  const paged = paginateRows(filtered, page);

  useEffect(() => {
    setPage(1);
  }, [query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ekipler"
        description="Sitede görünen ekipler. Etkinlikler bu ekibe bağlanır."
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <ListToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Ad veya yol"
        searchLabel="Ekip ara"
      />
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: filtered.length,
          emptyMessage: emptyListCopy({
            none: 'Ekip yok',
            noneMatch: 'Eşleşen ekip yok',
            query,
          }),
        })}
        emptyDescription="Site ekipleri burada listelenir."
      >
        {paged.slice.map((team) => (
          <ListItem
            key={team.path}
            href={`/events?ownerTeam=${encodeURIComponent(team.team)}`}
            title={team.displayName?.tr || team.team}
            subtitle={team.path}
            trailing={<StatusChip kind="neutral" label={team.team} />}
          />
        ))}
      </ListPanel>
      <Pagination current={paged.page} totalPages={paged.totalPages} onPageChange={setPage} />
    </div>
  );
}
