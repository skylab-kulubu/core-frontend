'use client';

import {
  BarList,
  Button,
  FilterPills,
  MenuItem,
  cn,
  type DataListColumn,
} from '@skylab-kulubu/skylcn-ui';
import { DataList } from '@/components/chrome/DataList';
import { Ban, History, Pencil, Plus, RefreshCw, Trophy, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SummaryStrip } from '@/components/chrome/ListPage';
import { Command, CommandBar, CommandMenu } from '@/components/chrome/object-page/CommandBar';
import { ObjectCard } from '@/components/chrome/object-page/ObjectPage';
import { EmptyState } from '@/components/chrome/PageState';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { SaveButton } from '@/components/chrome/SaveButton';
import { StatusChip } from '@/components/chrome/StatusChip';
import { TextArea } from '@/components/chrome/TextArea';
import { ProblemError } from '@/lib/api/core';
import {
  COMPETITION_STATUS_LABELS,
  MOVE_LABELS,
  competitionMoves,
  competitionsApi,
  parsePoints,
  takesEntrants,
  type Competition,
  type CompetitionEntry,
  type CompetitionStatus,
  type EntrantCandidate,
  type Leaderboard,
  type LeaderboardRow,
} from '@/lib/api/competitions';
import { coreProblemMessage } from '@/lib/core-problems';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';

const STATUS_KIND: Record<
  CompetitionStatus,
  'draft' | 'upcoming' | 'live' | 'ended' | 'cancelled'
> = {
  draft: 'draft',
  open: 'upcoming',
  running: 'live',
  closed: 'ended',
  cancelled: 'cancelled',
};

/** The address keeps the competition open: a link or a reload returns to it. */
const PARAM = 'yarisma';

function readOpen(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(PARAM);
}

function writeOpen(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set(PARAM, id);
  else url.searchParams.delete(PARAM);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
}

const formatPoints = (value: number | null) =>
  value === null ? '—' : new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 }).format(value);

/** core's reason for a refused write, with the codes the panel can say better. */
function scoreProblem(err: unknown): string {
  if (err instanceof ProblemError) {
    if (err.code === 'own_entrant') return 'Kendi puanını yazamazsın; başka bir yönetici yazar.';
    if (err.code === 'invalid_points') return 'Puan en çok üç ondalıklı bir sayı olmalı.';
    if (err.code === 'competition_status') return 'Yarışmanın durumu buna izin vermiyor.';
    if (err.code === 'score_changed')
      return 'Bu arada başka biri puanı değiştirdi; tablo yenilendi.';
  }
  return coreProblemMessage(err, 'Puan yazılamadı');
}

/** One row's score cell: typed in place; changing a written score asks why. */
function ScoreCell({
  row,
  editable,
  onSave,
}: {
  row: LeaderboardRow;
  editable: boolean;
  /** Resolves once the write is done or given up; `revert` puts the saved score back. */
  onSave: (row: LeaderboardRow, points: number, revert: () => void) => Promise<void>;
}) {
  const saved = row.score === null ? '' : String(row.score);
  const [draft, setDraft] = useState(saved);
  const [bad, setBad] = useState(false);
  // Enter and then leaving the cell is one write, not two: the second waits for none
  const saving = useRef(false);
  useEffect(() => {
    setDraft(row.score === null ? '' : String(row.score));
    setBad(false);
  }, [row.score]);
  if (!editable) {
    return (
      <span className="text-foreground text-sm font-semibold tabular-nums">
        {formatPoints(row.score)}
      </span>
    );
  }
  const commit = () => {
    if (saving.current) return;
    if (!draft.trim() || draft.trim() === saved) {
      setBad(false);
      return;
    }
    const points = parsePoints(draft);
    if (points === null) {
      setBad(true);
      return;
    }
    setBad(false);
    saving.current = true;
    void onSave(row, points, () => setDraft(saved)).finally(() => {
      saving.current = false;
    });
  };
  return (
    <Field
      inputMode="decimal"
      aria-label={`${row.displayName}: puan`}
      aria-invalid={bad}
      value={draft}
      placeholder="Puan"
      onChange={(change) => setDraft(change.target.value)}
      onBlur={commit}
      onKeyDown={(key) => {
        if (key.key === 'Enter') {
          key.preventDefault();
          commit();
        }
      }}
      className="h-9 w-24 text-right tabular-nums"
    />
  );
}

/** Adds the event's registrations as Entrants: search, those who came in first, pick many. */
function AddEntrants({
  competition,
  open,
  onClose,
  onAdded,
}: {
  competition: Competition;
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<EntrantCandidate[]>([]);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [onlyIn, setOnlyIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      competitionsApi
        .candidates(competition.id, query)
        .then((found) => {
          if (!cancelled) setRows(found);
        })
        .catch((err) => {
          if (!cancelled) setError(coreProblemMessage(err, 'Kayıtlar yüklenemedi'));
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, query, competition.id]);

  useEffect(() => {
    if (!open) {
      setPicked(new Set());
      setQuery('');
      setError(null);
    }
  }, [open]);

  const shown = rows.filter((row) => !row.entrant && (!onlyIn || row.checkedIn));
  const allIn = rows.filter((row) => !row.entrant && row.checkedIn).length;

  async function add() {
    setSaving(true);
    setError(null);
    try {
      await competitionsApi.addEntrants(competition.id, [...picked]);
      onAdded();
      onClose();
    } catch (err) {
      setError(
        err instanceof ProblemError && err.code === 'ticket_taken'
          ? 'Seçilenlerden biri zaten katılımcı; liste yenilendi.'
          : coreProblemMessage(err, 'Katılımcılar eklenemedi'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Katılımcı ekle"
      dirty={picked.size > 0}
      actions={
        <SaveButton type="button" disabled={!picked.size || saving} onClick={() => void add()}>
          {saving ? 'Ekleniyor…' : picked.size ? `${picked.size} kişiyi ekle` : 'Kişi seç'}
        </SaveButton>
      }
    >
      <div className="space-y-3">
        <Field
          type="search"
          aria-label="Kayıt ara"
          placeholder="Ad"
          value={query}
          onChange={(change) => setQuery(change.target.value)}
        />
        <div className="flex items-center justify-between gap-2">
          <FilterPills
            aria-label="Kimler"
            value={onlyIn ? 'in' : 'all'}
            onValueChange={(value) => setOnlyIn(value === 'in')}
            options={[
              { value: 'in', label: 'Giriş yapanlar', count: allIn },
              { value: 'all', label: 'Hepsi', count: rows.filter((row) => !row.entrant).length },
            ]}
          />
          {shown.length ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPicked(new Set(shown.map((row) => row.ticketId)))}
            >
              Hepsini seç
            </Button>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        {shown.length ? (
          <ul className="border-border-subtle divide-border-subtle divide-y rounded-lg border">
            {shown.map((row) => (
              <li key={row.ticketId}>
                <label className="hover:bg-accent flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    className="accent-skylab-400 size-4"
                    checked={picked.has(row.ticketId)}
                    onChange={() =>
                      setPicked((current) => {
                        const next = new Set(current);
                        if (next.has(row.ticketId)) next.delete(row.ticketId);
                        else next.add(row.ticketId);
                        return next;
                      })
                    }
                  />
                  <span className="text-foreground min-w-0 flex-1 truncate text-sm">
                    {row.displayName}
                  </span>
                  {row.ticketType === 'GUEST' ? <StatusChip kind="guest" /> : null}
                  {row.checkedIn ? <StatusChip kind="checked-in" /> : null}
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn('text-subtle-foreground', TEXT_SECONDARY)}>
            {onlyIn ? 'Giriş yapan, eklenmemiş kayıt yok' : 'Eklenmemiş kayıt yok'}
          </p>
        )}
      </div>
    </Drawer>
  );
}

/** Name and description of a new or existing competition. */
function CompetitionForm({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: Competition | null;
  onClose: () => void;
  onSave: (body: { name: string; description: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setError(null);
  }, [open, initial]);
  const dirty = name !== (initial?.name ?? '') || description !== (initial?.description ?? '');
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={initial ? 'Yarışmayı düzenle' : 'Yarışma ekle'}
      dirty={dirty}
    >
      <form
        className="space-y-3"
        noValidate
        onSubmit={async (submit) => {
          submit.preventDefault();
          if (!name.trim()) {
            setError('Ad gerekli');
            return;
          }
          setSaving(true);
          try {
            await onSave({ name: name.trim(), description: description.trim() });
            onClose();
          } catch (err) {
            setError(coreProblemMessage(err, 'Yarışma kaydedilemedi'));
          } finally {
            setSaving(false);
          }
        }}
      >
        <label className="block space-y-1">
          <FieldLabel>Ad</FieldLabel>
          <Field value={name} maxLength={200} onChange={(change) => setName(change.target.value)} />
        </label>
        <label className="block space-y-1">
          <FieldLabel>Açıklama</FieldLabel>
          <TextArea
            rows={3}
            maxLength={5000}
            value={description}
            onChange={(change) => setDescription(change.target.value)}
          />
        </label>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <SaveButton disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</SaveButton>
      </form>
    </Drawer>
  );
}

/**
 * The event's competitions (core's competition module, ADR-0068): one picked at a time with its
 * status steps, its table (ranks, scores typed in place, a correction asking why), a bar of the
 * leaders and the score history.
 */
export function CompetitionBoard({ eventId, canManage }: { eventId: string; canManage: boolean }) {
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  const [competitions, setCompetitions] = useState<Competition[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [entries, setEntries] = useState<CompetitionEntry[] | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<'new' | 'edit' | null>(null);
  const [history, setHistory] = useState(false);
  const reason = useRef('');

  const load = useCallback(async () => {
    try {
      const rows = await competitionsApi.listByEvent(eventId);
      setCompetitions(rows);
      setFailed(null);
      const wanted = readOpen();
      setOpenId((current) => {
        const keep = current ?? wanted;
        if (rows.some((row) => row.id === keep)) return keep;
        // The one being played first, then one taking entrants, then the oldest
        const by = (status: Competition['status']) => rows.find((row) => row.status === status);
        return (by('running') ?? by('open') ?? rows[0])?.id ?? null;
      });
    } catch (err) {
      setFailed(coreProblemMessage(err, 'Yarışmalar yüklenemedi'));
      setCompetitions([]);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = competitions?.find((row) => row.id === openId) ?? null;

  const loadBoard = useCallback(async () => {
    if (!openId) return;
    try {
      setBoard(await competitionsApi.leaderboard(openId));
      setBoardError(null);
    } catch (err) {
      setBoardError(coreProblemMessage(err, 'Sıralama yüklenemedi'));
    }
  }, [openId]);

  useEffect(() => {
    setBoard(null);
    setEntries(null);
    setHistory(false);
    setRowError(null);
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (!history || !openId) return;
    competitionsApi
      .entries(openId)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [history, openId, board]);

  const replaceCompetition = (next: Competition) =>
    setCompetitions((rows) => (rows ?? []).map((row) => (row.id === next.id ? next : row)));

  function pick(id: string) {
    setOpenId(id);
    writeOpen(id);
  }

  const editable = canManage && current !== null && current.status !== 'cancelled';

  async function save(row: LeaderboardRow, points: number, revert: () => void) {
    if (!current) return;
    setRowError(null);
    const write = async (why?: string) => {
      try {
        await competitionsApi.score(current.id, {
          entrantId: row.entrantId,
          points,
          ...(row.entryId ? { replacesId: row.entryId, reason: why } : {}),
        });
        notify.success(`${row.displayName}: ${formatPoints(points)} puan`);
      } catch (err) {
        setRowError(`${row.displayName}: ${scoreProblem(err)}`);
      } finally {
        await loadBoard();
      }
    };
    if (!row.entryId) {
      await write();
      return;
    }
    reason.current = '';
    // Settles when the question closes, either way, so the cell takes no second write meanwhile
    let settle: () => void = () => undefined;
    const asked = new Promise<void>((resolve) => {
      settle = resolve;
    });
    confirm({
      title: `${row.displayName}: puan ${formatPoints(row.score)} → ${formatPoints(points)}`,
      description: 'Eski puan geçmişte kalır.',
      content: (
        <label className="block space-y-1">
          <FieldLabel>Neden</FieldLabel>
          <Field
            autoFocus
            maxLength={500}
            onChange={(change) => {
              reason.current = change.target.value;
            }}
          />
        </label>
      ),
      actionLabel: 'Puanı düzelt',
      destructive: false,
      failure: 'Puan düzeltilemedi',
      onConfirm: async () => {
        if (!reason.current.trim()) throw new Error('Neden gerekli');
        await write(reason.current.trim());
        settle();
      },
      // Vazgeç: the cell shows the saved score again, as the ranking does
      onCancel: () => {
        revert();
        settle();
      },
    });
    await asked;
  }

  async function move(to: 'open' | 'start' | 'close' | 'reopen') {
    if (!current) return;
    try {
      replaceCompetition(await competitionsApi.move(current.id, to));
    } catch (err) {
      setBoardError(coreProblemMessage(err, 'Durum değiştirilemedi'));
    }
  }

  function askCancel() {
    if (!current) return;
    reason.current = '';
    confirm({
      title: `"${current.name}" iptal edilsin mi?`,
      description: 'İptal geri alınmaz; puanlar geçmişte kalır.',
      content: (
        <label className="block space-y-1">
          <FieldLabel>Neden</FieldLabel>
          <Field
            maxLength={500}
            onChange={(change) => {
              reason.current = change.target.value;
            }}
          />
        </label>
      ),
      actionLabel: 'Yarışmayı iptal et',
      failure: 'Yarışma iptal edilemedi',
      onConfirm: async () => {
        if (!reason.current.trim()) throw new Error('Neden gerekli');
        replaceCompetition(await competitionsApi.cancel(current.id, reason.current.trim()));
      },
    });
  }

  const rows = board?.rows ?? [];
  const scored = rows.filter((row) => row.score !== null);
  const leaders = scored
    .slice(0, 8)
    .map((row) => ({ key: row.entrantId, label: row.displayName, value: row.score ?? 0 }));

  if (competitions === null) return <PageSkeleton variant="list" />;

  const add = canManage ? (
    <Command primary icon={Plus} label="Yarışma ekle" onClick={() => setForm('new')} />
  ) : null;

  const columns: DataListColumn<LeaderboardRow>[] = [
    {
      id: 'rank',
      width: '3rem',
      header: 'Sıra',
      cell: (row) => (
        <span
          className={cn(
            'text-sm font-semibold tabular-nums',
            row.rank === 1 ? 'text-warning' : 'text-secondary-foreground',
          )}
        >
          {row.rank ?? '—'}
        </span>
      ),
    },
    {
      id: 'name',
      width: 'minmax(0,1fr)',
      header: 'Katılımcı',
      cell: (row) => (
        <span className="text-foreground flex min-w-0 items-center gap-2 text-sm">
          <span className="truncate">{row.displayName}</span>
          {row.rank === 1 ? <Trophy className="text-warning size-4 shrink-0" aria-hidden /> : null}
        </span>
      ),
    },
    {
      id: 'score',
      width: '7.5rem',
      align: 'end',
      header: 'Puan',
      interactive: editable,
      cell: (row) => <ScoreCell row={row} editable={editable} onSave={save} />,
    },
  ];

  return (
    <div className="space-y-4">
      {failed ? <EmptyState kind="failed" title={failed} onRetry={() => void load()} /> : null}
      {!failed && competitions.length === 0 ? (
        <EmptyState
          kind="first-use"
          title="Henüz yarışma yok"
          action={
            canManage ? (
              <Button variant="primary" size="sm" onClick={() => setForm('new')}>
                <Plus aria-hidden />
                Yarışma ekle
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {competitions.length > 1 ? (
        <div className="-mx-1 overflow-x-auto px-1 [&_button]:whitespace-nowrap">
          <FilterPills
            aria-label="Yarışma"
            value={openId ?? ''}
            onValueChange={pick}
            options={competitions.map((row) => ({ value: row.id, label: row.name }))}
          />
        </div>
      ) : null}
      {current ? (
        <>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-foreground-strong text-lg font-semibold">{current.name}</h2>
              <StatusChip
                kind={STATUS_KIND[current.status]}
                label={COMPETITION_STATUS_LABELS[current.status]}
              />
            </div>
            {current.description ? (
              <p className={cn('text-secondary-foreground', TEXT_SECONDARY)}>
                {current.description}
              </p>
            ) : null}
            {current.status === 'cancelled' && current.cancelReason ? (
              <p className={cn('text-destructive', TEXT_SECONDARY)}>{current.cancelReason}</p>
            ) : null}
            <CommandBar label="Yarışma komutları">
              {canManage && takesEntrants(current.status) ? (
                <Command
                  primary
                  icon={UserPlus}
                  label="Katılımcı ekle"
                  onClick={() => setAdding(true)}
                />
              ) : null}
              {canManage
                ? competitionMoves(current.status).map((to) => (
                    <Command
                      key={to}
                      icon={Trophy}
                      label={MOVE_LABELS[to]}
                      onClick={() => void move(to)}
                    />
                  ))
                : null}
              <Command icon={RefreshCw} label="Yenile" onClick={() => void loadBoard()} />
              <Command
                icon={History}
                label={history ? 'Geçmişi gizle' : 'Geçmiş'}
                onClick={() => setHistory((shown) => !shown)}
              />
              {canManage ? (
                <CommandMenu
                  items={[
                    <MenuItem key="edit" icon={Pencil} onClick={() => setForm('edit')}>
                      Düzenle
                    </MenuItem>,
                    <MenuItem key="new" icon={Plus} onClick={() => setForm('new')}>
                      Yarışma ekle
                    </MenuItem>,
                    ...(current.status !== 'cancelled'
                      ? [
                          <MenuItem key="cancel" icon={Ban} onClick={askCancel}>
                            İptal et…
                          </MenuItem>,
                        ]
                      : []),
                  ]}
                />
              ) : null}
            </CommandBar>
          </div>

          <SummaryStrip
            items={[
              { key: 'entrants', label: 'Katılımcı', value: rows.length },
              { key: 'scored', label: 'Puanlanan', value: scored.length },
              {
                key: 'top',
                label: 'En yüksek',
                value: scored.length ? formatPoints(scored[0].score) : '—',
                hint: scored.length ? (
                  <span className={cn('text-subtle-foreground truncate', TEXT_SECONDARY)}>
                    {scored[0].displayName}
                  </span>
                ) : undefined,
              },
            ]}
          />

          {boardError ? (
            <EmptyState kind="failed" title={boardError} onRetry={() => void loadBoard()} />
          ) : null}
          {rowError ? (
            <p role="alert" className="text-destructive text-sm">
              {rowError}
            </p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <ObjectCard title="Sıralama">
              {rows.length ? (
                <DataList
                  columns={columns}
                  rows={rows}
                  getRowId={(row) => row.entrantId}
                  loading={!board}
                />
              ) : board ? (
                <p className={cn('text-subtle-foreground', TEXT_SECONDARY)}>Henüz katılımcı yok</p>
              ) : (
                <PageSkeleton variant="list" />
              )}
            </ObjectCard>
            <ObjectCard title="İlk sıradakiler">
              {leaders.length ? (
                <BarList
                  highlightTop
                  max={Math.max(...leaders.map((row) => row.value), 1)}
                  items={leaders.map((row) => ({ ...row, value: row.value }))}
                />
              ) : (
                <p className={cn('text-subtle-foreground', TEXT_SECONDARY)}>
                  Puan yazılınca burada görünür
                </p>
              )}
            </ObjectCard>
          </div>

          {history ? (
            <ObjectCard title="Puan geçmişi">
              {entries === null ? (
                <PageSkeleton variant="list" />
              ) : entries.length ? (
                <ul className="divide-border-subtle divide-y">
                  {[...entries].reverse().map((entry) => {
                    const who =
                      rows.find((row) => row.entrantId === entry.entrantId)?.displayName ??
                      'Katılımcı';
                    return (
                      <li key={entry.id} className="flex items-center gap-3 py-2 text-sm">
                        <span
                          className={cn(
                            'text-foreground min-w-0 flex-1 truncate',
                            entry.revokedAt && 'text-subtle-foreground line-through',
                          )}
                        >
                          {who}: {formatPoints(entry.points)}
                        </span>
                        <span className={cn('text-subtle-foreground shrink-0', TEXT_SECONDARY)}>
                          {entry.revokedAt
                            ? entry.revokeReason || 'Geri alındı'
                            : new Date(entry.recordedAt).toLocaleString('tr-TR', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className={cn('text-subtle-foreground', TEXT_SECONDARY)}>Puan yazılmadı</p>
              )}
            </ObjectCard>
          ) : null}

          <AddEntrants
            competition={current}
            open={adding}
            onClose={() => setAdding(false)}
            onAdded={() => {
              notify.success('Katılımcılar eklendi');
              void loadBoard();
            }}
          />
        </>
      ) : competitions.length === 0 ? null : (
        <CommandBar label="Yarışma komutları">{add}</CommandBar>
      )}
      <CompetitionForm
        open={form !== null}
        initial={form === 'edit' ? current : null}
        onClose={() => setForm(null)}
        onSave={async (body) => {
          if (form === 'edit' && current) {
            replaceCompetition(await competitionsApi.update(current.id, body));
            return;
          }
          const created = await competitionsApi.create(eventId, body);
          setCompetitions((rows) => [...(rows ?? []), created]);
          pick(created.id);
        }}
      />
      {confirmDialog}
    </div>
  );
}
