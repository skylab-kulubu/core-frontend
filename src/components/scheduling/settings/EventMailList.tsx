'use client';

import { Button, Switch, cn } from '@skylab-kulubu/skylcn-ui';
import { ArrowRight, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Drawer } from '@/components/chrome/Drawer';
import { ObjectCard } from '@/components/chrome/object-page/ObjectPage';
import { SettingsSaveBar } from '@/components/chrome/SettingsPage';
import {
  ATTENDANCE_MAILS,
  AttendeeNoteField,
  EventFeedbackFormFields,
  FEEDBACK_MODES,
  MAIL_OFF_HINT,
  type EventFormState,
} from '@/components/scheduling/EventEditor';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { useEventCard, type CardFields } from '@/components/scheduling/settings/EventSettingsCard';
import { publicShortUrl } from '@/lib/api/urls';
import { AUTO_SEND_LABEL } from '@/lib/certificate-rule';
import { coreProblemMessage } from '@/lib/core-problems';
import {
  EVENT_CARDS,
  eventRegistrationSettingsHref,
  eventTabHref,
  withCard,
} from '@/lib/event-workspace';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { useNotify } from '@/lib/ui/use-notify';
import { useAttendanceMailOn } from '@/lib/use-app-can';

/** A switch a mail row saves at once, with Geri al on the toast. */
type MailSwitchKey = 'attendanceWelcomeMail' | 'attendanceRecordedMail' | 'feedbackAutoSend';

const linkClass = `text-skylab-300 hover:text-foreground inline-flex items-center gap-1 ${TEXT_SECONDARY}`;

/** One automatic mail: its name, when it goes, what it carries, and its switch or its home. */
function MailRow({
  id,
  title,
  hint,
  children,
  action,
  toggle,
  error,
}: {
  id?: string;
  title: string;
  hint: string;
  children?: ReactNode;
  /** Düzenle, or the link to where the mail's setting lives. */
  action?: ReactNode;
  toggle?: { checked: boolean; disabled: boolean; onChange: (next: boolean) => void };
  error?: string | null;
}) {
  return (
    <li
      id={id}
      aria-label={title}
      className="border-border flex scroll-mt-28 flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-start sm:gap-3 md:scroll-mt-16"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-foreground text-sm font-medium">{title}</p>
        <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>{hint}</p>
        {children}
        {error ? (
          <p role="alert" className={`text-destructive ${TEXT_SECONDARY}`}>
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {action}
        {toggle ? (
          <Switch
            aria-label={title}
            checked={toggle.checked}
            disabled={toggle.disabled}
            onCheckedChange={(next) => toggle.onChange(next)}
          />
        ) : null}
      </div>
    </li>
  );
}

/** A mail's content in a drawer, saved by its own Kaydet (a card of its own). */
function MailDrawer({
  id,
  title,
  fields,
  open,
  onClose,
  children,
}: {
  id: string;
  title: string;
  fields: CardFields;
  open: boolean;
  onClose: () => void;
  children: (fields: ReturnType<typeof useEventCard>['fields']) => ReactNode;
}) {
  const card = useEventCard(id, fields);
  const close = () => {
    card.discard();
    onClose();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await card.save()) onClose();
  };
  return (
    <Drawer open={open} onClose={close} title={title} dirty={card.dirty}>
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
        {children(card.fields)}
        <SettingsSaveBar
          visible={card.dirty || card.saving || Boolean(card.error)}
          saving={card.saving}
          canSave={card.dirty}
          error={card.error}
          onDiscard={card.discard}
        />
      </form>
      {card.dialog}
    </Drawer>
  );
}

function EditButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" aria-label={name} onClick={onClick}>
      <Pencil aria-hidden />
      <span className="max-sm:sr-only">Düzenle</span>
    </Button>
  );
}

/** Where the feedback form is, as a short line under its row. */
function feedbackLine(base: EventFormState): string {
  const mode = FEEDBACK_MODES.find((row) => row.value === (base.feedbackMode ?? 'event'))?.label;
  const slot = base.feedbackSlot;
  const form = slot?.alias
    ? publicShortUrl(slot.alias).replace(/^https?:\/\//, '')
    : slot?.url
      ? 'Form bağlı'
      : 'Form yok';
  return [mode, form].filter(Boolean).join(' · ');
}

/**
 * Postalar: every mail the event sends by itself, in one list. A switch saves at once and offers
 * Geri al; a mail's content opens in a drawer with its own Kaydet. The ticket and certificate
 * mails are set where their work is: their rows say so and link there.
 */
export function EventMailList() {
  const { event, editor } = useEventWorkspace();
  const notify = useNotify();
  const mailOn = useAttendanceMailOn();
  // The latest saved event, for a Geri al pressed after the page moved on
  const latest = useRef(editor);
  latest.current = editor;
  const [busy, setBusy] = useState<MailSwitchKey | null>(null);
  const [failed, setFailed] = useState<{ key: MailSwitchKey; message: string } | null>(null);
  const landing = typeof window === 'undefined' ? '' : window.location.hash.slice(1);
  const [editing, setEditing] = useState<'welcome' | 'feedback' | null>(
    landing === EVENT_CARDS.feedback ? 'feedback' : null,
  );
  const base = editor.base as EventFormState;

  async function toggle(key: MailSwitchKey, label: string, next: boolean) {
    setBusy(key);
    setFailed(null);
    const write = (value: boolean) => {
      const now = latest.current;
      return now.save({ ...(now.base as EventFormState), [key]: value });
    };
    try {
      await write(next);
      notify.undoable(
        `${label} ${next ? 'açıldı' : 'kapatıldı'}`,
        () => write(!next),
        `${label} ${next ? 'kapatıldı' : 'açıldı'}`,
      );
    } catch (err) {
      setFailed({ key, message: coreProblemMessage(err, 'Kaydedilemedi') });
    } finally {
      setBusy(null);
    }
  }

  const problem = (key: MailSwitchKey) => (failed?.key === key ? failed.message : null);
  const ruleOn = (event.attendanceRule ?? 'none') !== 'none';

  return (
    <ObjectCard title="Otomatik postalar" className="max-w-3xl gap-4 sm:p-5">
      <ul className="flex flex-col gap-2">
        <MailRow
          title="Bilet postası"
          hint="Bilet yazılınca gider; bilet duyurusu bu postada görünür."
          action={
            <Link
              href={withCard(eventRegistrationSettingsHref(event.id), EVENT_CARDS.ticket)}
              className={linkClass}
            >
              Kayıt ayarları
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        >
          {base.formResponsesAutoTicket !== undefined ? (
            <p className={`text-secondary-foreground ${TEXT_SECONDARY}`}>
              Otomatik bilet gönder: {base.formResponsesAutoTicket ? 'açık' : 'kapalı'}
            </p>
          ) : null}
        </MailRow>
        {/* An older core sends no switches: the door's mails are not offered */}
        {base.attendanceWelcomeMail !== undefined
          ? ATTENDANCE_MAILS.map((mail) => {
              const on = mailOn[mail.feature];
              const welcome = mail.key === 'attendanceWelcomeMail';
              return (
                <MailRow
                  key={mail.key}
                  title={mail.label}
                  hint={on ? mail.hint : MAIL_OFF_HINT}
                  toggle={{
                    checked: on && (base[mail.key] ?? true),
                    disabled: !on || busy !== null,
                    onChange: (next) => void toggle(mail.key, mail.label, next),
                  }}
                  error={problem(mail.key)}
                  action={
                    welcome && base.attendeeNote !== undefined ? (
                      <EditButton
                        name="Hoş geldin postasını düzenle"
                        onClick={() => setEditing('welcome')}
                      />
                    ) : undefined
                  }
                >
                  {welcome && base.attendeeNote ? (
                    <p className={cn('text-secondary-foreground line-clamp-2', TEXT_SECONDARY)}>
                      Katılımcı notu: {base.attendeeNote}
                    </p>
                  ) : null}
                </MailRow>
              );
            })
          : null}
        <MailRow
          id={EVENT_CARDS.feedback}
          title="Geri bildirim postası"
          hint="Bitişten 2 saat sonra katılanlara e-postayla gider."
          toggle={{
            checked: base.feedbackAutoSend ?? true,
            disabled: busy !== null,
            onChange: (next) => void toggle('feedbackAutoSend', 'Geri bildirim postası', next),
          }}
          error={problem('feedbackAutoSend')}
          action={
            <EditButton
              name="Geri bildirim postasını düzenle"
              onClick={() => setEditing('feedback')}
            />
          }
        >
          <p className={`text-secondary-foreground ${TEXT_SECONDARY}`}>{feedbackLine(base)}</p>
        </MailRow>
        <MailRow
          title="Sertifika postası"
          hint="Sertifika verilince gider."
          action={
            <Link href={eventTabHref(event.id, 'certificates')} className={linkClass}>
              Sertifikalar
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        >
          <p className={`text-secondary-foreground ${TEXT_SECONDARY}`}>
            {ruleOn
              ? `${AUTO_SEND_LABEL}: ${event.attendanceAutoFinalize ? 'açık' : 'kapalı'}`
              : 'Sertifika kuralı yok'}
          </p>
        </MailRow>
      </ul>
      {base.attendeeNote !== undefined ? (
        <MailDrawer
          id="hos-geldin-postasi"
          title="Hoş geldin postası"
          fields={['attendeeNote']}
          open={editing === 'welcome'}
          onClose={() => setEditing(null)}
        >
          {(fields) => (
            <>
              <AttendeeNoteField {...fields} />
              <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
                Yalnız hoş geldin postasında görünür.
              </p>
            </>
          )}
        </MailDrawer>
      ) : null}
      <MailDrawer
        id="geri-bildirim-postasi"
        title="Geri bildirim postası"
        fields={['feedbackMode', 'feedbackSlot']}
        open={editing === 'feedback'}
        onClose={() => setEditing(null)}
      >
        {(fields) => (
          <EventFeedbackFormFields
            {...fields}
            returnTo={typeof window !== 'undefined' ? window.location.href : ''}
            formInUse={editor.inUse}
          />
        )}
      </MailDrawer>
    </ObjectCard>
  );
}
