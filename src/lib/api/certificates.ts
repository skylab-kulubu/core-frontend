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
};

export type CertificateLayout = {
  width: number;
  height: number;
  orientation: 'landscape' | 'portrait';
  backgroundColor: string;
  backgroundMediaId?: string;
  elements: CertificateElement[];
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
  reason: 'finalization' | 'manual' | 'reissue';
  status: 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
  totalCount: number;
  queuedCount: number;
  issuedCount: number;
  failedCount: number;
  createdAt: string;
  completedAt?: string;
  jobs?: CertificateBatchJob[];
};

export type CertificateEventSummary = {
  eventId: string;
  attendanceFinalizedAt?: string;
  eligibleCount: number;
  issuedCount: number;
  revokedCount: number;
  queuedCount: number;
  failedCount: number;
  resolution: ResolvedCertificateTemplate;
};

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
  previewEvent: (eventId: string) =>
    coreFetchBlob(`${eventPath(eventId)}/certificates/preview`, { method: 'POST' }),
  listIssued: (eventId: string) =>
    coreFetch<IssuedCertificate[]>(`${eventPath(eventId)}/certificates`),
  listBatches: (eventId: string) =>
    coreFetch<CertificateBatch[]>(`${eventPath(eventId)}/certificate-batches`),
  batch: (id: string) =>
    coreFetch<CertificateBatch>(`/v1/certificate-batches/${encodeURIComponent(id)}`),
  finalize: (eventId: string) =>
    coreFetch<CertificateBatch>(`${eventPath(eventId)}/certificates/finalize`, { method: 'POST' }),
  issue: (eventId: string, ticketId: string) =>
    coreFetch<CertificateBatch>(`${eventPath(eventId)}/certificates/issue`, {
      method: 'POST',
      body: JSON.stringify({ ticketId }),
    }),
  revoke: (serial: string) =>
    coreFetch<void>(`/v1/certificates/${encodeURIComponent(serial)}/revoke`, { method: 'POST' }),
  reissue: (serial: string) =>
    coreFetch<CertificateBatch>(`/v1/certificates/${encodeURIComponent(serial)}/reissue`, {
      method: 'POST',
    }),
  retryBatch: (id: string) =>
    coreFetch<CertificateBatch>(`/v1/certificate-batches/${encodeURIComponent(id)}/retry`, {
      method: 'POST',
    }),
};
