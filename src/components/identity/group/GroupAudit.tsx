'use client';

import { Button, DataListTitle, type DataListColumn } from '@skylab-kulubu/skylcn-ui';
import { DataList } from '@/components/chrome/DataList';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState, Forbidden } from '@/components/chrome/PageState';
import { StatusChip } from '@/components/chrome/StatusChip';
import { useGroupWorkspace } from '@/components/identity/group/GroupWorkspace';
import { identityApi, type TeamAuditRecord } from '@/lib/api/identity';
import { coreProblemMessage } from '@/lib/core-problems';
import { auditActionLabel, auditOutcomeLabel } from '@/lib/group-page';
import { formatApplicantWhen } from '@/lib/tickets-ui';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';

const PAGE = 50;

function groupLabel(row: TeamAuditRecord, root: string): string | null {
  const path = row.group?.currentPath ?? row.group?.path;
  if (!path || path === root) return null;
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}

/**
 * Denetim kaydı (Entra's audit logs, for one Group): who changed what in the
 * Group and the Groups under it, newest first, fifty at a time. core's
 * `audit.read` (ADMIN, YK, DK) reads it.
 */
export function GroupAudit() {
  const { id, group, canReadAudit } = useGroupWorkspace();
  const [rows, setRows] = useState<TeamAuditRecord[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await identityApi.groupAudit(id, { limit: PAGE });
      setRows(page.items ?? []);
      setNext(page.next ?? null);
      setFailed(null);
    } catch (err) {
      setFailed(coreProblemMessage(err, 'Denetim kaydı yüklenemedi'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (canReadAudit) void load();
  }, [canReadAudit, load]);

  if (!canReadAudit) return <Forbidden />;

  async function loadMore() {
    if (!next) return;
    setMore(true);
    try {
      const page = await identityApi.groupAudit(id, { limit: PAGE, cursor: next });
      setRows((current) => [...current, ...(page.items ?? [])]);
      setNext(page.next ?? null);
    } catch (err) {
      setFailed(coreProblemMessage(err, 'Denetim kaydı yüklenemedi'));
    } finally {
      setMore(false);
    }
  }

  const columns: DataListColumn<TeamAuditRecord>[] = [
    {
      id: 'what',
      width: 'minmax(0,1fr)',
      header: 'Değişiklik',
      cell: (row) => {
        const where = groupLabel(row, group.path);
        return (
          <DataListTitle
            title={`${auditActionLabel(row.action)}${row.target?.displayName ? `: ${row.target.displayName}` : ''}`}
            subtitle={
              <span className={TEXT_SECONDARY}>
                {[row.actor?.displayName || 'Sistem', where].filter(Boolean).join(' · ')}
              </span>
            }
          />
        );
      },
    },
    {
      id: 'outcome',
      width: '7rem',
      from: 'sm',
      header: 'Sonuç',
      cell: (row) =>
        row.outcome === 'ok' ? (
          <span className={`text-secondary-foreground ${TEXT_SECONDARY}`}>
            {auditOutcomeLabel(row.outcome)}
          </span>
        ) : (
          <StatusChip
            kind={row.outcome === 'pending' ? 'pending' : 'cancelled'}
            label={auditOutcomeLabel(row.outcome)}
          />
        ),
    },
    {
      id: 'when',
      width: '8.5rem',
      align: 'end',
      header: 'Zaman',
      cell: (row) => (
        <span className={`text-secondary-foreground ${TEXT_SECONDARY}`}>
          {formatApplicantWhen(row.occurredAt)}
        </span>
      ),
    },
  ];

  if (failed && !rows.length) {
    return <EmptyState kind="failed" title={failed} onRetry={() => void load()} />;
  }
  if (!loading && !rows.length) return <EmptyState kind="first-use" title="Kayıt yok" />;

  return (
    <div className="flex flex-col gap-3">
      <DataList
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={loading}
        skeletonRows={6}
      />
      {next ? (
        <div className="flex justify-center">
          <Button
            className={BUTTON_TEXT}
            size="sm"
            variant="outline"
            pending={more}
            onClick={() => void loadMore()}
          >
            Daha eski kayıtlar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
