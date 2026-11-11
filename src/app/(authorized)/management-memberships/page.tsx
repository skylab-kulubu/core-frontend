'use client';

import { Button, Notice } from '@skylab-kulubu/skylcn-ui';
import { DataTable, type DataTableColumn } from '@skylab-kulubu/skylcn-ui/data-table';
import { CalendarPlus, UserMinus, UserRoundPlus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import { StateCard } from '@/components/chrome/StateCard';
import { StatusChip } from '@/components/chrome/StatusChip';
import { UNVERIFIED_MARK, unverifiedAddText } from '@/components/identity/use-member-add';
import {
  MEMBER_CANDIDATE_HINT,
  MEMBER_CANDIDATE_MIN,
  usePickerSearch,
} from '@/components/identity/use-person-search';
import { PageHeader } from '@/components/layout/PageHeader';
import { identityApi, type MemberCandidate } from '@/lib/api/identity';
import {
  managementMembershipsApi,
  type HandoverMode,
  type ManagementTerm,
} from '@/lib/api/management-memberships';
import { useCapabilities } from '@/lib/capabilities-context';
import {
  daysLeftLabel,
  emptyTermsText,
  earliestNewEnd,
  endLabel,
  holderName,
  roleLabel,
  sortTerms,
  statusKind,
  statusLabel,
  termDaysLeft,
  termProblemMessage,
  termsOff,
  termWritesAllowed,
} from '@/lib/management-terms';
import { todayInTurkey } from '@/lib/subject-requests';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

/** The successor's choices, read by the question's action. */
type HandoverChoice = { mode: HandoverMode; endsAt: string };

function HandoverFields({
  choice,
  min,
  onModeChange,
}: {
  choice: { current: HandoverChoice };
  min: string;
  onModeChange: (mode: HandoverMode) => void;
}) {
  const [mode, setMode] = useState<HandoverMode>(choice.current.mode);
  const [endsAt, setEndsAt] = useState(choice.current.endsAt);
  return (
    <>
      <label className="block space-y-1">
        <FieldLabel>Eski üye</FieldLabel>
        <Select
          value={mode}
          onChange={(e) => {
            const next = e.target.value as HandoverMode;
            setMode(next);
            choice.current = { ...choice.current, mode: next };
            onModeChange(next);
          }}
        >
          <option value="at_term_end">Bitişine kadar kalsın</option>
          <option value="immediate">Hemen çıkar</option>
        </Select>
      </label>
      <label className="block space-y-1">
        <FieldLabel>Yeni bitiş (boşsa sezon sonu)</FieldLabel>
        <Field
          type="date"
          value={endsAt}
          min={min}
          onChange={(e) => {
            setEndsAt(e.target.value);
            choice.current = { ...choice.current, endsAt: e.target.value };
          }}
        />
      </label>
    </>
  );
}

/** Runs `run` for each term one at a time; answers how many went through and the first refusal. */
async function eachTerm(
  terms: readonly ManagementTerm[],
  run: (term: ManagementTerm) => Promise<unknown>,
): Promise<{ done: number; failure: unknown }> {
  let done = 0;
  let failure: unknown = null;
  for (const term of terms) {
    try {
      await run(term);
      done += 1;
    } catch (err) {
      failure ??= err;
    }
  }
  return { done, failure };
}

/**
 * Dönem devri: the YK, DK and Team Leader memberships that end with the
 * season (core /v1/management-memberships, grup-yonetimi 12). core decides
 * who sees which term and every change; the panel hides the buttons only
 * from a reader who may not write (DK).
 */
export default function ManagementMembershipsPage() {
  const capabilities = useCapabilities();
  const canWrite = termWritesAllowed(capabilities);
  const today = todayInTurkey();
  const minEnd = earliestNewEnd(today);
  const notify = useNotify();
  const [terms, setTerms] = useState<ManagementTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  // Uzat: one term from its row, or the picked rows
  const [extending, setExtending] = useState<ManagementTerm[] | null>(null);
  const [extendEnd, setExtendEnd] = useState('');
  const [extendError, setExtendError] = useState<string | null>(null);
  const [extendBusy, setExtendBusy] = useState(false);
  // The picked rows' clear, for a bulk extension that went through
  const extendClear = useRef<(() => void) | undefined>(undefined);

  // Devret: the term handed over and the successor search in its Group
  const [handing, setHanding] = useState<ManagementTerm | null>(null);
  const [handQuery, setHandQuery] = useState('');
  const handChoice = useRef<HandoverChoice>({ mode: 'at_term_end', endsAt: '' });
  // A pick being read (the whole address) holds the next one; closing the picker drops it
  const handPicking = useRef(false);
  const handOpening = useRef(0);
  const handSearch = usePickerSearch(
    handing !== null,
    handQuery,
    (query) =>
      handing ? identityApi.memberCandidates(handing.groupId, query) : Promise.resolve([]),
    MEMBER_CANDIDATE_MIN,
  );
  const [confirm, confirmDialog] = useConfirm();
  const [confirmHandover, handoverDialog] = useConfirm();

  async function load() {
    try {
      setTerms(await managementMembershipsApi.list());
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => sortTerms(terms), [terms]);
  const expiredCount = rows.filter((term) => term.status === 'expired').length;

  function openExtend(selected: ManagementTerm[], clear?: () => void) {
    extendClear.current = clear;
    setExtending(selected);
    setExtendEnd('');
    setExtendError(null);
  }

  async function submitExtend() {
    if (!extending || extendBusy) return;
    setExtendBusy(true);
    setExtendError(null);
    const { done, failure } = await eachTerm(extending, (term) =>
      managementMembershipsApi.extend(term.id, extendEnd),
    );
    setExtendBusy(false);
    if (done) await load();
    if (!failure) {
      setExtending(null);
      extendClear.current?.();
      notify.success(done === 1 ? 'Görev uzatıldı' : `${done} görev uzatıldı`);
      return;
    }
    const reason = termProblemMessage(failure, 'Uzatılamadı');
    setExtendError(
      extending.length > 1 ? `${done}/${extending.length} görev uzatıldı. ${reason}` : reason,
    );
  }

  function askRemove(selected: ManagementTerm[], clear?: () => void) {
    const expired = selected.filter((term) => term.status === 'expired');
    if (!expired.length) return;
    const one = expired.length === 1 ? expired[0] : null;
    confirm({
      title: one
        ? `${holderName(one)} ${one.groupPath} grubundan çıkarılsın mı?`
        : `${expired.length} kişi grubundan çıkarılsın mı?`,
      description: 'Süresi dolmuş üyelik kalkar, yetkisi biter.',
      actionLabel: 'Gruptan çıkar',
      onConfirm: async () => {
        const { done, failure } = await eachTerm(expired, (term) =>
          managementMembershipsApi.remove(term.id),
        );
        if (done) await load();
        if (failure) {
          throw new Error(
            expired.length > 1
              ? `${done}/${expired.length} kişi çıkarıldı. ${termProblemMessage(failure, 'Çıkarılamadı')}`
              : termProblemMessage(failure, 'Çıkarılamadı'),
          );
        }
        clear?.();
        notify.success(one ? 'Gruptan çıkarıldı' : `${done} kişi gruptan çıkarıldı`);
      },
      failure: (err) => (err instanceof Error ? err.message : 'Çıkarılamadı'),
    });
  }

  async function askHandover(term: ManagementTerm, successor: MemberCandidate) {
    if (handPicking.current) return;
    handPicking.current = true;
    const opening = handOpening.current;
    try {
      const name = `${successor.firstName} ${successor.lastName}`.trim() || successor.email;
      const warns = successor.warnings.includes('not_ytu_verified');
      // The search masks the address (a***@…); the warning asks to check the whole one, as on Üye ekle
      const email =
        warns && successor.email.includes('***')
          ? await identityApi
              .getUser(successor.id)
              .then((card) => card.email || successor.email)
              .catch(() => successor.email)
          : successor.email;
      if (opening !== handOpening.current) return;
      handChoice.current = { mode: 'at_term_end', endsAt: '' };
      // Hemen çıkar takes the holder out of the Group: the question turns destructive
      const ask = (immediate: boolean) =>
        confirmHandover({
          title: `${term.groupPath} görevi devredilsin mi?`,
          description: [`${holderName(term)} → ${name}`, warns ? unverifiedAddText(email) : '']
            .filter(Boolean)
            .join(' '),
          content: (
            <HandoverFields
              choice={handChoice}
              min={minEnd}
              onModeChange={(mode) => {
                if ((mode === 'immediate') !== immediate) ask(mode === 'immediate');
              }}
            />
          ),
          actionLabel: 'Devret',
          destructive: immediate,
          closesDrawer: true,
          onConfirm: async () => {
            const { mode, endsAt } = handChoice.current;
            try {
              await managementMembershipsApi.handover(term.id, {
                userId: successor.id,
                mode,
                ...(endsAt ? { endsAt } : {}),
                ...(warns ? { unverifiedAck: true } : {}),
              });
            } catch (err) {
              // The add may have gone through before the refusal: show the list as core has it
              await load();
              throw err;
            }
            setHanding(null);
            notify.success('Görev devredildi');
            await load();
          },
          failure: (err) => termProblemMessage(err, 'Devredilemedi'),
        });
      ask(false);
    } finally {
      handPicking.current = false;
    }
  }

  const columns: DataTableColumn<ManagementTerm>[] = [
    { id: 'name', header: 'Kişi', value: (term) => holderName(term), sortable: true },
    { id: 'group', header: 'Grup', value: (term) => term.groupPath, sortable: true },
    {
      id: 'role',
      header: 'Görev',
      value: (term) => term.role,
      cell: (term) => roleLabel(term.role),
      from: 'md',
    },
    {
      id: 'endsAt',
      header: 'Bitiş',
      value: (term) => (term.endsAt ? Date.parse(term.endsAt) : Number.MAX_SAFE_INTEGER),
      cell: (term) => endLabel(term.endsAt),
      sortable: true,
    },
    {
      id: 'left',
      header: 'Kalan',
      value: (term) => termDaysLeft(term.endsAt, today) ?? Number.MAX_SAFE_INTEGER,
      cell: (term) => daysLeftLabel(termDaysLeft(term.endsAt, today)),
      from: 'md',
      align: 'end',
    },
    {
      id: 'status',
      header: 'Durum',
      value: (term) => term.status,
      cell: (term) => (
        <StatusChip kind={statusKind(term.status)} label={statusLabel(term.status)} />
      ),
    },
  ];
  if (canWrite) {
    columns.push({
      id: 'actions',
      header: 'İşlem',
      value: () => '',
      hideable: false,
      align: 'end',
      cell: (term) => (
        <div className="flex justify-end gap-1">
          <ActionButton icon={CalendarPlus} label="Uzat" onClick={() => openExtend([term])} />
          <ActionButton
            icon={UserRoundPlus}
            label="Devret"
            onClick={() => {
              setHandQuery('');
              setHanding(term);
            }}
          />
          {term.status === 'expired' ? (
            <ActionButton
              icon={UserMinus}
              label="Gruptan çıkar"
              onClick={() => askRemove([term])}
            />
          ) : null}
        </div>
      ),
    });
  }

  if (loading) return <StateCard title="Yükleniyor…" isLoading />;
  if (error && termsOff(error)) return <StateCard title="Süreli yönetim üyelikleri kapalı" />;

  const handOptions = handSearch.people
    .filter((person) => person.id !== handing?.userId)
    .map((person) => ({
      id: person.id,
      title: `${person.firstName} ${person.lastName}`.trim() || person.email,
      subtitle: person.email,
      marker: person.warnings.includes('not_ytu_verified') ? UNVERIFIED_MARK : undefined,
    }));

  return (
    <div className="space-y-6">
      <PageHeader title="Dönem devri" />
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {termProblemMessage(error, 'Görevler yüklenemedi')}
        </p>
      ) : null}
      {expiredCount ? (
        <Notice tone="warning" title={`${expiredCount} üyeliğin süresi doldu`}>
          Gruptan çıkarılana kadar yetki sürer.
        </Notice>
      ) : null}
      {rows.length === 0 && !error ? (
        <StateCard title={emptyTermsText(capabilities)} />
      ) : (
        <DataTable
          aria-label="Yönetim üyelikleri"
          data={rows}
          columns={columns}
          getRowId={(term) => term.id}
          searchPlaceholder="Kişi ya da grup"
          facets={[
            { column: 'status', label: 'Durum', format: statusLabel },
            { column: 'role', label: 'Görev', format: roleLabel },
          ]}
          bulkActions={
            canWrite
              ? (selected, clear) => (
                  <>
                    <Button size="sm" onClick={() => openExtend(selected, clear)}>
                      Seçilenleri uzat
                    </Button>
                    {selected.some((term) => term.status === 'expired') ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => askRemove(selected, clear)}
                      >
                        Süresi dolmuşları çıkar
                      </Button>
                    ) : null}
                  </>
                )
              : undefined
          }
        />
      )}
      {confirmDialog}
      <Drawer
        open={extending !== null}
        onClose={() => {
          if (!extendBusy) setExtending(null);
        }}
        title={
          extending && extending.length > 1
            ? `${extending.length} görevi uzat`
            : `Uzat: ${extending?.[0] ? holderName(extending[0]) : ''}`
        }
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submitExtend();
          }}
        >
          {extending?.length === 1 ? (
            <p className="text-muted-foreground text-xs">
              {extending[0].groupPath} · şimdiki bitiş {endLabel(extending[0].endsAt)}
            </p>
          ) : null}
          <label className="block space-y-1">
            <FieldLabel>Yeni bitiş</FieldLabel>
            <Field
              type="date"
              value={extendEnd}
              min={minEnd}
              onChange={(e) => setExtendEnd(e.target.value)}
              required
            />
          </label>
          {extendError ? (
            <p role="alert" className="text-destructive text-sm">
              {extendError}
            </p>
          ) : null}
          <SaveButton pending={extendBusy}>Uzat</SaveButton>
        </form>
      </Drawer>
      <PickerDrawer
        open={handing !== null}
        onClose={() => {
          handOpening.current += 1;
          setHanding(null);
        }}
        title={handing ? `Devret: ${handing.groupPath}` : 'Devret'}
        query={handQuery}
        onQuery={setHandQuery}
        placeholder="Ad veya tam e-posta"
        loading={handSearch.loading}
        failed={handSearch.failed}
        options={handOptions}
        emptyMessage={handSearch.ready ? 'Eşleşen kişi yok' : MEMBER_CANDIDATE_HINT}
        onPick={(id) => {
          const successor = handSearch.people.find((person) => person.id === id);
          if (handing && successor) void askHandover(handing, successor);
        }}
      >
        {handoverDialog}
      </PickerDrawer>
    </div>
  );
}
