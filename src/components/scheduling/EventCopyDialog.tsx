'use client';

import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useSkylcn,
} from '@skylab-kulubu/skylcn-ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { Select } from '@/components/chrome/Select';
import { DatePicker } from '@/components/forms/DatePicker';
import { CheckboxRow } from '@/components/scheduling/use-event-status-actions';
import { eventsApi, type CoreEvent, type EventCopy } from '@/lib/api/events';
import { teamsApi } from '@/lib/api/teams';
import { useCapabilities } from '@/lib/capabilities-context';
import { coreProblemMessage } from '@/lib/core-problems';
import { formatDatetimeLabel } from '@/lib/date-picker';
import { toRfc3339 } from '@/lib/datetime-local';
import {
  canCopyDoorStaff,
  canCopyEvent,
  copyEnd,
  copyName,
  copyTargetTeams,
  defaultCopyStart,
  rememberCopySkipped,
} from '@/lib/event-copy';
import { useNotify } from '@/lib/ui/use-notify';

type EventCopyDialogProps = {
  source: CoreEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopied: (copy: EventCopy) => void;
  /** The copy's id; made once when the dialog opens, so a retry lands on the same copy. */
  copyId: string;
};

/**
 * "Etkinliği kopyala" (SPEC §5.4): the copy's name, start and Owner team,
 * and the door staff and Competitions when there are any. Which teams and
 * boxes it offers is core's capabilities; core decides the copy.
 */
export function EventCopyDialog({
  source,
  open,
  onOpenChange,
  onCopied,
  copyId,
}: EventCopyDialogProps) {
  const { messages } = useSkylcn();
  const capabilities = useCapabilities();
  const [name, setName] = useState(() => copyName(source.name));
  const [start, setStart] = useState(() => defaultCopyStart(source.startDate));
  const [team, setTeam] = useState(source.ownerTeam);
  const [allTeams, setAllTeams] = useState<string[]>([]);
  const [competitionCount, setCompetitionCount] = useState(0);
  const [withDoorStaff, setWithDoorStaff] = useState(false);
  const [withCompetitions, setWithCompetitions] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A second click before the first answer is the same request
  const running = useRef(false);

  const otherTeamsCreate =
    capabilities.status === 'ready' && Boolean(capabilities.data.otherTeams?.can?.['event.create']);

  useEffect(() => {
    let cancelled = false;
    void eventsApi
      .listCompetitions(source.id)
      .then((rows) => {
        if (!cancelled) setCompetitionCount(rows.length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [source.id]);

  useEffect(() => {
    if (!otherTeamsCreate) return;
    let cancelled = false;
    void teamsApi
      .list()
      .then((rows) => {
        if (!cancelled) setAllTeams(rows.map((row) => row.team));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [otherTeamsCreate]);

  const targets = copyTargetTeams(capabilities, source.ownerTeam, allTeams);
  const target = targets.includes(team) ? team : (targets[0] ?? source.ownerTeam);
  const doorStaffCount = source.doorStaffIds?.length ?? 0;
  const offersDoorStaff = doorStaffCount > 0 && canCopyDoorStaff(capabilities, target);
  const end = copyEnd(source, start);

  async function submit() {
    if (running.current) return;
    const startDate = toRfc3339(start);
    if (!name.trim() || !startDate) {
      setError('Ad ve başlangıç gerekli.');
      return;
    }
    running.current = true;
    setPending(true);
    setError(null);
    try {
      const copy = await eventsApi.copy(source.id, {
        id: copyId,
        name: name.trim(),
        startDate,
        includeDoorStaff: offersDoorStaff && withDoorStaff,
        includeCompetitions: competitionCount > 0 && withCompetitions,
        ...(target !== source.ownerTeam ? { ownerTeam: target } : {}),
      });
      onOpenChange(false);
      onCopied(copy);
    } catch (err) {
      setError(
        coreProblemMessage(err, 'Etkinlik kopyalanamadı', {
          403: 'Bu ekipte etkinlik oluşturma yetkin yok.',
          404: 'Kaynak etkinlik bulunamadı; silinmiş olabilir.',
          409: 'Bu kopya başka bir ekipte açılmış. Diyaloğu kapatıp yeniden aç.',
        }),
      );
    } finally {
      running.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <DialogHeader className="pr-5">
            <DialogTitle>Etkinliği kopyala</DialogTitle>
            {error ? (
              <p
                role="alert"
                className="border-destructive/30 bg-destructive/10 text-destructive mt-3 rounded-md border px-3 py-2 text-xs"
              >
                {error}
              </p>
            ) : null}
          </DialogHeader>
          <DialogBody className="space-y-3 pt-0">
            <label className="block space-y-1">
              <FieldLabel>Ad</FieldLabel>
              <Field value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="block space-y-1">
              <FieldLabel>Başlangıç</FieldLabel>
              <DatePicker value={start} onChange={setStart} aria-label="Başlangıç" />
            </label>
            {end ? (
              <p className="text-2xs text-subtle-foreground">Bitiş: {formatDatetimeLabel(end)}</p>
            ) : null}
            {targets.length > 1 || (targets.length === 1 && targets[0] !== source.ownerTeam) ? (
              <label className="block space-y-1">
                <FieldLabel>Ekip</FieldLabel>
                <Select value={target} onChange={(e) => setTeam(e.target.value)}>
                  {targets.map((row) => (
                    <option key={row || 'none'} value={row}>
                      {row || 'Yok'}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}
            {offersDoorStaff ? (
              <CheckboxRow
                label={`Kapı görevlilerini de kopyala (${doorStaffCount} kişi)`}
                defaultChecked={false}
                onChange={setWithDoorStaff}
              />
            ) : null}
            {competitionCount > 0 ? (
              <CheckboxRow
                label={`Yarışmaları da kopyala (${competitionCount} yarışma)`}
                defaultChecked={false}
                onChange={setWithCompetitions}
              />
            ) : null}
          </DialogBody>
          <DialogFooter className="mt-4">
            <DialogClose render={<Button type="button" disabled={pending} />}>
              {messages.cancel}
            </DialogClose>
            <Button type="submit" variant="primary" pending={pending}>
              Kopyala
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Kopyala…" for the list's row menu and the Event's "⋯" menu: `canCopy`
 * from core's capabilities, `askCopy` opens the dialog with a new copy id,
 * and a copy opens its page, where the parts core left out are said once.
 * Render `dialog` once.
 */
export function useEventCopy() {
  const router = useRouter();
  const notify = useNotify();
  const capabilities = useCapabilities();
  const [request, setRequest] = useState<{ source: CoreEvent; id: string } | null>(null);
  const [open, setOpen] = useState(false);

  const canCopy = (event: Pick<CoreEvent, 'ownerTeam'>) =>
    canCopyEvent(capabilities, event.ownerTeam);

  function askCopy(source: CoreEvent) {
    setRequest({ source, id: crypto.randomUUID() });
    setOpen(true);
  }

  const dialog = request ? (
    <EventCopyDialog
      // A new copy id and fresh fields each time the dialog opens
      key={request.id}
      source={request.source}
      copyId={request.id}
      open={open}
      onOpenChange={setOpen}
      onCopied={(copy) => {
        if (typeof window !== 'undefined') {
          rememberCopySkipped(window.sessionStorage, copy.event.id, copy.skipped ?? []);
        }
        notify.success('Etkinlik kopyalandı');
        router.push(`/events/${encodeURIComponent(copy.event.id)}`);
      }}
    />
  ) : null;

  return { canCopy, askCopy, dialog };
}
