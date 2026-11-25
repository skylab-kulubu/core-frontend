import { coreFetch, coreFetchBlob } from './core';

export type CertificateElementKind =
  | 'staticText'
  | 'recipientName'
  | 'eventName'
  | 'eventDates'
  | 'issueDate'
  | 'ownerTeam'
  | 'serial'
  | 'verificationQr'
  | 'image'
  | 'shape';

export type CertificateElement = {
  id: string;
  kind: CertificateElementKind;
  text?: string;
  mediaId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily?: string;
  fontSize?: number;
  minFontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  align?: 'left' | 'center' | 'right';
  rotation?: number;
  opacity?: number;
  fit?: 'cover' | 'contain' | 'shrink';
  locked?: boolean;
  /** `backgroundText`: converted from the PDF background's text. */
  origin?: 'backgroundText';
  /** The PDF's font name of a converted text, at most 120 characters. */
  sourceFont?: string;
  fontStyle?: 'italic';
  /**
   * A team's or the club's certificate font (core docs/certificate-fonts.md):
   * its checked WOFF2. `fontFamily` is then its family, `fontWeight` and
   * `fontStyle` its face's.
   */
  fontMediaId?: string;
};

/** A team's (or, `ownerTeam` '', the club's) uploaded certificate font: one face. */
export type CertificateFont = {
  id: string;
  ownerTeam: string;
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  /** The checked WOFF2: an element's `fontMediaId`. */
  mediaId: string;
  /** The letters of ğĞıİşŞçÇöÖüÜ, A–Z, a–z, 0–9 it lacks; '' when none. */
  missingTurkish: string;
  uploadedBy?: string | null;
  createdAt: string;
  /**
   * `?template=` only: a font the draft uses that is none of its team's or the
   * club's current ones (archived, or another team's in a copy): kept, not
   * offered for new text.
   */
  draftOnly?: boolean;
};

/** How the background sits on the page (core `Layout.backgroundPlacement`). */
export type BackgroundFit = 'contain' | 'cover' | 'fill' | 'fitWidth' | 'fitHeight' | 'none';

export type BackgroundPlacement = {
  fit: BackgroundFit;
  /** CSS object-position fractions: 0 left/top, 0.5 centre, 1 right/bottom. */
  x: number;
  y: number;
  /** Multiplies the fit's scale, 0.1–10; fill ignores it. */
  scale: number;
};

export type CertificateLayout = {
  width: number;
  height: number;
  orientation: 'landscape' | 'portrait';
  backgroundColor: string;
  backgroundMediaId?: string;
  /** Absent on layouts written before it: printed as `LEGACY_IMAGE_PLACEMENT`. */
  backgroundPlacement?: BackgroundPlacement;
  /**
   * The PDF a text conversion started from; never printed. Going back sets it
   * as the background again and drops the converted layers.
   */
  backgroundOriginalMediaId?: string;
  elements: CertificateElement[];
};

/** `GET /v1/certificate-assets/{id}/info`: a PDF's visible box in pt × 96/72. */
export type CertificateAssetInfo = {
  contentType: string;
  widthPx: number;
  heightPx: number;
  pages: number;
  /** The texts pdf-tools found; 0 for an image. */
  textCount: number;
};

/** Why pdf-tools cannot convert a text (core docs "Background text conversion"). */
export type BackgroundTextReason =
  | 'unreadable'
  | 'stroke'
  | 'invisible'
  | 'clip'
  | 'vertical'
  | 'skewed'
  | 'shared'
  | 'unmatched'
  | 'limit'
  | 'truncated';

/** One run of a PDF's text: one style along a line. */
export type BackgroundTextSpan = {
  id: string;
  text: string;
  sourceFont: string;
  /** The family, weight and style a conversion sets it in. */
  font: string;
  fontWeight: number;
  fontStyle?: 'italic';
  fontSubstituted: boolean;
  /** Set when `font` is a certificate font of the template's team or the club's. */
  fontMediaId?: string;
  fontSizePt: number;
  convertible: boolean;
  reason?: BackgroundTextReason;
};

/** `GET /v1/certificate-assets/{id}/text`. */
export type BackgroundTextList = {
  spans: BackgroundTextSpan[];
  truncated?: boolean;
  /** Set when the list is empty: why the PDF has no text. */
  textMissing?: 'outlines' | 'image' | 'unknown';
};

export type BackgroundTextConversionBody = {
  spanIds: string[];
  kinds: Record<string, 'recipientName' | 'eventName' | 'eventDates' | 'issueDate'>;
  page: { width: number; height: number };
  placement?: BackgroundPlacement;
  /** How many layers the draft keeps beside the new ones (at most 100 together). */
  existingElements: number;
  /** The template the draft is of: its team's fonts are matched too (else the club's alone). */
  templateId?: string;
};

export type BackgroundTextWarning = {
  spanId: string;
  elementId?: string;
  kind: 'fontSubstituted' | 'fontSizeBounded' | 'textCut' | 'outsidePage';
  from?: string | number;
  to?: string | number;
};

/** `POST …/text-conversion`: nothing is saved; the editor applies it to the draft. */
export type BackgroundTextConversion = {
  backgroundMediaId: string;
  backgroundOriginalMediaId: string;
  elements: CertificateElement[];
  warnings: BackgroundTextWarning[];
};

export type CertificateTemplateDraft = {
  name: string;
  ownerTeam: string;
  sourceKind: 'upload' | 'canva' | 'figma' | 'sky';
  sourceRef: string;
  sourceEditUrl: string;
  layout: CertificateLayout;
};

export type CertificateTemplateVersion = {
  id: string;
  templateId: string;
  version: number;
  layout: CertificateLayout;
  checksum: string;
  publishedAt: string;
};

export type CertificateTemplate = {
  id: string;
  name: string;
  ownerTeam: string;
  sourceKind: CertificateTemplateDraft['sourceKind'];
  sourceRef: string;
  sourceEditUrl: string;
  draftLayout: CertificateLayout;
  system: boolean;
  createdAt: string;
  updatedAt: string;
  publishedVersion?: CertificateTemplateVersion;
};

export type ResolvedCertificateTemplate = {
  template: CertificateTemplate;
  version: CertificateTemplateVersion;
  source: 'event' | 'ownerTeam' | 'clubDefault';
};

export type CertificateTemplateBinding = {
  id: string;
  scope: 'club' | 'ownerTeam' | 'event';
  scopeKey: string;
  templateId: string;
  updatedAt: string;
};

export type CertificateBatchJob = {
  id: string;
  ticketId: string;
  status: 'queued' | 'running' | 'issued' | 'failed' | 'cancelled';
  attemptCount: number;
  errorCode?: string;
  certificateId?: string;
};

export type CertificateBatch = {
  id: string;
  eventId: string;
  templateVersionId: string;
  templateSource: string;
  reason: 'finalization' | 'manual' | 'reissue' | 'rescan';
  status: 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
  /** Why a manual issue was given; required below the rule's threshold. */
  justification?: string;
  totalCount: number;
  queuedCount: number;
  issuedCount: number;
  failedCount: number;
  createdAt: string;
  completedAt?: string;
  jobs?: CertificateBatchJob[];
};

/**
 * A certificate's latest mail (core docs/certificate-mail.md): queued (waiting
 * or being tried again), sent, failed (refused or given up) or cancelled (the
 * certificate was revoked before it went out). An older core sends none, and a
 * certificate issued before the queue has none.
 */
export type CertificateMailState = {
  status: 'queued' | 'sent' | 'failed' | 'cancelled';
  attempts: number;
  errorCode?: string;
  sentAt?: string;
  updatedAt: string;
};

/** POST …/mail/resend: mails written, and certificates whose mail was already waiting. */
export type CertificateMailResend = { queued: number; alreadyQueued: number };

export type CertificateEventSummary = {
  eventId: string;
  attendanceFinalizedAt?: string;
  eligibleCount: number;
  issuedCount: number;
  revokedCount: number;
  queuedCount: number;
  failedCount: number;
  resolution: ResolvedCertificateTemplate;
  /**
   * Core's attendance list (sertifika-oturum tickets 02 and 03); an older core
   * sends none of these. `belowCount`: the Tickets under the threshold.
   */
  countedTotal?: number;
  effectiveMin?: number;
  belowCount?: number;
  /**
   * No live session (core docs/certificate-rule.md, "An Event with no Session"): N is the
   * event itself (1) and a venue entry its attendance. Absent before core #422.
   */
  sessionless?: boolean;
  /** When the attendance closes by itself; left out once closed or when it will not. */
  autoFinalizeAt?: string;
  /** Who closed it, once closed. */
  finalizedSource?: 'manual' | 'auto';
  /** Active certificates whose latest mail waits or failed; an older core sends none. */
  mailQueuedCount?: number;
  mailFailedCount?: number;
};

/** A Ticket's place in the list, first that holds: issued > queued > failed > revoked > eligible > below. */
export type CertificateAttendanceStatus =
  | 'issued'
  | 'queued'
  | 'failed'
  | 'revoked'
  | 'eligible'
  | 'below';

export type CertificateAttendanceRow = {
  ticketId: string;
  name: string;
  ticketType: string;
  /** Check-ins on the live counted Sessions. */
  attended: number;
  /** Live required Sessions without a check-in, in program order. */
  missingRequired: { id: string; title: string }[];
  status: CertificateAttendanceStatus;
  /** The active certificate, else the latest revoked one, else null. */
  certificate: {
    serial: string;
    issuedAt: string;
    revokedAt?: string;
    mail?: CertificateMailState;
  } | null;
};

/** GET /v1/events/{id}/certificates/attendance (core docs/certificate-rule.md): no e-mail, by name. */
export type CertificateAttendance = {
  countedTotal: number;
  effectiveMin: number;
  rule: CertificateRule['rule'];
  /** No live session: `attended` 1 is a venue entry (core #422). */
  sessionless?: boolean;
  required: { id: string; title: string }[];
  rows: CertificateAttendanceRow[];
};

/** POST /v1/events/{id}/certificates/rescan: no batch when no one was queued. */
export type CertificateRescan = { queued: number; batch?: CertificateBatch };

export type IssuedCertificate = {
  id: string;
  eventId: string;
  ticketId: string;
  serial: string;
  recipientName: string;
  recipientEmail: string;
  eventName: string;
  ownerTeam: string;
  verifyUrl: string;
  templateSource: string;
  revokedAt?: string;
  issuedAt: string;
  mail?: CertificateMailState;
};

/** One of the Event's current Sessions as the rule editor shows it, cancelled ones too. */
export type CertificateRuleSession = {
  id: string;
  dayId: string;
  title: string;
  sessionType: string;
  startTime?: string;
  endTime?: string;
  cancelled: boolean;
  /** One of the N; a cancelled Session counts for nothing whatever this says. */
  counted: boolean;
  /** Missing it refuses the certificate; always counted. */
  required: boolean;
};

/**
 * GET /v1/events/{id}/certificate-rule (core docs/certificate-rule.md): the
 * rule, its threshold as stored (`minCount`, null for the default ⌈3N/4⌉) and
 * as it applies now over `countedTotal`, and the Sessions in program order.
 */
export type CertificateRule = {
  rule: 'none' | 'once' | 'count' | 'ratio';
  /** An older Event's `ratio` rule alone; a write may not choose it. */
  ratio?: number;
  minCount: number | null;
  effectiveMin: number;
  countedTotal: number;
  /** No live session: the event itself is the one counted unit, a venue entry its attendance. */
  sessionless?: boolean;
  sessions: CertificateRuleSession[];
  /**
   * Close attendance an hour after the last Session ends (ticket 03). Not in
   * core's answer yet: the panel shows the switch only once core sends it.
   */
  autoFinalize?: boolean;
};

/** PUT /v1/events/{id}/certificate-rule: one transaction; a Session left out keeps its marks. */
export type CertificateRuleBody = {
  rule: 'none' | 'once' | 'count';
  minCount: number | null;
  sessions: { id: string; counted: boolean; required: boolean }[];
  autoFinalize?: boolean;
};

const eventPath = (eventId: string) => `/v1/events/${encodeURIComponent(eventId)}`;

export const certificatesApi = {
  templates: () => coreFetch<CertificateTemplate[]>('/v1/certificate-templates'),
  template: (id: string) =>
    coreFetch<CertificateTemplate>(`/v1/certificate-templates/${encodeURIComponent(id)}`),
  createTemplate: (body: CertificateTemplateDraft) =>
    coreFetch<CertificateTemplate>('/v1/certificate-templates', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateTemplate: (id: string, body: CertificateTemplateDraft) =>
    coreFetch<CertificateTemplate>(`/v1/certificate-templates/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  publishTemplate: (id: string) =>
    coreFetch<CertificateTemplateVersion>(
      `/v1/certificate-templates/${encodeURIComponent(id)}/publish`,
      { method: 'POST' },
    ),
  previewTemplate: (id: string) =>
    coreFetchBlob(`/v1/certificate-templates/${encodeURIComponent(id)}/preview`, {
      method: 'POST',
    }),
  /**
   * A background's natural size in layout px; a PDF's from pdf-tools (503
   * `pdf_tools_unavailable` without it). An older core, and anyone who may
   * not edit a template that links it, gets 404.
   */
  assetInfo: (id: string) =>
    coreFetch<CertificateAssetInfo>(`/v1/certificate-assets/${encodeURIComponent(id)}/info`),
  /** A PDF background's page as a PNG, its long side `max` px; an image as itself. */
  assetPreview: (id: string, max = 2000) =>
    coreFetchBlob(`/v1/certificate-assets/${encodeURIComponent(id)}/preview?max=${max}`),
  /**
   * A PDF background's text, one row per run; 503 `pdf_tools_unavailable` without pdf-tools.
   * With `templateId`, its team's certificate fonts are matched as well as the club's.
   */
  assetText: (id: string, templateId?: string) =>
    coreFetch<BackgroundTextList>(
      `/v1/certificate-assets/${encodeURIComponent(id)}/text` +
        (templateId ? `?template=${encodeURIComponent(templateId)}` : ''),
    ),
  /** The chosen texts as layers on a copy of the PDF without them. */
  convertAssetText: (id: string, body: BackgroundTextConversionBody) =>
    coreFetch<BackgroundTextConversion>(
      `/v1/certificate-assets/${encodeURIComponent(id)}/text-conversion`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  /**
   * The current certificate fonts of `team` and the club the caller may use
   * (without `team`, the club's); 403 for a team the caller may not use.
   */
  fonts: (team?: string) =>
    coreFetch<CertificateFont[]>(
      '/v1/certificate-fonts' + (team ? `?team=${encodeURIComponent(team)}` : ''),
    ),
  /**
   * The fonts a saved template's editor offers: its team's and the club's
   * current ones, and those its layers use that it may no longer take, marked.
   */
  templateFonts: (templateId: string) =>
    coreFetch<CertificateFont[]>(
      `/v1/certificate-fonts?template=${encodeURIComponent(templateId)}`,
    ),
  /** An uploaded `certificate_font` Media, checked by pdf-tools, kept as the team's font. */
  createFont: (mediaId: string, ownerTeam: string) =>
    coreFetch<CertificateFont>('/v1/certificate-fonts', {
      method: 'POST',
      body: JSON.stringify({ mediaId, ownerTeam }),
    }),
  /** The font's checked WOFF2 (an archived font's too). */
  fontFile: (id: string) => coreFetchBlob(`/v1/certificate-fonts/${encodeURIComponent(id)}/file`),
  /** Archives it: drafts and published versions keep printing it; no new layer may take it. */
  archiveFont: (id: string) =>
    coreFetch<void>(`/v1/certificate-fonts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  bindings: () => coreFetch<CertificateTemplateBinding[]>('/v1/certificate-template-bindings'),
  setBinding: (body: {
    scope: 'club' | 'ownerTeam' | 'event';
    scopeKey: string;
    templateId: string;
  }) =>
    coreFetch<CertificateTemplateBinding>('/v1/certificate-template-bindings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  clearBinding: (scope: string, scopeKey: string) =>
    coreFetch<void>(
      `/v1/certificate-template-bindings/${encodeURIComponent(scope)}/${encodeURIComponent(scopeKey)}`,
      { method: 'DELETE' },
    ),
  resolve: (eventId: string) =>
    coreFetch<ResolvedCertificateTemplate>(`${eventPath(eventId)}/certificates/template`),
  summary: (eventId: string) =>
    coreFetch<CertificateEventSummary>(`${eventPath(eventId)}/certificates/summary`),
  /** An older core has no such call and answers 404: the rule stays on the edit page. */
  rule: (eventId: string) => coreFetch<CertificateRule>(`${eventPath(eventId)}/certificate-rule`),
  setRule: (eventId: string, body: CertificateRuleBody) =>
    coreFetch<CertificateRule>(`${eventPath(eventId)}/certificate-rule`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  previewEvent: (eventId: string) =>
    coreFetchBlob(`${eventPath(eventId)}/certificates/preview`, { method: 'POST' }),
  listIssued: (eventId: string) =>
    coreFetch<IssuedCertificate[]>(`${eventPath(eventId)}/certificates`),
  listBatches: (eventId: string) =>
    coreFetch<CertificateBatch[]>(`${eventPath(eventId)}/certificate-batches`),
  finalize: (eventId: string) =>
    coreFetch<CertificateBatch>(`${eventPath(eventId)}/certificates/finalize`, { method: 'POST' }),
  /** An older core has no such call and answers 404: the tab keeps the person picker. */
  attendance: (eventId: string) =>
    coreFetch<CertificateAttendance>(`${eventPath(eventId)}/certificates/attendance`),
  /**
   * Below the threshold core wants a justification (400 `justification_required`,
   * over 500 characters `justification_too_long`); an eligible Ticket needs none.
   */
  issue: (eventId: string, ticketId: string, justification?: string) =>
    coreFetch<CertificateBatch>(`${eventPath(eventId)}/certificates/issue`, {
      method: 'POST',
      body: JSON.stringify(justification ? { ticketId, justification } : { ticketId }),
    }),
  rescan: (eventId: string) =>
    coreFetch<CertificateRescan>(`${eventPath(eventId)}/certificates/rescan`, { method: 'POST' }),
  revoke: (serial: string) =>
    coreFetch<void>(`/v1/certificates/${encodeURIComponent(serial)}/revoke`, { method: 'POST' }),
  reissue: (serial: string) =>
    coreFetch<CertificateBatch>(`/v1/certificates/${encodeURIComponent(serial)}/reissue`, {
      method: 'POST',
    }),
  /** One certificate's mail again; 409 for a revoked one. */
  resendMail: (serial: string) =>
    coreFetch<CertificateMailResend>(`/v1/certificates/${encodeURIComponent(serial)}/mail/resend`, {
      method: 'POST',
    }),
  /** The Event's mails again: those that failed, or every active certificate's. */
  resendEventMails: (eventId: string, scope: 'failed' | 'all') =>
    coreFetch<CertificateMailResend>(`${eventPath(eventId)}/certificates/mail/resend`, {
      method: 'POST',
      body: JSON.stringify({ scope }),
    }),
  retryBatch: (id: string) =>
    coreFetch<CertificateBatch>(`/v1/certificate-batches/${encodeURIComponent(id)}/retry`, {
      method: 'POST',
    }),
};
