'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  MenuGroup,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
} from '@skylab-kulubu/skylcn-ui';
import { Award, CalendarCheck, DoorOpen, Download, Grid3x3, ListFilter, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  exportsApi,
  type ExportFormat,
  type ExportReport,
  type ExportRequest,
} from '@/lib/api/exports';
import { coreProblemMessage } from '@/lib/core-problems';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';
import { useNotify } from '@/lib/ui/use-notify';

const FORMAT_KEY = 'skylab.admin.export.format';

/** The format the reader picked last, on this device. */
function savedFormat(): ExportFormat {
  try {
    return window.localStorage.getItem(FORMAT_KEY) === 'csv' ? 'csv' : 'xlsx';
  } catch {
    return 'xlsx';
  }
}

export type ExportSession = { id: string; label: string };

export type ExportMenuProps = {
  eventId: string;
  eventName: string;
  /** The rows the list shows now, in its order; with `filtered`, "Ekrandakiler" downloads them. */
  shownTicketIds?: readonly string[];
  /** A search or a view narrows the list: "Ekrandakiler" is offered. */
  filtered?: boolean;
  /** The sessions whose attendance can be downloaded. */
  sessions?: readonly ExportSession[];
  /** The reader may read the event's certificates: the Sertifikalar report is offered. */
  certificates?: boolean;
};

const REPORTS: { report: ExportReport; label: string; icon: typeof Users }[] = [
  { report: 'attendees', label: 'Katılımcılar (tüm biletler)', icon: Users },
  { report: 'matrix', label: 'Katılım matrisi (kişi × oturum)', icon: Grid3x3 },
  { report: 'entries', label: 'Alana giriş (gün gün)', icon: DoorOpen },
];

/**
 * İndir: the event's attendee reports as Excel or CSV, made by core (core
 * docs/attendee-export.md), which records each download. A filtered list offers its own rows.
 */
export function ExportMenu({
  eventId,
  eventName,
  shownTicketIds = [],
  filtered = false,
  sessions = [],
  certificates = false,
}: ExportMenuProps) {
  const notify = useNotify();
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setFormat(savedFormat()), []);

  function pickFormat(next: ExportFormat) {
    setFormat(next);
    try {
      window.localStorage.setItem(FORMAT_KEY, next);
    } catch {
      // A blocked storage only forgets the choice
    }
  }

  async function download(request: Omit<ExportRequest, 'format'>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const name = await exportsApi.download(eventId, eventName, { ...request, format });
      notify.success('İndirildi', name);
    } catch (cause) {
      setError(
        coreProblemMessage(cause, 'Dosya hazırlanamadı. Tekrar dene.', {
          403: 'Bu listeyi indirmeye yetkin yok.',
          503: 'Şu an indirilemiyor. Biraz sonra tekrar dene.',
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <p role="alert" className="text-destructive text-[13px]/5">
          {error}
        </p>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button className={BUTTON_TEXT} size="sm" variant="outline" disabled={busy}>
              <Download className="size-4" aria-hidden />
              {busy ? 'Hazırlanıyor…' : 'İndir'}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-64">
          <MenuGroup label="Biçim">
            <MenuRadioGroup
              value={format}
              onValueChange={(value) => pickFormat(value as ExportFormat)}
            >
              <MenuRadioItem value="xlsx">Excel (.xlsx)</MenuRadioItem>
              <MenuRadioItem value="csv">CSV</MenuRadioItem>
            </MenuRadioGroup>
          </MenuGroup>
          <MenuSeparator />
          {filtered && shownTicketIds.length > 0 ? (
            <MenuItem
              icon={ListFilter}
              onClick={() => void download({ report: 'attendees', ticketIds: [...shownTicketIds] })}
            >
              Ekrandakiler ({shownTicketIds.length})
            </MenuItem>
          ) : null}
          {REPORTS.map(({ report, label, icon }) => (
            <MenuItem key={report} icon={icon} onClick={() => void download({ report })}>
              {label}
            </MenuItem>
          ))}
          {sessions.length > 0 ? (
            <MenuSub>
              <MenuSubTrigger icon={CalendarCheck}>Oturum katılımı</MenuSubTrigger>
              <MenuSubContent className="max-h-80 overflow-y-auto">
                {sessions.map((session) => (
                  <MenuItem
                    key={session.id}
                    onClick={() => void download({ report: 'session', sessionId: session.id })}
                  >
                    {session.label}
                  </MenuItem>
                ))}
              </MenuSubContent>
            </MenuSub>
          ) : null}
          {certificates ? (
            <MenuItem icon={Award} onClick={() => void download({ report: 'certificates' })}>
              Sertifikalar
            </MenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * "Katılanları indir" in a session's row menu: the session's attendance in the format picked
 * last. Errors and success as ExportMenu's, through the caller.
 */
export async function downloadSessionAttendance(
  eventId: string,
  eventName: string,
  sessionId: string,
): Promise<string> {
  return exportsApi.download(eventId, eventName, {
    report: 'session',
    sessionId,
    format: savedFormat(),
  });
}

/** "Listeyi indir" on the Sertifikalar tab: the certificate report, in the format picked last. */
export function CertificateListDownload({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const name = await exportsApi.download(eventId, eventName, {
        report: 'certificates',
        format: savedFormat(),
      });
      notify.success('İndirildi', name);
    } catch (cause) {
      setError(coreProblemMessage(cause, 'Liste indirilemedi. Tekrar dene.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <p role="alert" className="text-destructive text-[13px]/5">
          {error}
        </p>
      ) : null}
      <Button
        className={BUTTON_TEXT}
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => void download()}
      >
        <Download className="size-4" aria-hidden />
        {busy ? 'Hazırlanıyor…' : 'Listeyi indir'}
      </Button>
    </div>
  );
}
