'use client';

import { Tab, Tabs, TabsList } from '@skylab-kulubu/skylcn-ui';
import { X } from 'lucide-react';
import { useState } from 'react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { SaveButton } from '@/components/chrome/SaveButton';
import {
  MEMBER_CANDIDATE_HINT,
  MEMBER_CANDIDATE_MIN,
  usePickerSearch,
} from '@/components/identity/use-person-search';
import { appsApi, type AppSummary, type AppTarget, type AppTargetType } from '@/lib/api/apps';
import { PERSON_ASSIGNMENT_HINT, initialRoles, targetSubtitle } from '@/lib/app-assignments';
import { coreProblemMessage } from '@/lib/core-problems';
import { listStatus } from '@/lib/list-status';
import { useNotify } from '@/lib/ui/use-notify';

/**
 * "Ekle" (Entra: Add user/group): a Group or a person, then the roles. Each chosen role is
 * assigned in turn; the ones core refuses are said here.
 */
export function AddAssignmentDrawer({
  app,
  open,
  onClose,
  onAssigned,
}: {
  app: AppSummary;
  open: boolean;
  onClose: () => void;
  onAssigned: () => Promise<void> | void;
}) {
  const notify = useNotify();
  const [targetType, setTargetType] = useState<AppTargetType>('group');
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<AppTarget | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(open);
  // Each opening starts on Grup with nothing picked
  if (open !== opened) {
    setOpened(open);
    if (open) {
      setTargetType('group');
      setQuery('');
      setTarget(null);
      setRoles([]);
      setError(null);
    }
  }

  const searching = open && !target;
  const groupSearch = usePickerSearch(
    searching && targetType === 'group',
    query,
    (q) => appsApi.targets(app.clientId, 'group', q),
    0,
  );
  const userSearch = usePickerSearch(
    searching && targetType === 'user',
    query,
    (q) => appsApi.targets(app.clientId, 'user', q),
    MEMBER_CANDIDATE_MIN,
  );
  const search = targetType === 'group' ? groupSearch : userSearch;

  function pick(next: AppTarget) {
    setTarget(next);
    setRoles(initialRoles(app.suggestedRoles, next));
    setError(null);
  }

  async function assign() {
    if (!target || roles.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    const failures: string[] = [];
    let done = 0;
    for (const role of roles) {
      try {
        await appsApi.assign(app.clientId, { type: target.type, id: target.id, role });
        done += 1;
      } catch (err) {
        failures.push(`${role}: ${coreProblemMessage(err, 'Atanamadı')}`);
      }
    }
    setSaving(false);
    if (done > 0) notify.success(done === 1 ? 'Atandı' : `${done} rol atandı`);
    if (failures.length > 0) setError(failures.join(' '));
    else onClose();
    await onAssigned();
  }

  return (
    <Drawer
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      title="Ekle"
    >
      <Tabs
        value={targetType}
        onValueChange={(value) => {
          setTargetType(value as AppTargetType);
          setQuery('');
          setTarget(null);
        }}
      >
        <TabsList>
          <Tab value="group">Grup</Tab>
          <Tab value="user">Kişi</Tab>
        </TabsList>
      </Tabs>
      {targetType === 'user' ? (
        <p className="text-subtle-foreground text-[13px]/5">{PERSON_ASSIGNMENT_HINT}</p>
      ) : null}
      {target ? (
        <div className="space-y-3">
          <ListItem
            title={target.name || target.path || target.id}
            subtitle={targetSubtitle(target)}
            trailing={
              <ActionButton
                icon={X}
                label="Seçimi kaldır"
                disabled={saving}
                onClick={() => setTarget(null)}
              />
            }
          />
          <fieldset className="space-y-2">
            <legend>
              <FieldLabel>Rol</FieldLabel>
            </legend>
            {app.roles.map((role) => {
              const held = target.assignedRoles.includes(role);
              return (
                <label key={role} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    disabled={saving || held}
                    checked={held || roles.includes(role)}
                    onChange={(event) =>
                      setRoles((current) =>
                        event.target.checked
                          ? [...current, role]
                          : current.filter((row) => row !== role),
                      )
                    }
                  />
                  <span>{held ? `${role} (atanmış)` : role}</span>
                </label>
              );
            })}
          </fieldset>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <SaveButton
            type="button"
            disabled={saving || roles.length === 0}
            onClick={() => void assign()}
          >
            {saving ? 'Atanıyor…' : 'Ata'}
          </SaveButton>
        </div>
      ) : (
        <>
          <Field
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              targetType === 'group' ? 'Ekip, alt ekip ya da yol' : 'Ad veya tam e-posta'
            }
            aria-label={targetType === 'group' ? 'Grup ara' : 'Kişi ara'}
          />
          <ListPanel
            status={listStatus({
              loading: search.loading,
              failed: search.failed,
              rowCount: search.people.length,
              emptyMessage:
                targetType === 'user' && !search.ready
                  ? MEMBER_CANDIDATE_HINT
                  : targetType === 'group'
                    ? 'Grup yok'
                    : 'Kullanıcı yok',
            })}
          >
            {search.people.map((option) => (
              <ListItem
                key={option.id}
                title={option.name || option.path || option.id}
                subtitle={targetSubtitle(option)}
                onSelect={() => pick(option)}
              />
            ))}
          </ListPanel>
        </>
      )}
    </Drawer>
  );
}
