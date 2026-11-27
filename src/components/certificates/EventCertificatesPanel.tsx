'use client';

import {
  DataListTitle,
  DescriptionList,
  MenuItem,
  Skeleton,
  type DataListColumn,
} from '@skylab-kulubu/skylcn-ui';
import { DataList } from '@/components/chrome/DataList';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Ban,
  Clock,
  ExternalLink,
  Eye,
  FileBadge,
  Mail,
  RefreshCw,
  RotateCcw,
  ScanSearch,
  Send,
  UserPlus,
} from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { ListItem } from '@/components/chrome/ListItem';
import { ListPanel } from '@/components/chrome/ListPanel';
import { ListPager, RowMenu, SummaryStrip } from '@/components/chrome/ListPage';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Command, CommandBar, CommandMenu } from '@/components/chrome/object-page/CommandBar';
import { ObjectCard } from '@/components/chrome/object-page/ObjectPage';
import { CertificateRuleSheet } from '@/components/certificates/CertificateRuleSheet';
import {
  autoSendTemplateWarning,
  EventTemplateRow,
  TemplateBindingDialog,
  useEventTemplateState,
} from '@/components/certificates/EventTemplateRow';
import { ManualIssueDialog } from '@/components/certificates/ManualIssueDialog';
import { EmptyState } from '@/components/chrome/PageState';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { SaveButton } from '@/components/chrome/SaveButton';
import { StatusChip } from '@/components/chrome/StatusChip';
import { matchesQuery, paginateRows } from '@/lib/list-query';
import { pickerMatch } from '@/lib/picker';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import {
  certificatesApi,
  type CertificateAttendance,
  type CertificateAttendanceRow,
  type CertificateBatch,
  type CertificateRule,
  type CertificateEventSummary,
  type CertificateMailState,
  type CertificateTemplate,
  type IssuedCertificate,
} from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';
import { coreProblemMessage } from '@/lib/core-problems';
import type { EventDay } from '@/lib/api/eventDays';
import {
  ATTENDANCE_STATUS,
  attendanceCloseLine,
  attendedText,
  attendanceViewCounts,
  finalizeCount,
  issuableByHand,
  MAIL_STATUS,
  mailReason,
  mailResendable,
  mailResendLine,
  needsJustification,
  rescanCount,
  searchAttendance,
  viewAttendance,
  type AttendanceView,
} from '@/lib/certificate-attendance';
import { ruleSummaryParts } from '@/lib/certificate-rule';
import type { Ticket } from '@/lib/api/tickets';
import { listStatus } from '@/lib/list-status';
import { DEFAULT_PAGE_SIZE } from '@/lib/ui/page-sizes';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

const WHEN = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});

function when(raw?: string): string {
  if (!raw) return '—';
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? '—' : WHEN.format(at);
}

type IssuedView = 'all' | 'valid' | 'revoked';

/** A mail's state and, under it, when it went or why it waits or failed. */
function mailLine(mail: CertificateMailState): string {
  const detail = mail.status === 'sent' ? when(mail.sentAt) : mailReason(mail);
  return detail ? `${MAIL_STATUS[mail.status].label} · ${detail}` : MAIL_STATUS[mail.status].label;
}

/** A certificate's latest mail as a chip with its detail; a dash for one with no mail kept. */
function MailCell({ mail }: { mail?: CertificateMailState }) {
  if (!mail) return <span className="text-subtle-foreground text-[13px]/5">—</span>;
  const status = MAIL_STATUS[mail.status];
  const detail = mail.status === 'sent' ? when(mail.sentAt) : mailReason(mail);
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5">
      <StatusChip kind={status.kind} label={status.label} />
      {detail ? (
        <span className={`text-subtle-foreground truncate ${TEXT_SECONDARY}`}>{detail}</span>
      ) : null}
    </span>
  );
}

const batchReasonLabel: Record<CertificateBatch['reason'], string> = {
  finalization: 'Katılım kapatma',
  manual: 'Manuel verme',
  reissue: 'Yeniden verme',
  rescan: 'Yeniden tarama',
};

/** Batches with failed jobs, newest first: what "Yeniden dene" can act on. */
export function failedBatches(batches: readonly CertificateBatch[]): CertificateBatch[] {
  return batches
    .filter((batch) => batch.failedCount > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function ticketLabel(ticket: Ticket) {
  if (ticket.owner) return `${ticket.owner.firstName} ${ticket.owner.lastName}`.trim();
  const guest = `${ticket.guestFirstName ?? ''} ${ticket.guestLastName ?? ''}`.trim();
  return guest || ticket.guestEmail || ticket.ownerId || ticket.id;
}

export function EventCertificatesPanel({
  eventId,
  ownerTeam,
  attendanceRule,
  attendanceRatio,
  finalizeOpen,
  lastSessionEnded = false,
  tickets,
  canIssue,
  canBind,
  canRevoke,
  canReadIssued,
  canEditEvent = false,
  canEditRule = false,
  days = [],
  onRuleSaved,
  exportAction,
}: {
  /** Who may edit the event changes the rule here, in core's rule editor. */
  canEditRule?: boolean;
  /** The event's days, to group the Sessions in the rule editor. */
  days?: readonly EventDay[];
  /** The rule was saved: the event and its Sessions changed. */
  onRuleSaved?: () => void;
  /** "Listeyi indir" beside the attendance list's heading (CertificateListDownload). */
  exportAction?: ReactNode;
  eventId: string;
  ownerTeam: string;
  attendanceRule: string;
  attendanceRatio?: number;
  /** Whether core opens finalization by the Event's dates (ended or undated). */
  finalizeOpen: boolean;
  /**
   * The last live Session has ended: core with the attendance list opens
   * finalization then too, without waiting for the automatic close (K7).
   */
  lastSessionEnded?: boolean;
  /** For the person picker of an older core; the attendance list replaces it. */
  tickets: Ticket[];
  canIssue: boolean;
  canBind: boolean;
  canRevoke: boolean;
  canReadIssued: boolean;
  /**
   * Who edits the event: sets its rule and its template here without a
   * certificate role (no figures, no issuing).
   */
  canEditEvent?: boolean;
}) {
  const [summary, setSummary] = useState<CertificateEventSummary>();
  // null: core has no rule editor (404, older core) or it could not be read
  const [rule, setRule] = useState<CertificateRule | null>(null);
  // null: core has no attendance list (404, older core): the person picker stays
  const [attendance, setAttendance] = useState<CertificateAttendance | null>(null);
  const [attendanceFailed, setAttendanceFailed] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [peopleView, setPeopleView] = useState<AttendanceView>('all');
  const [peoplePage, setPeoplePage] = useState(1);
  const [peopleSize, setPeopleSize] = useState(DEFAULT_PAGE_SIZE);
  const [issuing, setIssuing] = useState<CertificateAttendanceRow | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [issued, setIssued] = useState<IssuedCertificate[]>([]);
  const [failed, setFailed] = useState<CertificateBatch[]>([]);
  const [failedUnread, setFailedUnread] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickQuery, setPickQuery] = useState('');
  const [binding, setBinding] = useState(false);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<IssuedView>('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // core refused the figures (403): the tab shows the rule and the template alone
  const [figuresRefused, setFiguresRefused] = useState(false);
  const [error, setError] = useState<string>();
  // A count the organizer reads stays on the tab; a plain "it went through" is a toast
  const [message, setMessage] = useState<string>();
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  // Who only edits the event reads no figures: core keeps them to the certificate roles
  // Binding a template (every editor of the Event may) opens no figures: those take a certificate role
  const workspace = canReadIssued || canIssue || canRevoke || !canEditEvent;
  const canPick = canBind || canEditEvent;
  const template = useEventTemplateState(eventId);
  /** A write went through: the earlier error and queue line are stale now. */
  const settled = (line?: string) => {
    setError(undefined);
    setMessage(line);
  };
  const done = (toast: string) => {
    settled();
    notify.success(toast);
  };

  const availableTemplates = useMemo(
    () =>
      templates.filter(
        (template) =>
          template.publishedVersion && (!template.ownerTeam || template.ownerTeam === ownerTeam),
      ),
    [ownerTeam, templates],
  );

  async function load() {
    setLoading(true);
    try {
      const [nextSummary, nextTemplates, nextIssued, nextRule, nextAttendance] = await Promise.all([
        // A refused figures read (403) is a reader without them: the rule and template stay
        workspace
          ? certificatesApi.summary(eventId).catch((cause: unknown) => {
              if (cause instanceof ProblemError && cause.status === 403) return undefined;
              throw cause;
            })
          : Promise.resolve(undefined),
        // An older core's template list, for its picker; a refusal leaves it empty
        canBind ? certificatesApi.templates().catch(() => []) : Promise.resolve([]),
        canReadIssued
          ? certificatesApi.listIssued(eventId).catch((cause: unknown) => {
              if (cause instanceof ProblemError && cause.status === 403) return [];
              throw cause;
            })
          : Promise.resolve([]),
        // An older core answers 404: the card says the rule as before
        certificatesApi.rule(eventId).catch(() => null),
        // An older core answers 404: the tab stays as it was; another failure says so
        workspace
          ? certificatesApi
              .attendance(eventId)
              .catch((cause: unknown) =>
                cause instanceof ProblemError && (cause.status === 404 || cause.status === 403)
                  ? null
                  : ('failed' as const),
              )
          : null,
      ]);
      // Only read the batches when something failed: retrying is what they are for here,
      // and a failed read keeps the rest of the tab
      const nextBatches =
        canIssue && nextSummary && nextSummary.failedCount > 0
          ? await certificatesApi.listBatches(eventId).catch(() => null)
          : [];
      setSummary(nextSummary);
      setFiguresRefused(workspace && !nextSummary);
      setRule(nextRule);
      setAttendance(nextAttendance === 'failed' ? null : nextAttendance);
      setAttendanceFailed(nextAttendance === 'failed');
      setTemplates(nextTemplates);
      setIssued(nextIssued);
      setFailed(failedBatches(nextBatches ?? []));
      setFailedUnread(nextBatches === null);
      setError(undefined);
    } catch (cause) {
      setError(coreProblemMessage(cause, 'Sertifika bilgileri yüklenemedi'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [canBind, canIssue, canReadIssued, canRevoke, eventId]);

  async function issueTo(ticketId: string) {
    setBusy(true);
    try {
      await certificatesApi.issue(eventId, ticketId);
      done('Manuel sertifika üretim kuyruğuna alındı');
      setPicking(false);
      await load();
    } catch (cause) {
      setError(coreProblemMessage(cause, 'Sertifika kuyruğa alınamadı'));
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    try {
      const blob = await certificatesApi.previewEvent(eventId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setError(coreProblemMessage(cause, 'Önizleme üretilemedi'));
    }
  }

  /** From the attendance list's row: the dialog shows a refusal itself. */
  async function issueRow(row: CertificateAttendanceRow, justification?: string) {
    setBusy(true);
    try {
      await certificatesApi.issue(eventId, row.ticketId, justification);
      setIssuing(null);
      done(`${row.name} için sertifika kuyruğa alındı`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  function askRescan(count: number) {
    confirm({
      title: 'Uygunlar yeniden taransın mı?',
      description: `${count} kişiye sertifika üretilip e-postayla gönderilecek.`,
      actionLabel: 'Yeniden tara',
      destructive: false,
      onConfirm: async () => {
        setBusy(true);
        try {
          const result = await certificatesApi.rescan(eventId);
          settled(
            result.queued
              ? `${result.queued} sertifika üretim kuyruğuna alındı.`
              : 'Yeni uygun kişi yok.',
          );
          await load();
        } finally {
          setBusy(false);
        }
      },
      failure: 'Yeniden taranamadı',
    });
  }

  function askFinalize(eligible: number) {
    confirm({
      title: 'Katılım kapatılsın mı?',
      description: `${eligible} kişiye sertifika üretilip e-postayla gönderilecek. Katılım yeniden açılmaz.`,
      actionLabel: 'Kapat ve üret',
      onConfirm: async () => {
        setBusy(true);
        try {
          const batch = await certificatesApi.finalize(eventId);
          settled(`${batch.totalCount} sertifika üretim kuyruğuna alındı.`);
          await load();
        } finally {
          setBusy(false);
        }
      },
      failure: 'Katılım kapatılamadı',
    });
  }

  function askRevoke(certificate: IssuedCertificate) {
    confirm({
      title: `${certificate.recipientName} sertifikası iptal edilsin mi?`,
      description: `Doğrulama sayfası ${certificate.serial} için "iptal edildi" gösterir. İptal geri alınamaz; gerekirse Yeniden ver yeni bir üretim başlatır.`,
      actionLabel: 'Sertifikayı iptal et',
      onConfirm: async () => {
        setBusy(true);
        try {
          await certificatesApi.revoke(certificate.serial);
          done(`${certificate.recipientName} sertifikası iptal edildi`);
          await load();
        } finally {
          setBusy(false);
        }
      },
      failure: 'Sertifika iptal edilemedi',
    });
  }

  async function reissue(certificate: IssuedCertificate) {
    setBusy(true);
    setError(undefined);
    try {
      await certificatesApi.reissue(certificate.serial);
      done(`${certificate.recipientName} sertifikası yeniden üretim kuyruğuna alındı`);
      await load();
    } catch (cause) {
      setError(coreProblemMessage(cause, 'Sertifika yeniden verilemedi'));
    } finally {
      setBusy(false);
    }
  }

  /** One person's mail again: the certificate stays as it is. */
  async function resendOne(name: string, serial: string) {
    setBusy(true);
    setError(undefined);
    try {
      const result = await certificatesApi.resendMail(serial);
      done(result.queued ? `${name} için posta sıraya alındı` : `${name} için posta zaten sırada`);
      await load();
    } catch (cause) {
      setError(coreProblemMessage(cause, 'Posta yeniden gönderilemedi'));
    } finally {
      setBusy(false);
    }
  }

  function askResend(scope: 'failed' | 'all', count: number) {
    confirm({
      title: `${count} kişiye sertifika postası yeniden gönderilsin mi?`,
      description:
        scope === 'failed'
          ? 'Yalnız postası gönderilemeyenlere gider. Sertifikalar değişmez.'
          : 'Postayı almış olanlara da gider. Sertifikalar değişmez.',
      actionLabel: 'Yeniden gönder',
      destructive: false,
      onConfirm: async () => {
        setBusy(true);
        try {
          settled(mailResendLine(await certificatesApi.resendEventMails(eventId, scope)));
          await load();
        } finally {
          setBusy(false);
        }
      },
      failure: 'Postalar yeniden gönderilemedi',
    });
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const searched = issued.filter((row) => matchesQuery(query, row.recipientName, row.serial));
  const validRows = searched.filter((row) => !row.revokedAt);
  const revokedRows = searched.filter((row) => row.revokedAt);
  const shown = view === 'valid' ? validRows : view === 'revoked' ? revokedRows : searched;
  const issuedTickets = new Set(issued.filter((row) => !row.revokedAt).map((row) => row.ticketId));
  const pickable = tickets
    .filter((ticket) => !issuedTickets.has(ticket.id))
    .filter((ticket) =>
      pickerMatch(pickQuery, ticketLabel(ticket), ticket.guestEmail ?? undefined),
    );

  // An older core keeps no mails: no column, no resend
  const mailKept = summary?.mailFailedCount !== undefined;
  const mailFailed = summary?.mailFailedCount ?? 0;
  const mailQueued = summary?.mailQueuedCount ?? 0;
  // The two mail commands: for who may issue, once a certificate is out
  const mailCommands = canIssue && mailKept && (summary?.issuedCount ?? 0) > 0;

  const columns: DataListColumn<IssuedCertificate>[] = [
    {
      id: 'name',
      width: 'minmax(0,1fr)',
      header: 'Kişi',
      cell: (row) => (
        <DataListTitle
          title={row.recipientName}
          subtitle={
            <span className={TEXT_SECONDARY}>
              {row.serial}
              {mailKept && row.mail && !row.revokedAt ? (
                <span
                  className={`block md:hidden ${row.mail.status === 'failed' ? 'text-destructive' : ''}`}
                >
                  {`Posta: ${mailLine(row.mail)}`}
                </span>
              ) : null}
            </span>
          }
        />
      ),
    },
    {
      id: 'issued',
      width: '11rem',
      from: 'md',
      header: 'Verilme',
      cell: (row) => (
        <span className="text-secondary-foreground text-[13px]/5">{when(row.issuedAt)}</span>
      ),
    },
    ...(mailKept
      ? [
          {
            id: 'mail',
            width: '10rem',
            from: 'md',
            header: 'Posta',
            cell: (row: IssuedCertificate) =>
              row.revokedAt ? (
                <span className="text-subtle-foreground text-[13px]/5">—</span>
              ) : (
                <MailCell mail={row.mail} />
              ),
          } satisfies DataListColumn<IssuedCertificate>,
        ]
      : []),
    {
      id: 'status',
      width: { base: 'auto', sm: '6rem' },
      label: 'Durum',
      cell: (row) => (
        <StatusChip
          kind={row.revokedAt ? 'cancelled' : 'active'}
          label={row.revokedAt ? 'İptal' : 'Geçerli'}
        />
      ),
    },
    {
      id: 'actions',
      width: '2.5rem',
      label: 'Eylemler',
      interactive: true,
      align: 'end',
      cell: (row) => (
        <RowMenu rowName={row.recipientName}>
          <MenuItem
            icon={ExternalLink}
            onClick={() => window.open(row.verifyUrl, '_blank', 'noopener,noreferrer')}
          >
            Doğrulama sayfası
          </MenuItem>
          {canIssue && mailResendable(row, summary) ? (
            <MenuItem
              icon={Mail}
              disabled={busy}
              onClick={() => void resendOne(row.recipientName, row.serial)}
            >
              Postayı yeniden gönder
            </MenuItem>
          ) : null}
          {canRevoke && !row.revokedAt ? (
            <MenuItem icon={Ban} destructive disabled={busy} onClick={() => askRevoke(row)}>
              İptal et
            </MenuItem>
          ) : null}
          {canIssue && row.revokedAt ? (
            <MenuItem icon={RefreshCw} disabled={busy} onClick={() => void reissue(row)}>
              Yeniden ver
            </MenuItem>
          ) : null}
        </RowMenu>
      ),
    },
  ];

  const finalized = Boolean(summary?.attendanceFinalizedAt);
  // With the attendance list core opens finalization once the last Session is over too
  const canFinalize = finalizeOpen || (attendance !== null && lastSessionEnded);
  const closeLine = attendance && summary ? attendanceCloseLine(summary) : null;
  const toRescan = attendance ? rescanCount(attendance) : 0;
  const peopleSearched = attendance ? searchAttendance(attendance.rows, peopleQuery) : [];
  const peopleCounts = attendance
    ? attendanceViewCounts(peopleSearched, attendance)
    : { all: 0, eligible: 0, below: 0, issued: 0 };
  // Core's eligibleCount counts the issued too; a finalization queues only the rest
  const eligibleNow = attendance ? finalizeCount(attendance) : (summary?.eligibleCount ?? 0);
  const peoplePaged = paginateRows(
    attendance ? viewAttendance(peopleSearched, peopleView, attendance) : [],
    peoplePage,
    peopleSize,
  );
  const choosePeopleView = (next: AttendanceView) => {
    setPeopleView(next);
    setPeoplePage(1);
  };
  const peoplePaging = {
    total: peoplePaged.total,
    page: peoplePaged.page,
    pageSize: peopleSize,
    onPage: setPeoplePage,
    onPageSize: (size: number) => {
      setPeopleSize(size);
      setPeoplePage(1);
    },
  };
  const counted = attendance?.countedTotal ?? 0;
  const sessionless = attendance?.sessionless ?? false;
  const missingText = (row: CertificateAttendanceRow) =>
    row.missingRequired.map((session) => session.title).join(', ');

  const peopleColumns: DataListColumn<CertificateAttendanceRow>[] = [
    {
      id: 'name',
      width: 'minmax(0,1fr)',
      header: 'Kişi',
      cell: (row) => (
        <DataListTitle
          title={row.name}
          subtitle={
            <span className={TEXT_SECONDARY}>
              <span className="tabular-nums md:hidden">
                {attendedText({ countedTotal: counted, sessionless }, row)}
              </span>
              {row.missingRequired.length ? (
                <span className="text-destructive lg:hidden">
                  <span className="md:hidden"> · </span>
                  {`Eksik: ${missingText(row)}`}
                </span>
              ) : null}
              {row.certificate?.mail?.status === 'failed' && !row.certificate.revokedAt ? (
                <span className="text-destructive md:hidden">{` · Posta: ${mailLine(row.certificate.mail)}`}</span>
              ) : null}
            </span>
          }
        />
      ),
    },
    {
      id: 'sessions',
      width: '5rem',
      from: 'md',
      header: sessionless ? 'Giriş' : 'Oturum',
      cell: (row) => (
        <span className="text-foreground text-[13px]/5 tabular-nums">
          {attendedText({ countedTotal: counted, sessionless }, row, '')}
        </span>
      ),
    },
    ...(attendance?.required.length
      ? [
          {
            id: 'required',
            width: '12rem',
            from: 'lg',
            header: 'Eksik zorunlu',
            cell: (row: CertificateAttendanceRow) =>
              row.missingRequired.length ? (
                <span className="text-destructive text-[13px]/5">{missingText(row)}</span>
              ) : (
                <span className="text-subtle-foreground text-[13px]/5">—</span>
              ),
          } satisfies DataListColumn<CertificateAttendanceRow>,
        ]
      : []),
    ...(mailKept
      ? [
          {
            id: 'mail',
            width: '10rem',
            from: 'md',
            header: 'Posta',
            cell: (row: CertificateAttendanceRow) =>
              row.certificate && !row.certificate.revokedAt ? (
                <MailCell mail={row.certificate.mail} />
              ) : (
                <span className="text-subtle-foreground text-[13px]/5">—</span>
              ),
          } satisfies DataListColumn<CertificateAttendanceRow>,
        ]
      : []),
    {
      id: 'status',
      width: { base: 'auto', sm: '6.5rem' },
      label: 'Durum',
      cell: (row) => (
        <StatusChip
          kind={ATTENDANCE_STATUS[row.status].kind}
          label={ATTENDANCE_STATUS[row.status].label}
        />
      ),
    },
    {
      id: 'actions',
      width: '2.5rem',
      label: 'Eylemler',
      interactive: true,
      align: 'end',
      cell: (row) =>
        canIssue && (issuableByHand(row) || mailResendable(row.certificate, summary)) ? (
          <RowMenu rowName={row.name}>
            {issuableByHand(row) ? (
              <MenuItem icon={UserPlus} disabled={busy} onClick={() => setIssuing(row)}>
                Elle ver
              </MenuItem>
            ) : null}
            {row.certificate && mailResendable(row.certificate, summary) ? (
              <MenuItem
                icon={Mail}
                disabled={busy}
                onClick={() => void resendOne(row.name, row.certificate!.serial)}
              >
                Postayı yeniden gönder
              </MenuItem>
            ) : null}
          </RowMenu>
        ) : (
          // Holds the menu's room so every row keeps one height
          <span aria-hidden className="inline-block size-7 pointer-coarse:size-9" />
        ),
    },
  ];

  // An older core (no Event templates) knows the resolved template from the figures too
  const templateView =
    template.status === 'ready'
      ? {
          ...template.view,
          resolution: template.view.resolution ?? summary?.resolution ?? null,
        }
      : null;
  // The Kural card's template row has Örnek PDF and Ekip şablonlarından seç: the bar has them only
  // while that row is not there (still loading, unread) or cannot pick (an older core)
  const barPreview = !templateView;
  const barPick = canPick && (!templateView || templateView.legacy);
  const pendingCount = (summary?.queuedCount ?? 0) + (summary?.failedCount ?? 0);
  const ruleKind = rule?.rule ?? attendanceRule;
  const ruleText = rule
    ? ruleSummaryParts(rule).join(' · ')
    : attendanceRule === 'ratio'
      ? `%${Math.round((attendanceRatio ?? 0) * 100)} oturum`
      : attendanceRule === 'once'
        ? 'En az bir oturum'
        : attendanceRule === 'count'
          ? 'Oturum sayısı'
          : 'Sertifika yok';
  const attendanceText = summary?.attendanceFinalizedAt
    ? `${when(summary.attendanceFinalizedAt)} kapatıldı`
    : !canFinalize
      ? 'Etkinlik bitince kapatılır'
      : 'Açık';

  return (
    <div className="space-y-4">
      {confirmDialog}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-skylab-300 text-sm">
          {message}
        </p>
      ) : null}
      {summary ? (
        <>
          <SummaryStrip
            items={[
              {
                key: 'eligible',
                label: 'Uygun',
                value: eligibleNow,
                active: attendance !== null && peopleView === 'eligible',
                onSelect: attendance
                  ? () => choosePeopleView(peopleView === 'eligible' ? 'all' : 'eligible')
                  : undefined,
              },
              ...(attendance
                ? [
                    {
                      key: 'below',
                      label: 'Eşik altı',
                      value: summary.belowCount ?? peopleCounts.below,
                      active: peopleView === 'below',
                      onSelect: () => choosePeopleView(peopleView === 'below' ? 'all' : 'below'),
                    },
                  ]
                : []),
              {
                key: 'issued',
                label: 'Verilen',
                value: summary.issuedCount,
                hint: summary.revokedCount ? (
                  <span className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
                    {summary.revokedCount} iptal
                  </span>
                ) : undefined,
                active: view === 'valid',
                onSelect: canReadIssued
                  ? () => setView(view === 'valid' ? 'all' : 'valid')
                  : undefined,
              },
              {
                key: 'pending',
                label: 'Üretim: sırada · başarısız',
                value: `${summary.queuedCount} · ${summary.failedCount}`,
                hint: summary.failedCount ? (
                  <span className={`text-destructive ${TEXT_SECONDARY}`}>
                    {summary.failedCount} başarısız
                  </span>
                ) : pendingCount ? (
                  <span className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Üretiliyor</span>
                ) : undefined,
              },
            ]}
          />
          {closeLine ? (
            <p className="text-secondary-foreground flex items-center gap-2 text-sm">
              <Clock className="text-subtle-foreground size-4 shrink-0" aria-hidden />
              {closeLine}
            </p>
          ) : null}
          {mailKept && (mailFailed || mailQueued) ? (
            <p className="text-secondary-foreground flex items-center gap-2 text-sm">
              <Mail className="text-subtle-foreground size-4 shrink-0" aria-hidden />
              <span>
                Sertifika postası:{' '}
                {mailFailed ? (
                  <span className="text-destructive">{mailFailed} gönderilemedi</span>
                ) : null}
                {mailFailed && mailQueued ? ' · ' : null}
                {mailQueued ? `${mailQueued} sırada` : null}
              </span>
            </p>
          ) : null}
          <CommandBar label="Sertifika komutları">
            {canIssue && !finalized ? (
              <Command
                primary
                icon={Send}
                label={
                  attendance && summary.autoFinalizeAt
                    ? 'Şimdi kapat ve üret'
                    : 'Katılımı kapat ve üret'
                }
                disabled={busy || ruleKind === 'none' || !canFinalize}
                onClick={() => askFinalize(eligibleNow)}
              />
            ) : null}
            {canIssue && finalized && attendance ? (
              <Command
                primary
                icon={ScanSearch}
                label="Uygunları yeniden tara"
                disabled={busy || toRescan === 0}
                onClick={() => askRescan(toRescan)}
              />
            ) : null}
            {canIssue && !attendance ? (
              <Command
                icon={UserPlus}
                label="Elle ver"
                onClick={() => {
                  setPickQuery('');
                  setPicking(true);
                }}
              />
            ) : null}
            {/* Wide: each command its own button (the mail ones from xl, where
                they fit); narrower, the rest goes behind one menu */}
            <span className="hidden md:contents">
              {barPreview ? (
                <Command icon={Eye} label="Örnek PDF" onClick={() => void preview()} />
              ) : null}
              {barPick ? (
                <Command
                  icon={FileBadge}
                  label="Şablonu değiştir"
                  onClick={() => setBinding(true)}
                />
              ) : null}
            </span>
            {mailCommands ? (
              <span className="hidden xl:contents">
                {mailFailed > 0 ? (
                  <Command
                    icon={Mail}
                    label="Gönderilemeyenlere gönder"
                    disabled={busy}
                    onClick={() => askResend('failed', mailFailed)}
                  />
                ) : null}
                <Command
                  icon={Mail}
                  label="Herkese yeniden gönder"
                  disabled={busy}
                  onClick={() => askResend('all', summary.issuedCount)}
                />
              </span>
            ) : null}
            <span className={mailCommands ? 'contents xl:hidden' : 'contents md:hidden'}>
              <CommandMenu
                name="Diğer sertifika eylemleri"
                items={[
                  ...(barPreview
                    ? [
                        <MenuItem
                          key="preview"
                          icon={Eye}
                          className="md:hidden"
                          onClick={() => void preview()}
                        >
                          Örnek PDF
                        </MenuItem>,
                      ]
                    : []),
                  ...(barPick
                    ? [
                        <MenuItem
                          key="binding"
                          icon={FileBadge}
                          className="md:hidden"
                          onClick={() => setBinding(true)}
                        >
                          Şablonu değiştir
                        </MenuItem>,
                      ]
                    : []),
                  ...(mailCommands && mailFailed > 0
                    ? [
                        <MenuItem
                          key="mail-failed"
                          icon={Mail}
                          disabled={busy}
                          onClick={() => askResend('failed', mailFailed)}
                        >
                          {`Postayı gönderilemeyenlere yeniden gönder (${mailFailed})`}
                        </MenuItem>,
                      ]
                    : []),
                  ...(mailCommands
                    ? [
                        <MenuItem
                          key="mail-all"
                          icon={Mail}
                          disabled={busy}
                          onClick={() => askResend('all', summary.issuedCount)}
                        >
                          Postayı herkese yeniden gönder
                        </MenuItem>,
                      ]
                    : []),
                ]}
              />
            </span>
          </CommandBar>
        </>
      ) : null}
      {summary || !workspace || figuresRefused ? (
        <ObjectCard
          title="Kural ve şablon"
          action={
            rule && canEditRule ? (
              <button
                type="button"
                aria-label="Kuralı düzenle"
                className={`text-skylab-300 hover:text-foreground ${TEXT_SECONDARY}`}
                onClick={() => setRuleOpen(true)}
              >
                Düzenle
              </button>
            ) : undefined
          }
        >
          <div className="space-y-4">
            {templateView ? (
              <EventTemplateRow
                eventId={eventId}
                view={templateView}
                canEdit={canEditEvent}
                canPick={canPick}
                from="certificates"
                onPick={() => setBinding(true)}
              />
            ) : template.status === 'failed' ? (
              <p role="alert" className={`text-destructive ${TEXT_SECONDARY}`}>
                {template.error}
              </p>
            ) : (
              <Skeleton className="h-14 w-full" />
            )}
            <DescriptionList
              columns={2}
              items={[
                { label: 'Katılım kuralı', value: ruleText },
                // The line over the commands says it when core gives a time
                ...(closeLine ? [] : [{ label: 'Katılım', value: attendanceText }]),
              ]}
            />
          </div>
        </ObjectCard>
      ) : null}

      {canIssue && (failed.length > 0 || failedUnread) ? (
        <ObjectCard title="Başarısız üretim işleri">
          {failedUnread ? (
            <p role="alert" className="text-destructive text-[13px]/5">
              Başarısız üretim işleri okunamadı. Sayfayı yenileyip yeniden dene.
            </p>
          ) : null}
          <ListPanel
            status={listStatus({
              loading: false,
              rowCount: failed.length,
              failed: failedUnread,
              emptyMessage: 'Başarısız iş yok',
            })}
          >
            {failed.map((batch) => (
              <ListItem
                key={batch.id}
                title={`${batchReasonLabel[batch.reason] ?? batch.reason} · ${batch.totalCount} sertifika`}
                subtitle={[
                  batch.reason === 'manual' && batch.justification
                    ? `Gerekçe: ${batch.justification}`
                    : null,
                  `${batch.issuedCount} verildi · ${batch.queuedCount} bekliyor · ${batch.failedCount} başarısız · ${when(batch.createdAt)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                trailing={
                  <ActionButton
                    icon={RotateCcw}
                    label="Yeniden dene"
                    showLabel
                    disabled={busy}
                    onClick={() =>
                      confirm({
                        title: `${batch.failedCount} başarısız sertifika yeniden üretilsin mi?`,
                        description: 'Üretilen sertifikalar sahiplerine e-postayla gönderilir.',
                        actionLabel: 'Yeniden dene',
                        destructive: false,
                        onConfirm: async () => {
                          setBusy(true);
                          try {
                            await certificatesApi.retryBatch(batch.id);
                            settled(
                              `${batch.failedCount} başarısız sertifika yeniden kuyruğa alındı.`,
                            );
                            await load();
                          } finally {
                            setBusy(false);
                          }
                        },
                        failure: 'Yeniden denenemedi',
                      })
                    }
                  />
                }
              />
            ))}
          </ListPanel>
        </ObjectCard>
      ) : null}

      {attendance || attendanceFailed ? (
        <section className="flex flex-col gap-3" aria-label="Katılımcılar">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-foreground text-sm font-semibold">Katılımcılar</h2>
            {exportAction}
          </div>
          {attendanceFailed ? (
            <EmptyState
              kind="failed"
              title="Katılımcılar yüklenemedi"
              onRetry={() => void load()}
            />
          ) : attendance && attendance.rows.length ? (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1">
                  <ListToolbar
                    query={peopleQuery}
                    onQuery={(next) => {
                      setPeopleQuery(next);
                      setPeoplePage(1);
                    }}
                    placeholder="Ad"
                    searchLabel="Katılımcı ara"
                    views={[
                      { value: 'all', label: 'Hepsi', count: peopleCounts.all },
                      { value: 'eligible', label: 'Uygun', count: peopleCounts.eligible },
                      { value: 'below', label: 'Eşik altı', count: peopleCounts.below },
                      { value: 'issued', label: 'Verildi', count: peopleCounts.issued },
                    ]}
                    view={peopleView}
                    onView={choosePeopleView}
                  />
                </div>
                <ListPager {...peoplePaging} placement="top" />
              </div>
              {peoplePaged.total ? (
                <DataList
                  columns={peopleColumns}
                  rows={peoplePaged.slice}
                  getRowId={(row) => row.ticketId}
                  rowLabel={(row) => row.name}
                />
              ) : (
                <EmptyState
                  kind="no-results"
                  onClear={() => {
                    setPeopleQuery('');
                    choosePeopleView('all');
                  }}
                />
              )}
              <ListPager {...peoplePaging} />
            </>
          ) : (
            <EmptyState kind="first-use" title="Henüz kayıt yok" />
          )}
        </section>
      ) : null}

      {canReadIssued ? (
        <section className="flex flex-col gap-3" aria-label="Verilen sertifikalar">
          <h2 className="text-foreground text-sm font-semibold">Verilen sertifikalar</h2>
          {issued.length ? (
            <ListToolbar
              query={query}
              onQuery={setQuery}
              placeholder="Ad ya da kod"
              searchLabel="Sertifika ara"
              views={[
                { value: 'all', label: 'Hepsi', count: searched.length },
                { value: 'valid', label: 'Geçerli', count: validRows.length },
                { value: 'revoked', label: 'İptal', count: revokedRows.length },
              ]}
              view={view}
              onView={setView}
            />
          ) : null}
          {!issued.length ? (
            <EmptyState kind="first-use" title="Henüz sertifika verilmedi" />
          ) : !shown.length ? (
            <EmptyState
              kind="no-results"
              onClear={() => {
                setQuery('');
                setView('all');
              }}
            />
          ) : (
            <DataList
              columns={columns}
              rows={shown}
              getRowId={(row) => row.id}
              rowLabel={(row) => row.recipientName}
            />
          )}
        </section>
      ) : null}

      {issuing && attendance ? (
        <ManualIssueDialog
          key={issuing.ticketId}
          row={issuing}
          countedTotal={attendance.countedTotal}
          sessionless={attendance.sessionless}
          needsReason={needsJustification(attendance, issuing)}
          onClose={() => setIssuing(null)}
          onIssue={(justification) => issueRow(issuing, justification)}
        />
      ) : null}

      <PickerDrawer
        open={picking}
        onClose={() => setPicking(false)}
        title="Elle sertifika ver"
        query={pickQuery}
        onQuery={setPickQuery}
        placeholder="Ad ya da e-posta"
        loading={false}
        options={pickable.map((ticket) => ({
          id: ticket.id,
          title: ticketLabel(ticket),
          subtitle: ticket.guestEmail || undefined,
        }))}
        emptyMessage={pickQuery.trim() ? 'Eşleşen katılımcı yok' : 'Sertifikasız katılımcı yok'}
        onPick={(id) => void issueTo(id)}
      />

      {rule && canEditRule ? (
        <CertificateRuleSheet
          open={ruleOpen}
          rule={rule}
          eventId={eventId}
          days={days}
          finalized={Boolean(summary?.attendanceFinalizedAt)}
          templateWarning={autoSendTemplateWarning(templateView)}
          onClose={() => setRuleOpen(false)}
          onSaved={(saved) => {
            setRule(saved);
            setRuleOpen(false);
            done('Kural kaydedildi');
            onRuleSaved?.();
            void load();
          }}
        />
      ) : null}

      {canPick ? (
        <TemplateBindingDialog
          open={binding}
          onClose={() => setBinding(false)}
          eventId={eventId}
          choices={
            templateView && !templateView.legacy
              ? templateView.choices
              : availableTemplates.map((item) => ({
                  id: item.id,
                  name: item.name,
                  ownerTeam: item.ownerTeam,
                  system: item.system,
                  version: item.publishedVersion?.version ?? 0,
                }))
          }
          eventTemplate={templateView?.eventTemplate ?? null}
          resolution={templateView?.resolution ?? null}
          onDone={() => {
            settled();
            void load();
            void template.reload();
          }}
        />
      ) : null}
    </div>
  );
}
