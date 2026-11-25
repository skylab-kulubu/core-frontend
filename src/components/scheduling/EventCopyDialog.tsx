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
import { ProblemError } from '@/lib/api/core';
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
import { BUTTON_TEXT } from '@/lib/ui/type-scale';

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
 * and the door staff, Competitions, external registration link and attendee
 * note when there are any. Which teams and
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
  const [withExternalRegistration, setWithExternalRegistration] = useState(true);
  const [withAttendeeNote, setWithAttendeeNote] = useState(true);
  const [withCoOrganizerPeople, setWithCoOrganizerPeople] = useState(false);
  const [withCertificateTemplate, setWithCertificateTemplate] = useState(true);
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

  const targets = copyTargetTeams(capabilities, source.ownerTeam, allTeams, source.viewer);
  const target = targets.includes(team) ? team : (targets[0] ?? source.ownerTeam);
  const doorStaffCount = source.doorStaffIds?.length ?? 0;
  const offersDoorStaff = doorStaffCount > 0 && canCopyDoorStaff(capabilities, target);
  const end = copyEnd(source, start);
  const offersExternalRegistration = Boolean(source.externalRegistrationUrl);
  const offersAttendeeNote = Boolean(source.attendeeNote);
  // Only who may change the list carries its people (core docs/co-organizers.md, Copy)
  const coOrganizerPeopleCount = source.coOrganizerIds?.length ?? 0;
  const offersCoOrganizerPeople =
    coOrganizerPeopleCount > 0 && Boolean(source.viewer?.can['event.manageOrganizers']);

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
        includeExternalRegistration: offersExternalRegistration && withExternalRegistration,
        includeAttendeeNote: offersAttendeeNote && withAttendeeNote,
        ...(offersCoOrganizerPeople ? { includeCoOrganizerPeople: withCoOrganizerPeople } : {}),
        includeCertificateTemplate: withCertificateTemplate,
        ...(target !== source.ownerTeam ? { ownerTeam: target } : {}),
      });
      onOpenChange(false);
      onCopied(copy);
    } catch (err) {
      setError(
        // The Co-organizers it carries are recorded first: without the record, no copy
        err instanceof ProblemError && err.code === 'audit_unavailable'
          ? 'Kayıt açılamadı; kopya oluşturulmadı. Biraz sonra tekrar dene.'
          : coreProblemMessage(err, 'Etkinlik kopyalanamadı', {
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
                className="border-destructive/30 bg-destructive/10 text-destructive mt-3 rounded-md border px-3 py-2 text-[13px]/5"
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
            <DatePicker label="Başlangıç" value={start} onChange={setStart} />
            {end ? (
              <p className="text-subtle-foreground text-[13px]/5">
                Bitiş: {formatDatetimeLabel(end)}
              </p>
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
                // The box goes with a team that may not assign them: back, it shows what is sent
                defaultChecked={withDoorStaff}
                onChange={setWithDoorStaff}
              />
            ) : null}
            {competitionCount > 0 ? (
              <CheckboxRow
                label={`Yarışmaları da kopyala (${competitionCount} yarışma)`}
                defaultChecked={withCompetitions}
                onChange={setWithCompetitions}
              />
            ) : null}
            {offersExternalRegistration ? (
              <CheckboxRow
                label="Dış kayıt bağlantısını da kopyala"
                defaultChecked={withExternalRegistration}
                onChange={setWithExternalRegistration}
              />
            ) : null}
            {offersAttendeeNote ? (
              <CheckboxRow
                label="Katılımcı notunu da kopyala"
                defaultChecked={withAttendeeNote}
                onChange={setWithAttendeeNote}
              />
            ) : null}
            {offersCoOrganizerPeople ? (
              <CheckboxRow
                label={`Ortak kişileri de kopyala (${coOrganizerPeopleCount} kişi)`}
                defaultChecked={withCoOrganizerPeople}
                onChange={setWithCoOrganizerPeople}
              />
            ) : null}
            {/* core copies the template unless told not to (docs/event-copy.md) */}
            <div className="space-y-0.5">
              <CheckboxRow
                label="Sertifika şablonunu da kopyala"
                defaultChecked={withCertificateTemplate}
                onChange={setWithCertificateTemplate}
                describedBy="kopya-sertifika-ipucu"
              />
              <p id="kopya-sertifika-ipucu" className="text-subtle-foreground pl-6 text-[13px]/5">
                Etkinliğe özel şablon kopyalanır.
              </p>
            </div>
          </DialogBody>
          <DialogFooter className="mt-4">
            <DialogClose
              render={<Button className={BUTTON_TEXT} type="button" disabled={pending} />}
            >
              {messages.cancel}
            </DialogClose>
            <Button className={BUTTON_TEXT} type="submit" variant="primary" pending={pending}>
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

  const canCopy = (event: Pick<CoreEvent, 'ownerTeam' | 'viewer'>) =>
    canCopyEvent(capabilities, event.ownerTeam, event.viewer);

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
