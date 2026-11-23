'use client';

import { useEffect, useRef, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { Radio, RadioGroup } from '@skylab-kulubu/skylcn-ui';
import { ActionButton } from '@/components/chrome/ActionButton';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { SectionHeading } from '@/components/chrome/PanelChart';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import {
  MEMBER_CANDIDATE_HINT,
  MEMBER_CANDIDATE_MIN,
  usePickerSearch,
} from '@/components/identity/use-person-search';
import {
  identityApi,
  type LeaderKind,
  type ManagedGroup,
  type TeamLeader,
} from '@/lib/api/identity';
import { coreProblemMessage } from '@/lib/core-problems';
import { listStatus } from '@/lib/list-status';
import { leaderKindLabel, teamName, teamStructureMessage } from '@/lib/sub-teams';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

/** Why the reader sees this Team's Leaders read-only (core: leaders.write is ManagesStrict). */
const READ_ONLY = 'Bu ekibin liderlerini üst ekibin liderleri ya da YK değiştirir.';
const ADD_TEXT = 'Kişi ekibin lider grubuna eklenir. Bu ona e-postayla bildirilir.';
const REMOVE_TEXT = 'Kişi ekibin lider grubundan çıkar. Bu ona e-postayla bildirilir.';
const LAST_TEXT = 'Ekibin başka lideri kalmaz.';
/** A top Team's Leader group may map a site's cms:access (ADR-0056 site editors; core docs/team-delegation.md). */
const TOP_TEXT = 'En üst ekipte lider grubu sitenin içerik yönetimini (cms:access) de verebilir.';
const NOT_ACTIVE = { 404: 'Kişinin etkin bir hesabı yok.' };

function personName(person: { firstName: string; lastName: string; email: string }): string {
  return `${person.firstName} ${person.lastName}`.trim() || person.email;
}

/** The Leader group a new Leader joins, asked with the confirmation. */
function KindChoice({ onChange }: { onChange: (kind: LeaderKind) => void }) {
  const [kind, setKind] = useState<LeaderKind>('LIDERLER');
  return (
    <RadioGroup
      aria-label="Görev"
      value={kind}
      onValueChange={(value: unknown) => {
        const next: LeaderKind = value === 'KOORDINATORLER' ? 'KOORDINATORLER' : 'LIDERLER';
        setKind(next);
        onChange(next);
      }}
    >
      <Radio value="LIDERLER" label="Lider" />
      <Radio value="KOORDINATORLER" label="Koordinatör" />
    </RadioGroup>
  );
}

/**
 * Liderler: a Team's Leaders and Coordinators (GET /v1/groups/{id}/leaders).
 * Whoever manages the Team strictly (core's `leaders.write`: Leaders of a
 * Team above, Privileged) names and removes them; core opens the Leader group
 * when the Team has none. Everyone else reads them, with the reason.
 */
export function TeamLeaders({
  team,
  top = false,
  personHref,
  onChanged,
}: {
  team: ManagedGroup;
  /** A top Team (only Privileged names its Leaders): the question says what its Leader group may carry. */
  top?: boolean;
  /** The person card's link, when core lets the reader open it. */
  personHref?: (userId: string) => string;
  onChanged: () => void;
}) {
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  // The naming question opens over the picker
  const [confirmAdd, addDialog] = useConfirm();
  const [leaders, setLeaders] = useState<TeamLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const kind = useRef<LeaderKind>('LIDERLER');
  // Each question starts its choice afresh, as the ref does
  const asked = useRef(0);
  const writes = team.can?.['leaders.write'] === true;
  const search = usePickerSearch(
    open,
    query,
    (q) => identityApi.memberCandidates(team.id, q),
    MEMBER_CANDIDATE_MIN,
  );

  async function load() {
    try {
      setLeaders(await identityApi.teamLeaders(team.id));
      setError(null);
    } catch (err) {
      setError(coreProblemMessage(err, 'Liderler yüklenemedi'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void load();
  }, [team.id]);

  const people = new Set(leaders.map((leader) => leader.id));
  const options = search.people
    .filter((person) => !people.has(person.id))
    .map((person) => ({ id: person.id, title: personName(person), subtitle: person.email }));

  function pick(userId: string) {
    const person = search.people.find((row) => row.id === userId);
    if (!person) return;
    kind.current = 'LIDERLER';
    asked.current += 1;
    confirmAdd({
      title: `${personName(person)} ${teamName(team)} ekibine atansın mı?`,
      description: top ? `${ADD_TEXT} ${TOP_TEXT}` : ADD_TEXT,
      content: <KindChoice key={asked.current} onChange={(next) => (kind.current = next)} />,
      actionLabel: 'Ata',
      destructive: false,
      closesDrawer: true,
      onConfirm: async () => {
        const chosen = kind.current;
        await identityApi.addTeamLeader(team.id, person.id, chosen);
        setOpen(false);
        notify.success(`${leaderKindLabel(chosen)} atandı`);
        await load();
        onChanged();
      },
      failure: (err) => teamStructureMessage(err, 'Atanamadı', NOT_ACTIVE),
    });
  }

  return (
    <section className="space-y-3">
      <SectionHeading
        title="Liderler"
        meta={`${people.size} kişi`}
        actions={
          writes ? (
            <ActionButton
              icon={UserPlus}
              variant="primary"
              label="Lider ata"
              onClick={() => {
                setQuery('');
                setOpen(true);
              }}
            />
          ) : null
        }
      />
      {!writes ? <p className="text-3xs text-subtle-foreground">{READ_ONLY}</p> : null}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: leaders.length,
          emptyMessage: 'Lider yok',
        })}
      >
        {leaders.map((leader) => (
          <ListItem
            key={`${leader.kind}:${leader.id}`}
            href={personHref?.(leader.id)}
            title={personName(leader)}
            subtitle={`${leaderKindLabel(leader.kind)} · ${leader.email}`}
            trailing={
              writes ? (
                <ActionButton
                  icon={X}
                  label="Çıkar"
                  onClick={() =>
                    confirm({
                      title: `${personName(leader)} ${teamName(team)} liderliğinden çıkarılsın mı?`,
                      description: people.size === 1 ? `${REMOVE_TEXT} ${LAST_TEXT}` : REMOVE_TEXT,
                      actionLabel: 'Liderlikten çıkar',
                      onConfirm: async () => {
                        const removal = await identityApi.removeTeamLeader(team.id, leader.id);
                        notify.success(
                          removal?.lastLeader
                            ? 'Lider çıkarıldı. Ekibin lideri kalmadı.'
                            : 'Lider çıkarıldı',
                        );
                        await load();
                        onChanged();
                      },
                      failure: (err) => teamStructureMessage(err, 'Çıkarılamadı'),
                    })
                  }
                />
              ) : null
            }
          />
        ))}
      </ListPanel>
      {confirmDialog}
      <PickerDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Lider ata"
        query={query}
        onQuery={setQuery}
        placeholder="Ad veya tam e-posta"
        loading={search.loading}
        failed={search.failed}
        options={options}
        emptyMessage={search.ready ? 'Kullanıcı yok' : MEMBER_CANDIDATE_HINT}
        onPick={pick}
      >
        {addDialog}
      </PickerDrawer>
    </section>
  );
}
