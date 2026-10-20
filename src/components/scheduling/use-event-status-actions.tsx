'use client';

import { Checkbox, MenuItem } from '@skylab-kulubu/skylcn-ui';
import { Ban, Link2, RotateCcw, Send, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { TextArea } from '@/components/chrome/TextArea';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { ticketsApi } from '@/lib/api/tickets';
import { publicShortUrl } from '@/lib/api/urls';
import { coreProblemMessage } from '@/lib/core-problems';
import { openEventMail } from '@/lib/event-mail';
import { useCapabilities } from '@/lib/capabilities-context';
import { eventDisplayStatus, eventStatusOf } from '@/lib/events-view';
import { UNDO_HINT, useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';
import { useTeamCan } from '@/lib/use-app-can';

/** The most core takes as a cancellation reason. */
export const CANCEL_REASON_MAX = 500;

/** What the reader may do to the Event's status, from core's capabilities for its Owner team. */
export type EventStatusRights = {
  /** `event.update`: publish, unpublish, cancel, undo it, close applying. */
  canUpdate: boolean;
  /** `event.delete`: delete a draft. */
  canDelete: boolean;
};

/**
 * The status rights core answers for an Event's Owner team
 * (GET /v1/users/me/capabilities): no group or role name is read. Until the
 * answer is in, or when it cannot be read, nothing is offered; core decides
 * every request anyway.
 */
export function useEventStatusRights(): (event: Pick<CoreEvent, 'ownerTeam'>) => EventStatusRights {
  const capabilities = useCapabilities();
  const teamCan = useTeamCan();
  return (event) => {
    const ready = capabilities.status === 'ready';
    return {
      canUpdate: ready && teamCan(event.ownerTeam, 'event.update'),
      canDelete: ready && teamCan(event.ownerTeam, 'event.delete'),
    };
  };
}

/** Which status actions the Event offers now (SPEC §2.3); the rights decide who sees them. */
export function eventStatusActions(event: CoreEvent, now = new Date()) {
  const status = eventStatusOf(event);
  const display = eventDisplayStatus(event, now);
  return {
    publish: status === 'draft',
    unpublish: status === 'published',
    cancel: status === 'published' && display !== 'ended',
    uncancel: status === 'cancelled',
    // core #265 refuses the rest (event_not_draft); until it ships the panel holds the rule
    delete: status === 'draft',
    registration: status !== 'cancelled',
  };
}

function CheckboxRow({
  label,
  defaultChecked,
  onChange,
}: {
  label: string;
  defaultChecked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <label className="text-secondary-foreground flex items-center gap-2 text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => {
          setChecked(next);
          onChange(next);
        }}
      />
      {label}
    </label>
  );
}

function CancelFields({
  holders,
  onReason,
  onNotify,
}: {
  holders: number | null;
  onReason: (reason: string) => void;
  onNotify: (notify: boolean) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <>
      <label className="block space-y-1">
        <FieldLabel>İptal açıklaması (herkese görünür)</FieldLabel>
        <TextArea
          rows={3}
          maxLength={CANCEL_REASON_MAX}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            onReason(e.target.value);
          }}
        />
      </label>
      {holders === 0 ? null : (
        <CheckboxRow
          label={
            holders === null
              ? 'Bilet sahiplerine bildir'
              : `Bilet sahiplerine bildir (${holders} kişi)`
          }
          defaultChecked
          onChange={onNotify}
        />
      )}
    </>
  );
}

/**
 * The Event's status actions (publish, unpublish, cancel, undo the
 * cancellation, delete a draft, close or open applying) with their questions,
 * for the list's row menu and the Event's header. `onChanged` gets the Event
 * core answered; `onError` a refusal of an action asked without a question.
 * Render `dialog` once.
 */
export function useEventStatusActions({
  onChanged,
  onError,
}: {
  onChanged: (event: CoreEvent) => void;
  onError: (message: string) => void;
}) {
  const [confirm, dialog] = useConfirm();
  const notify = useNotify();

  async function run(
    write: () => Promise<CoreEvent>,
    success: string,
    failure: string,
  ): Promise<void> {
    try {
      const saved = await write();
      onChanged(saved);
      notify.success(success);
    } catch (err) {
      onError(coreProblemMessage(err, failure));
    }
  }

  function mailHolders(event: CoreEvent) {
    void openEventMail(
      event.id,
      (eventId) => eventsApi.syncMailList(eventId),
      (href) => {
        window.open(href, '_blank', 'noopener,noreferrer');
      },
    ).catch((err: unknown) => onError(coreProblemMessage(err, 'Skymail listesi yenilenemedi')));
  }

  /** `holders`: the Event's Ticket count when the page has it; else it is read here. */
  async function askCancel(event: CoreEvent, holders?: number) {
    const count =
      holders ??
      (await ticketsApi
        .listByEvent(event.id)
        .then((rows) => rows.length)
        .catch(() => null));
    const fields = { reason: '', notify: count !== 0 };
    confirm({
      title: 'Etkinliği iptal et',
      description: count ? `${count} kayıt var.` : undefined,
      content: (
        <CancelFields
          holders={count}
          onReason={(reason) => {
            fields.reason = reason;
          }}
          onNotify={(next) => {
            fields.notify = next;
          }}
        />
      ),
      actionLabel: 'İptal et',
      failure: 'Etkinlik iptal edilemedi',
      onConfirm: async () => {
        const reason = fields.reason.trim();
        const saved = await eventsApi.cancel(event.id, {
          ...(reason ? { reason } : {}),
          notifyTicketHolders: fields.notify,
        });
        onChanged(saved);
        if (!fields.notify && count !== 0) {
          notify.withAction('Etkinlik iptal edildi', 'Katılımcılara haber ver', () =>
            mailHolders(saved),
          );
        } else {
          notify.success('Etkinlik iptal edildi');
        }
      },
    });
  }

  function askUncancel(event: CoreEvent) {
    const mailed = Boolean(event.cancelNotifiedAt);
    const fields = { notify: mailed };
    confirm({
      title: 'İptali geri al',
      actionLabel: 'Geri al',
      destructive: false,
      content: mailed ? (
        <CheckboxRow
          label="Katılımcılara tekrar bildir"
          defaultChecked
          onChange={(next) => {
            fields.notify = next;
          }}
        />
      ) : undefined,
      failure: 'İptal geri alınamadı',
      onConfirm: async () => {
        const saved = await eventsApi.uncancel(event.id, {
          notifyTicketHolders: mailed && fields.notify,
        });
        onChanged(saved);
        notify.success('İptal geri alındı');
      },
    });
  }

  /** `onDeleted` leaves the deleted Event; `onRestored` follows a Geri al. */
  function askDelete(
    event: CoreEvent,
    { onDeleted, onRestored }: { onDeleted: () => void; onRestored: (event: CoreEvent) => void },
  ) {
    confirm({
      title: `"${event.name}" silinsin mi?`,
      description: `Etkinlik listeden kalkar. ${UNDO_HINT}`,
      actionLabel: 'Etkinliği sil',
      failure: 'Etkinlik silinemedi',
      onConfirm: async () => {
        await eventsApi.delete(event.id);
        notify.undoable(
          'Etkinlik silindi',
          async () => onRestored(await eventsApi.restore(event.id)),
          'Etkinlik geri alındı',
        );
        onDeleted();
      },
    });
  }

  const publish = (event: CoreEvent) =>
    run(() => eventsApi.publish(event.id), 'Etkinlik yayınlandı', 'Etkinlik yayınlanamadı');

  const unpublish = (event: CoreEvent) =>
    run(() => eventsApi.unpublish(event.id), 'Etkinlik taslağa alındı', 'Taslağa alınamadı');

  const setRegistrationClosed = (event: CoreEvent, closed: boolean) =>
    run(
      () => eventsApi.patch(event.id, { registrationClosed: closed }),
      closed ? 'Başvuru kapatıldı' : 'Başvuru açıldı',
      closed ? 'Başvuru kapatılamadı' : 'Başvuru açılamadı',
    );

  async function copyApplyLink(event: CoreEvent) {
    if (!event.formAlias) return;
    try {
      await navigator.clipboard.writeText(publicShortUrl(event.formAlias));
      notify.success('Başvuru linki kopyalandı');
    } catch {
      onError('Başvuru linki kopyalanamadı');
    }
  }

  return {
    dialog,
    publish,
    unpublish,
    askCancel,
    askUncancel,
    askDelete,
    setRegistrationClosed,
    copyApplyLink,
  };
}

export type EventStatusActionsApi = ReturnType<typeof useEventStatusActions>;

/**
 * The list row's "⋯" items (SPEC §5.1): reading items for everyone who sees
 * the Event, status actions only with core's rights. Empty when there is
 * nothing to offer.
 */
export function eventRowMenuItems(
  event: CoreEvent,
  rights: EventStatusRights,
  actions: EventStatusActionsApi,
  { onDeleted, onRestored }: { onDeleted: () => void; onRestored: (event: CoreEvent) => void },
  now = new Date(),
): ReactNode[] {
  const offers = eventStatusActions(event, now);
  const items: ReactNode[] = [];
  // "Herkese açık sayfa" comes here once the site reads Events from core (SPEC §5.1).
  // "Kopyala…" comes with the copy dialog (ticket 10).
  if (event.formAlias) {
    items.push(
      <MenuItem key="link" icon={Link2} onClick={() => void actions.copyApplyLink(event)}>
        Başvuru linkini kopyala
      </MenuItem>,
    );
  }
  if (rights.canUpdate && offers.publish) {
    items.push(
      <MenuItem key="publish" icon={Send} onClick={() => void actions.publish(event)}>
        Yayınla
      </MenuItem>,
    );
  }
  if (rights.canUpdate && offers.cancel) {
    items.push(
      <MenuItem key="cancel" icon={Ban} destructive onClick={() => void actions.askCancel(event)}>
        İptal et…
      </MenuItem>,
    );
  }
  if (rights.canUpdate && offers.uncancel) {
    items.push(
      <MenuItem key="uncancel" icon={RotateCcw} onClick={() => actions.askUncancel(event)}>
        İptali geri al…
      </MenuItem>,
    );
  }
  if (rights.canDelete && offers.delete) {
    items.push(
      <MenuItem
        key="delete"
        icon={Trash2}
        destructive
        onClick={() => actions.askDelete(event, { onDeleted, onRestored })}
      >
        Sil…
      </MenuItem>,
    );
  }
  return items;
}
