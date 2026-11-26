'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, FileBadge, FileText, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { SaveButton } from '@/components/chrome/SaveButton';
import { SidePanel } from '@/components/chrome/SidePanel';
import { TemplateThumbBox } from '@/components/certificates/TemplateThumb';
import {
  certificatesApi,
  type CertificateTemplateChoice,
  type EventCertificateTemplateState,
  type ResolvedCertificateTemplate,
} from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';
import { coreProblemMessage } from '@/lib/core-problems';
import { eventCertificateTemplateHref } from '@/lib/event-workspace';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { useNotify } from '@/lib/ui/use-notify';

/**
 * The Event's template as its settings show it. `legacy`: an older core
 * without Event templates (404): only the resolved template is known, and
 * nothing here creates or edits one.
 */
export type EventTemplateView = EventCertificateTemplateState & { legacy: boolean };

type Loaded =
  | { status: 'loading' }
  | { status: 'ready'; view: EventTemplateView }
  | { status: 'failed'; error: string };

/** GET /v1/events/{id}/certificate-template, or on an older core (404) the resolved template alone. */
export function useEventTemplateState(
  eventId: string,
  enabled = true,
): Loaded & { reload: () => Promise<void> } {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });

  const read = useCallback(async (): Promise<Loaded> => {
    try {
      const state = await certificatesApi.eventTemplate(eventId);
      return { status: 'ready', view: { ...state, legacy: false } };
    } catch (cause) {
      if (!(cause instanceof ProblemError) || cause.status !== 404) {
        return { status: 'failed', error: coreProblemMessage(cause, 'Şablon bilgisi okunamadı') };
      }
    }
    // An older core: the template a certificate takes now is all there is to show
    const resolution = await certificatesApi.resolve(eventId).catch(() => null);
    return {
      status: 'ready',
      view: { resolution, eventTemplate: null, choices: [], legacy: true },
    };
  }, [eventId]);

  const reload = useCallback(async () => {
    setLoaded(await read());
  }, [read]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void read().then((next) => {
      if (!cancelled) setLoaded(next);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, read]);

  return { ...loaded, reload };
}

const CLUB_TEAMS = new Set(['', 'YK', 'DK', 'ADMIN']);

/** "GECEKODU ekip şablonu", "SKY LAB varsayılanı", "Kulüp şablonu". */
function templateKind(template: { ownerTeam: string; system: boolean }): string {
  if (template.system) return 'SKY LAB varsayılanı';
  if (CLUB_TEAMS.has(template.ownerTeam)) return 'Kulüp şablonu';
  return `${template.ownerTeam} ekip şablonu`;
}

/** The source line under the name: "Etkinliğe özel · v3", "GECEKODU ekip şablonu · v2". */
export function templateSourceLine(view: EventTemplateView): string {
  const resolution = view.resolution;
  if (!resolution) return 'Şablon yok';
  const own = view.eventTemplate && resolution.template.id === view.eventTemplate.id;
  const kind = own ? 'Etkinliğe özel' : templateKind(resolution.template);
  return `${kind} · v${resolution.version.version}`;
}

/** "SKY LAB varsayılan şablonuyla", "Kulüp şablonuyla", "GECEKODU ekip şablonuyla". */
function templateWith(template: { ownerTeam: string; system: boolean }): string {
  if (template.system) return 'SKY LAB varsayılan şablonuyla';
  if (CLUB_TEAMS.has(template.ownerTeam)) return 'Kulüp şablonuyla';
  return `${template.ownerTeam} ekip şablonuyla`;
}

/**
 * Said while "Sertifikaları otomatik gönder" is on and certificates would not take the Event's
 * own published template: "SKY LAB varsayılan şablonuyla basılacak". An older core (no Event
 * templates) knows only the resolution's source.
 */
export function autoSendTemplateWarning(view: EventTemplateView | null | undefined): string | null {
  const resolution = view?.resolution;
  if (!view || !resolution) return null;
  const own = view.legacy
    ? resolution.source === 'event'
    : Boolean(view.eventTemplate && resolution.template.id === view.eventTemplate.id);
  return own ? null : `${templateWith(resolution.template)} basılacak`;
}

/** Said while the Event's own template is a draft: what certificates take meanwhile. */
export function draftLine(view: EventTemplateView): string | null {
  if (!view.eventTemplate || view.eventTemplate.publishedVersion) return null;
  const inUse = view.resolution ? templateKind(view.resolution.template) : null;
  return inUse
    ? `Taslak · yayınlanmadı; sertifikalar şu an ${inUse}yla üretilir`
    : 'Taslak · yayınlanmadı';
}

async function openEventPreview(eventId: string, onError: (message: string) => void) {
  try {
    const blob = await certificatesApi.previewEvent(eventId);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (cause) {
    onError(coreProblemMessage(cause, 'Önizleme üretilemedi'));
  }
}

/**
 * Makes the Event's own template (a copy of the one in use) and opens its
 * editor; an Event that has one already (409 `template_event_exists`) opens that.
 */
export async function createEventTemplate(
  eventId: string,
  go: (href: string) => void,
): Promise<string | null> {
  try {
    await certificatesApi.createEventTemplate(eventId, 'current');
  } catch (cause) {
    if (!(cause instanceof ProblemError && cause.code === 'template_event_exists')) {
      return coreProblemMessage(cause, 'Şablon oluşturulamadı');
    }
  }
  go(eventCertificateTemplateHref(eventId));
  return null;
}

/**
 * The template row of an Event's certificate settings (edit page, Sertifikalar
 * tab): its picture, name and source, and Düzenle or Etkinliğe özel şablon
 * oluştur, Ekip şablonlarından seç, Örnek PDF.
 */
export function EventTemplateRow({
  eventId,
  view,
  canEdit,
  canPick,
  from,
  leave,
  onPick,
}: {
  eventId: string;
  view: EventTemplateView;
  /** Who may create and edit the Event's own template: who edits the Event, or the template rule. */
  canEdit: boolean;
  /** Who may choose a team template for it. */
  canPick: boolean;
  /** Where the editor's back link returns: the Sertifikalar tab, else the edit page. */
  from?: 'certificates';
  /** Leaves for the editor; the edit page asks first when a change is unsaved. */
  leave?: (href: string) => void;
  onPick: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const editorHref = `${eventCertificateTemplateHref(eventId)}${from ? `?from=${from}` : ''}`;
  const go = leave ?? ((href: string) => router.push(href));
  const resolution = view.resolution;
  const layout = resolution?.version.layout ?? resolution?.template.draftLayout;
  const draft = draftLine(view);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {layout ? (
          <TemplateThumbBox layout={layout} className="h-14 w-20 shrink-0" />
        ) : (
          <span className="bg-muted grid h-14 w-20 shrink-0 place-items-center rounded-md">
            <FileText className="text-subtle-foreground size-5" aria-hidden />
          </span>
        )}
        <span className="min-w-0">
          <span className="text-foreground block truncate text-sm">
            {resolution?.template.name ?? 'Şablon yok'}
          </span>
          <span className={`text-subtle-foreground block ${TEXT_SECONDARY}`}>
            {templateSourceLine(view)}
          </span>
        </span>
      </div>
      {draft ? <p className={`text-warning ${TEXT_SECONDARY}`}>{draft}</p> : null}
      {error ? (
        <p role="alert" className={`text-destructive ${TEXT_SECONDARY}`}>
          {error}
        </p>
      ) : null}
      <CommandBar label="Şablon eylemleri">
        {!view.legacy && canEdit && view.eventTemplate ? (
          <Command icon={Pencil} label="Düzenle" href={editorHref} />
        ) : null}
        {!view.legacy && canEdit && !view.eventTemplate ? (
          <Command
            icon={Plus}
            label="Etkinliğe özel şablon oluştur"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const failed = await createEventTemplate(eventId, () => go(editorHref));
              setError(failed ?? undefined);
              setBusy(false);
            }}
          />
        ) : null}
        {!view.legacy && canPick ? (
          <Command icon={FileBadge} label="Ekip şablonlarından seç" onClick={onPick} />
        ) : null}
        <Command
          icon={Eye}
          label="Örnek PDF"
          onClick={() => void openEventPreview(eventId, setError)}
        />
      </CommandBar>
    </div>
  );
}

/**
 * Which template the Event takes: a published team or club template, or its
 * own once published ("Etkinliğe özel"); "Varsayılana dön" clears the Event's
 * binding. The edit page and the Sertifikalar tab share it.
 */
export function TemplateBindingDialog({
  open,
  onClose,
  eventId,
  choices,
  eventTemplate,
  resolution,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  choices: readonly CertificateTemplateChoice[];
  eventTemplate: EventCertificateTemplateState['eventTemplate'];
  resolution: ResolvedCertificateTemplate | null;
  /** A choice was saved; `line` is what to say. */
  onDone: (line: string) => void;
}) {
  const [templateId, setTemplateId] = useState(resolution?.template.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const notify = useNotify();

  useEffect(() => {
    if (open) {
      setTemplateId(resolution?.template.id ?? '');
      setError(undefined);
    }
  }, [open, resolution?.template.id]);

  const rows = [
    ...(eventTemplate?.publishedVersion
      ? [
          {
            id: eventTemplate.id,
            name: eventTemplate.name,
            line: `Etkinliğe özel · v${eventTemplate.publishedVersion}`,
          },
        ]
      : []),
    ...choices.map((choice) => ({
      id: choice.id,
      name: choice.name,
      line: `${templateKind(choice)} · v${choice.version}`,
    })),
  ];

  async function run(write: () => Promise<unknown>, line: string, failure: string) {
    setBusy(true);
    try {
      await write();
      notify.success(line);
      onDone(line);
      onClose();
    } catch (cause) {
      setError(coreProblemMessage(cause, failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SidePanel open={open} title="Sertifika şablonu" onClose={onClose}>
      <fieldset className="space-y-2">
        <legend className="sr-only">Yayınlanmış şablon</legend>
        {rows.length === 0 ? (
          <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Yayınlanmış şablon yok.</p>
        ) : null}
        {rows.map((row) => (
          <label
            key={row.id}
            className="border-border-subtle has-[:checked]:border-skylab-600/60 flex cursor-pointer items-center gap-3 rounded-md border p-2"
          >
            <input
              type="radio"
              name="event-template"
              checked={templateId === row.id}
              onChange={() => setTemplateId(row.id)}
              className="accent-skylab-400"
            />
            <span className="min-w-0">
              <span className="text-foreground block truncate text-sm">{row.name}</span>
              <span className={`text-subtle-foreground block ${TEXT_SECONDARY}`}>{row.line}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <CommandBar label="Şablon komutları">
        <SaveButton
          type="button"
          disabled={busy || !templateId}
          onClick={() =>
            void run(
              () => certificatesApi.setBinding({ scope: 'event', scopeKey: eventId, templateId }),
              'Etkinliğin şablonu seçildi',
              'Şablon seçilemedi',
            )
          }
        >
          Etkinliğe uygula
        </SaveButton>
        {resolution?.source === 'event' ? (
          <Command
            icon={RotateCcw}
            label="Varsayılana dön"
            disabled={busy}
            onClick={() =>
              void run(
                () => certificatesApi.clearBinding('event', eventId),
                'Etkinlik ekibin şablonuna döndü',
                'Seçim kaldırılamadı',
              )
            }
          />
        ) : null}
      </CommandBar>
    </SidePanel>
  );
}
