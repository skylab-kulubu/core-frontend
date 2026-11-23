'use client';

import { Radio, RadioGroup } from '@skylab-kulubu/skylcn-ui';
import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { DangerSection, SettingsPage, SettingsSection } from '@/components/chrome/SettingsPage';
import { Switch } from '@/components/chrome/Switch';
import { TextArea } from '@/components/chrome/TextArea';
import { useGroupWorkspace } from '@/components/identity/group/GroupWorkspace';
import { identityApi, type Group } from '@/lib/api/identity';
import {
  coreProblemMessage,
  groupDeleteProblemMessage,
  groupWriteProblemMessage,
} from '@/lib/core-problems';
import {
  GROUP_TEXTS,
  GROUP_TOGGLES,
  buildGroupAttrs,
  competitionManagers,
  extraGroupAttrs,
  isKnownGroupAttr,
  isRetiredGroupAttr,
  isTeamSettingAttr,
  isToggleOn,
  type CompetitionManagers,
} from '@/lib/group-attrs';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

/** What all members may do once the Team's Competitions are theirs too (core docs/competitions.md "Who"). */
const MEMBERS_MANAGE_COMPETITIONS =
  'Tüm üyeler, alt ekiplerin üyeleri dahil, bu ekibin etkinliklerindeki yarışmaları açar, düzenler, yarışmacı ekler ve puan girer. Arşivleyemez.';

/** Why a reader who does not manage the Team sees its settings read-only (core: Manages or Privileged). */
const SETTINGS_READ_ONLY =
  'Bu ayarları ekibin liderleri ve koordinatörleri, üst ekiplerin liderleri ve YK değiştirir.';

/** core's managed tree could not be read: whether the reader may change the settings is unknown. */
const SETTINGS_UNKNOWN = 'Yetkin okunamadı; sayfayı yenile.';

const DELETE_TEXT =
  'Yalnız üyesi, alt grubu ve bağlı kaydı olmayan gruplar silinebilir. Silme geri alınamaz; grup kodu bir daha kullanılamaz.';

/** core refused the Group's own save; the words are the panel's, said in the bar. */
class SaveRefused extends Error {}

type Extra = { key: string; value: string };

type Form = {
  name: string;
  toggles: Record<string, boolean>;
  texts: Record<string, string>;
  /** The attributes no field above holds, as typed (Gelişmiş). */
  extra: Extra[];
  competition: CompetitionManagers;
};

/** The attributes only core's own routes write: kept as they are on a save. */
function keptAttrs(group: Group): Record<string, string> {
  return Object.fromEntries(
    Object.entries(extraGroupAttrs(group.attributes)).filter(
      ([key]) => isTeamSettingAttr(key) || isRetiredGroupAttr(key),
    ),
  );
}

function formOf(group: Group): Form {
  return {
    name: group.name,
    toggles: Object.fromEntries(
      GROUP_TOGGLES.map((row) => [row.key, isToggleOn(group.attributes, row.key)]),
    ),
    texts: Object.fromEntries(
      GROUP_TEXTS.map((row) => [row.key, group.attributes?.[row.key] ?? '']),
    ),
    extra: Object.entries(extraGroupAttrs(group.attributes))
      .filter(([key]) => !isTeamSettingAttr(key) && !isRetiredGroupAttr(key))
      .map(([key, value]) => ({ key, value })),
    competition: competitionManagers(group.attributes),
  };
}

/** Why a typed extra attribute cannot be kept; null when it can. */
function extraProblem(rows: readonly Extra[]): string | null {
  const keys = rows.map((row) => row.key.trim()).filter(Boolean);
  for (const key of keys) {
    if (isTeamSettingAttr(key)) return `${key}: bu ayar Yarışmalar bölümünde.`;
    if (isRetiredGroupAttr(key)) return `${key}: bu ayar kaldırıldı.`;
    if (isKnownGroupAttr(key)) return `${key}: bu alan yukarıdaki bölümlerde.`;
  }
  if (new Set(keys).size !== keys.length) return 'Aynı anahtar iki kez yazılmış.';
  return null;
}

/**
 * Ayarlar: the Group's names, description, visibility, a Team's Competition
 * managers and its other attributes, saved together with one Kaydet; deleting
 * the Group last. Privileged writers change the Group (group.write); a Team's
 * managers change its Competition setting (core's team.settings).
 */
export function GroupSettings() {
  const { id, group, isTeam, managed, managedGroups, canWrite, reload } = useGroupWorkspace();
  const router = useRouter();
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  const saved = useMemo(() => formOf(group), [group]);
  const [form, setForm] = useState<Form>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    setForm(saved);
    setError(null);
  }, [saved]);

  // A Team's settings show to whoever reads the Team; whoever manages it (its
  // Leader, one above: core's team.settings; Privileged: group.write) changes them
  const settingsWrite = isTeam && (canWrite || managed?.can?.['team.settings'] === true);
  const settingsKnown = canWrite || managedGroups.status !== 'loading';
  const profileDirty =
    form.name !== saved.name ||
    JSON.stringify([form.toggles, form.texts, form.extra]) !==
      JSON.stringify([saved.toggles, saved.texts, saved.extra]);
  const competitionDirty = form.competition !== saved.competition;
  const dirty = (canWrite && profileDirty) || (settingsWrite && competitionDirty);

  async function write() {
    setSaving(true);
    setError(null);
    try {
      if (canWrite && profileDirty) {
        const extra = Object.fromEntries(
          form.extra
            .filter((row) => row.key.trim())
            .map((row) => [row.key.trim(), row.value] as const),
        );
        try {
          await identityApi.updateGroup(id, {
            name: form.name.trim(),
            attributes: buildGroupAttrs({
              toggles: form.toggles,
              texts: form.texts,
              extra: { ...keptAttrs(group), ...extra },
            }),
          });
        } catch (err) {
          throw new SaveRefused(groupWriteProblemMessage(err, 'save', 'Kaydedilemedi'));
        }
      }
      if (settingsWrite && competitionDirty) {
        await identityApi.setTeamSettings(id, { competitionManagers: form.competition });
      }
      notify.success('Ayarlar kaydedildi');
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setError(null);
    if (!form.name.trim()) {
      setError('Grup kodu boş olamaz.');
      return;
    }
    const problem = extraProblem(form.extra);
    if (problem) {
      setError(problem);
      return;
    }
    if (settingsWrite && competitionDirty && form.competition === 'members') {
      // Widening asks first; core writes it only on the confirmed answer
      confirm({
        title: `${group.name} ekibinin yarışmalarını tüm üyeler yönetsin mi?`,
        description: MEMBERS_MANAGE_COMPETITIONS,
        actionLabel: 'Tüm üyelere aç',
        destructive: false,
        onConfirm: write,
        failure: (err) =>
          err instanceof SaveRefused ? err.message : coreProblemMessage(err, 'Kaydedilemedi'),
      });
      return;
    }
    try {
      await write();
    } catch (err) {
      if (err instanceof SaveRefused) {
        setError(err.message);
        return;
      }
      throw err;
    }
  }

  const set = (change: Partial<Form>) => setForm((current) => ({ ...current, ...change }));

  return (
    <SettingsPage
      dirty={dirty}
      saving={saving}
      error={error}
      onSave={save}
      onDiscard={() => {
        setForm(saved);
        setError(null);
      }}
    >
      <SettingsSection title="Ad">
        <fieldset disabled={!canWrite} className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 sm:col-span-2">
            <FieldLabel>Grup kodu</FieldLabel>
            <Field value={form.name} onChange={(e) => set({ name: e.target.value })} required />
          </label>
          {GROUP_TEXTS.filter((row) => !row.multiline).map((row) => (
            <label key={row.key} className="block space-y-1">
              <FieldLabel>{row.label}</FieldLabel>
              <Field
                value={form.texts[row.key] ?? ''}
                onChange={(e) => set({ texts: { ...form.texts, [row.key]: e.target.value } })}
              />
            </label>
          ))}
        </fieldset>
      </SettingsSection>
      <SettingsSection title="Açıklama">
        <fieldset disabled={!canWrite} className="grid gap-3">
          {GROUP_TEXTS.filter((row) => row.multiline).map((row) => (
            <label key={row.key} className="block space-y-1">
              <FieldLabel>{row.label}</FieldLabel>
              <TextArea
                rows={3}
                value={form.texts[row.key] ?? ''}
                onChange={(e) => set({ texts: { ...form.texts, [row.key]: e.target.value } })}
              />
            </label>
          ))}
        </fieldset>
      </SettingsSection>
      <SettingsSection title="Görünürlük ve kapı">
        <fieldset disabled={!canWrite} className="space-y-2">
          {GROUP_TOGGLES.map((row) => (
            <Switch
              key={row.key}
              checked={Boolean(form.toggles[row.key])}
              onChange={(checked) => set({ toggles: { ...form.toggles, [row.key]: checked } })}
              label={row.label}
              hint={row.hint}
            />
          ))}
        </fieldset>
      </SettingsSection>
      {isTeam ? (
        <SettingsSection title="Yarışmalar">
          {settingsKnown && !settingsWrite ? (
            <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
              {managedGroups.status === 'failed' ? SETTINGS_UNKNOWN : SETTINGS_READ_ONLY}
            </p>
          ) : null}
          <div className="space-y-2">
            <span id="competition-managers" className={`${TEXT_SECONDARY} font-medium`}>
              Yarışmaları kim yönetir
            </span>
            <RadioGroup
              aria-labelledby="competition-managers"
              value={form.competition}
              disabled={!settingsWrite || saving}
              onValueChange={(value: unknown) =>
                set({ competition: value === 'members' ? 'members' : 'leaders' })
              }
            >
              <Radio value="leaders" label="Liderler ve koordinatörler (varsayılan)" />
              <Radio value="members" label="Tüm üyeler" description={MEMBERS_MANAGE_COMPETITIONS} />
            </RadioGroup>
          </div>
        </SettingsSection>
      ) : null}
      {canWrite ? (
        <SettingsSection
          title="Gelişmiş"
          action={
            <button
              type="button"
              className={`text-skylab-300 hover:text-foreground ${TEXT_SECONDARY}`}
              aria-expanded={advanced}
              onClick={() => setAdvanced((open) => !open)}
            >
              {advanced ? 'Gizle' : `Göster (${form.extra.length})`}
            </button>
          }
        >
          {advanced ? (
            <div className="space-y-2">
              {form.extra.map((row, index) => (
                <div key={index} className="flex items-end gap-2">
                  <label className="block min-w-0 flex-1 space-y-1">
                    <FieldLabel>Anahtar</FieldLabel>
                    <Field
                      value={row.key}
                      onChange={(e) =>
                        set({
                          extra: form.extra.map((item, at) =>
                            at === index ? { ...item, key: e.target.value } : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="block min-w-0 flex-1 space-y-1">
                    <FieldLabel>Değer</FieldLabel>
                    <Field
                      value={row.value}
                      onChange={(e) =>
                        set({
                          extra: form.extra.map((item, at) =>
                            at === index ? { ...item, value: e.target.value } : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <ActionButton
                    icon={X}
                    label={`${row.key || 'Satır'}: kaldır`}
                    onClick={() => set({ extra: form.extra.filter((_, at) => at !== index) })}
                  />
                </div>
              ))}
              <ActionButton
                icon={Plus}
                label="Öznitelik ekle"
                showLabel
                onClick={() => set({ extra: [...form.extra, { key: '', value: '' }] })}
              />
            </div>
          ) : null}
        </SettingsSection>
      ) : null}
      {canWrite ? (
        <DangerSection
          title="Grubu sil"
          actionLabel="Grubu sil"
          confirm={{
            title: `${group.name} silinsin mi?`,
            description: DELETE_TEXT,
            actionLabel: 'Grubu sil',
            onConfirm: async () => {
              await identityApi.deleteGroup(group.id);
              notify.success('Grup silindi');
              router.push('/groups');
            },
            failure: groupDeleteProblemMessage,
          }}
        />
      ) : null}
      {confirmDialog}
    </SettingsPage>
  );
}
