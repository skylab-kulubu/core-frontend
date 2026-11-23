'use client';

import { useState, type FormEvent } from 'react';
import { FolderInput, Plus, Tag, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { SectionHeading } from '@/components/chrome/PanelChart';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { SaveButton } from '@/components/chrome/SaveButton';
import { identityApi, type ManagedGroup, type MovePreview } from '@/lib/api/identity';
import { listStatus } from '@/lib/list-status';
import { pickerMatch } from '@/lib/picker';
import {
  moveProblemMessage,
  movePreviewRows,
  moveRefusalMessage,
  moveTargets,
  subTeamDeleteMessage,
  teamName,
  teamStructureMessage,
} from '@/lib/sub-teams';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

const DELETE_TEXT =
  'Yalnız kimsesi olmayan alt ekip silinir. Silme geri alınamaz; kodu bir daha kullanılamaz.';
const MOVE_TEXT =
  'Ekip, altındaki gruplar ve üyeleriyle taşınır. Bundan sonra yeni üst ekibin liderleri yönetir.';
/** core refuses only for its own records; what else holds the code is not checked (docs/team-codes.md). */
const CODE_HINT = 'Etkinlik ya da sertifika kaydında geçen kodu core değiştirmez.';
const CODE_TEXT =
  "Geri alınamaz; eski kod bir daha kullanılamaz. Sitede, CMS'te, Forms'ta ya da kapı taramasında kodla eşleşen yerler kırılabilir.";
/** core's code.write: a Leader's is false unless core opens it (TEAM_DELEGATION_LEADER_CODES). */
const CODE_BY_YK = 'Alt ekip kodunu YK değiştirir.';
const PROTECTED_BY_YK = 'Korunan alt ekipleri yalnız YK değiştirir.';

function subtitle(team: ManagedGroup): string {
  return `${team.code} · ${team.memberCount ?? 0} üye · ${team.leaderCount ?? 0} lider`;
}

/** The move's summary as core's preview gives it, in the confirmation. */
function PreviewList({ preview }: { preview: MovePreview }) {
  return (
    <dl className="divide-border-subtle border-border divide-y overflow-hidden rounded-lg border">
      {movePreviewRows(preview).map((row) => (
        <div key={row.label} className="space-y-1 px-3 py-2">
          <dt>
            <FieldLabel>{row.label}</FieldLabel>
          </dt>
          <dd className="text-secondary-foreground text-sm break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Alt ekipler: the Sub-teams of a Team from core's managed tree, with what
 * core lets the reader do on each (`can`): open one under this Team
 * (`subteams.write`), change its code (`code.write`), move it (`team.move`)
 * and delete it (`team.delete`). The panel adds no rule of its own; core
 * decides every request again. `onChanged` reads the tree again.
 */
export function SubTeams({
  team,
  tree,
  base,
  onChanged,
}: {
  team: ManagedGroup;
  tree: readonly ManagedGroup[];
  base: string;
  onChanged: () => void;
}) {
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  // The move's question opens over its drawer
  const [confirmMove, moveDialog] = useConfirm();
  // So does the code change's, over its drawer
  const [confirmCode, codeDialog] = useConfirm();
  const subTeams = team.children ?? [];
  const opens = team.can?.['subteams.write'] === true;

  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [nameTr, setNameTr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  const [coding, setCoding] = useState<ManagedGroup | null>(null);
  const [newCode, setNewCode] = useState('');

  const [moving, setMoving] = useState<ManagedGroup | null>(null);
  const [moveQuery, setMoveQuery] = useState('');
  const [moveError, setMoveError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  if (subTeams.length === 0 && !opens) return null;

  const writes = (row: ManagedGroup) =>
    row.can?.['code.write'] === true ||
    row.can?.['team.move'] === true ||
    row.can?.['team.delete'] === true;
  const writer = opens || subTeams.some(writes);
  // Why an action the reader might look for is missing: core's answer, said once
  const codeNote =
    writer && subTeams.some((row) => !row.protected && row.can?.['code.write'] !== true);
  const protectedNote = subTeams.some((row) => row.protected && !writes(row));

  const targets = moving ? moveTargets(tree, moving) : [];
  const targetOptions = targets
    .filter(({ group }) => pickerMatch(moveQuery, teamName(group), group.code, group.path))
    .map(({ group }) => ({ id: group.id, title: teamName(group), subtitle: group.path }));

  async function create(event: FormEvent) {
    event.preventDefault();
    if (createBusy || !code.trim() || !nameTr.trim()) return;
    setCreateBusy(true);
    setCreateError(null);
    try {
      await identityApi.createSubTeam(team.id, {
        code: code.trim(),
        displayNameTr: nameTr.trim(),
        ...(nameEn.trim() ? { displayNameEn: nameEn.trim() } : {}),
      });
      setCreating(false);
      setCode('');
      setNameTr('');
      setNameEn('');
      notify.success('Alt ekip açıldı');
      onChanged();
    } catch (err) {
      setCreateError(teamStructureMessage(err, 'Alt ekip açılamadı'));
    } finally {
      setCreateBusy(false);
    }
  }

  /** A code change cannot be undone: it asks first, and core writes it only on the answer. */
  function changeCode(event: FormEvent) {
    event.preventDefault();
    const next = newCode.trim();
    if (!coding || !next) return;
    if (next === coding.code) {
      setCoding(null);
      return;
    }
    const team = coding;
    confirmCode({
      title: `${teamName(team)} ekibinin kodu ${next} olsun mu?`,
      description: CODE_TEXT,
      actionLabel: 'Kodu değiştir',
      closesDrawer: true,
      onConfirm: async () => {
        await identityApi.changeTeamCode(team.id, next);
        setCoding(null);
        notify.success('Kod değiştirildi');
        onChanged();
      },
      failure: (err) => teamStructureMessage(err, 'Kod değiştirilemedi'),
    });
  }

  /** Reads core's preview of the pick; asks with its summary only when core allows the move. */
  async function pickTarget(targetId: string) {
    const target = targets.find(({ group }) => group.id === targetId)?.group;
    if (!moving || !target || previewing) return;
    setMoveError(null);
    setPreviewing(true);
    let preview: MovePreview | undefined;
    try {
      preview = await identityApi.movePreview(moving.id, target.id);
    } catch (err) {
      setMoveError(moveProblemMessage(err, 'Taşıma önizlemesi okunamadı'));
    } finally {
      setPreviewing(false);
    }
    if (!preview) return;
    if (!preview.allowed) {
      setMoveError(moveRefusalMessage(preview.refusal));
      return;
    }
    const moved = moving;
    confirmMove({
      title: `${teamName(moved)}, ${teamName(target)} altına taşınsın mı?`,
      description: MOVE_TEXT,
      content: <PreviewList preview={preview} />,
      actionLabel: 'Taşı',
      closesDrawer: true,
      onConfirm: async () => {
        await identityApi.moveTeam(moved.id, target.id);
        setMoving(null);
        notify.success('Alt ekip taşındı');
        onChanged();
      },
      failure: (err) => moveProblemMessage(err, 'Taşınamadı'),
    });
  }

  return (
    <section className="space-y-3">
      <SectionHeading
        title="Alt ekipler"
        meta={`${subTeams.length} alt ekip`}
        actions={
          opens ? (
            <ActionButton
              icon={Plus}
              variant="primary"
              label="Alt ekip aç"
              onClick={() => {
                setCreateError(null);
                setCreating(true);
              }}
            />
          ) : null
        }
      />
      {codeNote || protectedNote ? (
        <p className="text-3xs text-subtle-foreground">
          {[codeNote ? CODE_BY_YK : null, protectedNote ? PROTECTED_BY_YK : null]
            .filter(Boolean)
            .join(' ')}
        </p>
      ) : null}
      <ListPanel
        status={listStatus({
          loading: false,
          rowCount: subTeams.length,
          emptyMessage: 'Alt ekip yok',
        })}
      >
        {subTeams.map((row) => (
          <ListItem
            key={row.id}
            href={`${base}/${encodeURIComponent(row.id)}`}
            title={teamName(row)}
            subtitle={subtitle(row)}
            trailing={
              writes(row) ? (
                <div className="flex items-center gap-1">
                  {row.can?.['code.write'] ? (
                    <ActionButton
                      icon={Tag}
                      label="Kodu değiştir"
                      onClick={() => {
                        setNewCode(row.code);
                        setCoding(row);
                      }}
                    />
                  ) : null}
                  {row.can?.['team.move'] ? (
                    <ActionButton
                      icon={FolderInput}
                      label="Taşı"
                      onClick={() => {
                        setMoveQuery('');
                        setMoveError(null);
                        setMoving(row);
                      }}
                    />
                  ) : null}
                  {row.can?.['team.delete'] ? (
                    <ActionButton
                      icon={Trash2}
                      label="Sil"
                      onClick={() =>
                        confirm({
                          title: `${teamName(row)} alt ekibi silinsin mi?`,
                          description: DELETE_TEXT,
                          actionLabel: 'Alt ekibi sil',
                          onConfirm: async () => {
                            await identityApi.deleteGroup(row.id);
                            notify.success('Alt ekip silindi');
                            onChanged();
                          },
                          failure: subTeamDeleteMessage,
                        })
                      }
                    />
                  ) : null}
                </div>
              ) : null
            }
          />
        ))}
      </ListPanel>
      {confirmDialog}

      <Drawer
        open={creating}
        onClose={() => {
          if (!createBusy) setCreating(false);
        }}
        title="Alt ekip aç"
      >
        <form className="space-y-3" onSubmit={create}>
          <div className="space-y-1">
            <label className="block space-y-1">
              <FieldLabel>Kod</FieldLabel>
              <Field
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ör. FRONTEND"
                autoCapitalize="characters"
                spellCheck={false}
                required
              />
            </label>
            <p className="text-3xs text-subtle-foreground">Büyük harf (A-Z), rakam ve tire.</p>
          </div>
          <label className="block space-y-1">
            <FieldLabel>Görünen ad</FieldLabel>
            <Field
              value={nameTr}
              onChange={(e) => setNameTr(e.target.value)}
              maxLength={80}
              required
            />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Görünen ad (İngilizce, isteğe bağlı)</FieldLabel>
            <Field value={nameEn} onChange={(e) => setNameEn(e.target.value)} maxLength={80} />
          </label>
          {createError ? (
            <p role="alert" className="text-destructive text-sm">
              {createError}
            </p>
          ) : null}
          <SaveButton disabled={createBusy}>{createBusy ? 'Açılıyor…' : 'Alt ekibi aç'}</SaveButton>
        </form>
      </Drawer>

      <Drawer
        open={coding !== null}
        onClose={() => setCoding(null)}
        title={coding ? `Kodu değiştir: ${teamName(coding)}` : 'Kodu değiştir'}
      >
        <form className="space-y-3" onSubmit={changeCode}>
          <div className="space-y-1">
            <label className="block space-y-1">
              <FieldLabel>Yeni kod</FieldLabel>
              <Field
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                autoCapitalize="characters"
                spellCheck={false}
                required
              />
            </label>
            <p className="text-3xs text-subtle-foreground">{CODE_HINT}</p>
          </div>
          <SaveButton>Kodu değiştir</SaveButton>
        </form>
        {codeDialog}
      </Drawer>

      <PickerDrawer
        open={moving !== null}
        onClose={() => setMoving(null)}
        title={moving ? `Taşı: ${teamName(moving)}` : 'Taşı'}
        query={moveQuery}
        onQuery={setMoveQuery}
        placeholder="Ekip adı veya yolu"
        loading={previewing}
        options={targetOptions}
        emptyMessage="Taşınabilecek ekip yok"
        error={moveError}
        onPick={(id) => void pickTarget(id)}
      >
        {moveDialog}
      </PickerDrawer>
    </section>
  );
}
