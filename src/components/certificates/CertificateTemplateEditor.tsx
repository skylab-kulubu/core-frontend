'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Skeleton } from '@skylab-kulubu/skylcn-ui';
import { useRouter } from 'next/navigation';
import './certificate-fonts.css';
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  ImagePlus,
  Lock,
  Plus,
  Save,
  Send,
  Trash2,
  Unlock,
} from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { Select } from '@/components/chrome/Select';
import { SaveButton } from '@/components/chrome/SaveButton';
import { PageSkeleton } from '@/components/chrome/PageSkeleton';
import { StateCard } from '@/components/chrome/StateCard';
import {
  certificatesApi,
  type BackgroundFit,
  type BackgroundPlacement,
  type CertificateElement,
  type CertificateElementKind,
  type CertificateLayout,
  type CertificateTemplateDraft,
} from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';
import { mediaApi } from '@/lib/api/media';
import { coreProblemMessage } from '@/lib/core-problems';
import { publicMediaUrl } from '@/lib/event-media';
import { useAuth } from '@/context/AuthContext';
import {
  canEditCertificateTemplateForTeam,
  canManageCertificateTemplates,
} from '@/lib/auth/groups';
import { useAnyTeamCan, useTeamCan } from '@/lib/use-app-can';
import { useNotify } from '@/lib/ui/use-notify';
import { useChromeCrumbName } from '@/components/layout/chrome-crumb-names';
import {
  ELEMENT_LABELS,
  FONT_GROUPS,
  SAMPLE,
  certificateFontStack,
} from '@/lib/certificate-layout';
import {
  FIT_LABELS,
  LEGACY_IMAGE_PLACEMENT,
  fitPageToBackground,
  legacyPdfPlacement,
  normalizePlacement,
  pageForBackground,
  placeBackground,
  placeableSize,
  ratioDiffers,
  resizeCertificateLayout,
  type Size,
} from '@/lib/certificate-placement';
import { backgroundNaturalSize } from '@/lib/background-size';

const PAGE_PRESETS = {
  a4Landscape: { label: 'A4 yatay', width: 1123, height: 794, orientation: 'landscape' },
  a4Portrait: { label: 'A4 dikey', width: 794, height: 1123, orientation: 'portrait' },
  letterLandscape: { label: 'US Letter yatay', width: 1056, height: 816, orientation: 'landscape' },
  letterPortrait: { label: 'US Letter dikey', width: 816, height: 1056, orientation: 'portrait' },
} as const;

const SOURCE_LABELS: Record<CertificateTemplateDraft['sourceKind'], string> = {
  upload: 'Dosya yükleme',
  canva: 'Canva',
  figma: 'Figma',
  sky: 'SKY LAB editörü',
};

const BACKGROUND_FILE_TYPES = 'image/png,image/jpeg,image/webp,image/svg+xml,application/pdf,.pdf';

/** The 3×3 position grid: object-position fractions and what each cell is called. */
const POSITIONS = [
  [0, 0, 'Sol üst'],
  [0.5, 0, 'Üst'],
  [1, 0, 'Sağ üst'],
  [0, 0.5, 'Sol'],
  [0.5, 0.5, 'Orta'],
  [1, 0.5, 'Sağ'],
  [0, 1, 'Sol alt'],
  [0.5, 1, 'Alt'],
  [1, 1, 'Sağ alt'],
] as const;

const PLACEMENT_DROPPED = 'Yerleşim kaydedilmedi; core güncel değil.';

const PDF_PREVIEW_UNAVAILABLE = 'PDF önizlemesi şu an üretilemiyor.';

/**
 * A PDF background's size and text count from core (`/v1/certificate-assets/{id}/info`).
 * `legacy`: core without the asset routes (404); the PDF is drawn in a frame, as
 * before, and an upload keeps no placement. `failed`: pdf-tools is down
 * (`unavailable`) or refused the PDF; a saved placement is kept as it is.
 */
type PdfInfo =
  | { state: 'loading' }
  | { state: 'ready'; size: Size; textCount: number }
  | { state: 'legacy' }
  | { state: 'failed'; unavailable: boolean; message: string };

/** A PDF background's page as a PNG from core (`…/preview`), as an object URL. */
type PdfPreview =
  | { state: 'loading' }
  | { state: 'ready'; url: string }
  | { state: 'legacy' }
  | { state: 'failed'; unavailable: boolean; message: string };

function pdfFailure(cause: unknown): { state: 'legacy' } | Extract<PdfInfo, { state: 'failed' }> {
  if (cause instanceof ProblemError && cause.status === 404) return { state: 'legacy' };
  const unavailable =
    cause instanceof ProblemError &&
    (cause.code === 'pdf_tools_unavailable' || (cause.status === 503 && !cause.code));
  return {
    state: 'failed',
    unavailable,
    message: unavailable
      ? PDF_PREVIEW_UNAVAILABLE
      : coreProblemMessage(cause, 'PDF arka plan okunamadı'),
  };
}

/** A page fitted to its background, kept so the designer can take it back. */
type FitNote = { before: CertificateLayout; after: CertificateLayout };

const pageSize = (layout: { width: number; height: number }) => `${layout.width}×${layout.height}`;

function currentPreset(layout: CertificateLayout) {
  return (
    Object.entries(PAGE_PRESETS).find(
      ([, preset]) => preset.width === layout.width && preset.height === layout.height,
    )?.[0] ?? 'custom'
  );
}

// The element box is a flex box, where text-align no longer places a
// short line: map the alignment to justify-content, as core's PDF does
// (left → start, center → safe center, right → safe end).
function justifyClass(align: CertificateElement['align']) {
  if (align === 'center') return 'justify-center-safe';
  if (align === 'right') return 'justify-end-safe';
  return 'justify-start';
}

/**
 * Layers a template cannot lose: core refuses a layout without them. The
 * verification QR is optional (ADR-0040 addendum 2026-11-24): the default
 * keeps one, a designer may delete it. So is the Event's name (addendum
 * 2026-11-25): a background may print it already.
 */
const REQUIRED_KINDS: readonly CertificateElementKind[] = ['recipientName'];

/** Core wants one of these so a paper certificate can be verified. */
const VERIFY_KINDS: readonly CertificateElementKind[] = ['verificationQr', 'serial'];
const LAST_VERIFIER = 'QR ya da sertifika kodundan biri kalmalı.';

/** Deleting it would leave the layout neither the QR nor the serial. */
function lastVerifier(elements: readonly CertificateElement[], element: CertificateElement) {
  return (
    VERIFY_KINDS.includes(element.kind) &&
    !elements.some((other) => other.id !== element.id && VERIFY_KINDS.includes(other.kind))
  );
}

function makeElement(kind: CertificateElementKind): CertificateElement {
  const isQr = kind === 'verificationQr';
  const isShape = kind === 'shape';
  return {
    id: `${kind}-${crypto.randomUUID()}`,
    kind,
    text: kind === 'staticText' ? 'Yeni metin' : undefined,
    x: isQr ? 900 : 160,
    y: isQr ? 600 : isShape ? 180 : 260,
    width: isQr ? 130 : isShape ? 320 : 800,
    height: isQr ? 130 : isShape ? 180 : 64,
    fontFamily: 'Arial',
    fontSize: kind === 'recipientName' ? 48 : 26,
    minFontSize: 12,
    fontWeight: kind === 'recipientName' ? 700 : 500,
    lineHeight: 1.15,
    letterSpacing: 0,
    color: '#111111',
    backgroundColor: isShape ? '#ddd6fe' : undefined,
    borderColor: isShape ? '#8b5cf6' : undefined,
    borderWidth: isShape ? 2 : 0,
    borderRadius: isShape ? 16 : 0,
    align: 'center',
    rotation: 0,
    opacity: 1,
    fit: kind === 'recipientName' || kind === 'eventName' ? 'shrink' : undefined,
  };
}

export const emptyCertificateDraft = (): CertificateTemplateDraft => ({
  name: 'Yeni sertifika şablonu',
  ownerTeam: '',
  sourceKind: 'upload',
  sourceRef: '',
  sourceEditUrl: '',
  layout: {
    width: 1123,
    height: 794,
    orientation: 'landscape',
    backgroundColor: '#ffffff',
    elements: [
      { ...makeElement('recipientName'), x: 140, y: 285, width: 843 },
      { ...makeElement('eventName'), x: 180, y: 390, width: 763 },
      { ...makeElement('verificationQr'), x: 910, y: 610 },
    ],
  },
});

type DragState = { id: string; startX: number; startY: number; x: number; y: number };

export function CertificateTemplateEditor({ templateId }: { templateId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [draft, setDraft] = useState<CertificateTemplateDraft>(emptyCertificateDraft);
  const [savedId, setSavedId] = useState(templateId);
  const [savedName, setSavedName] = useState<string | null>(null);
  useChromeCrumbName(`/certificates/templates/${templateId ?? ''}`, templateId ? savedName : null);
  const [selectedId, setSelectedId] = useState<string>();
  const [backgroundUrl, setBackgroundUrl] = useState<string>();
  const [backgroundType, setBackgroundType] = useState<string>();
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  // Image backgrounds' natural sizes by address, which the placement needs
  const [backgroundSizes, setBackgroundSizes] = useState<Record<string, Size>>({});
  // Image backgrounds whose size could not be read (core: background_size_unknown), apart
  // from those still being read: they keep no placement and show no placement controls
  const [unsizedBackgrounds, setUnsizedBackgrounds] = useState<Record<string, true>>({});
  // PDF backgrounds' size and PNG from core, by Media id
  const [pdfInfos, setPdfInfos] = useState<Record<string, PdfInfo>>({});
  const [pdfPreviews, setPdfPreviews] = useState<Record<string, PdfPreview>>({});
  const previewUrls = useRef<string[]>([]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const urls = previewUrls.current;
    return () => {
      mounted.current = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  const [fitNote, setFitNote] = useState<FitNote>();
  // Core dropped the placement on save: it predates it (core-backend #446)
  const [placementDropped, setPlacementDropped] = useState(false);
  // The draft an upload, which awaits, fits: the one after the await
  const latestDraft = useRef(draft);
  useEffect(() => {
    latestDraft.current = draft;
  }, [draft]);
  const [loading, setLoading] = useState(Boolean(templateId));
  const [busy, setBusy] = useState(false);
  // Lines the designer reads (an element already placed, the next step after a save or upload) stay inline
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const notify = useNotify();
  // The group rule narrowed by core's certificateTemplate.update/create (a DK member reads only)
  const teamCan = useTeamCan();
  const anyTeamCan = useAnyTeamCan();
  const canEdit = templateId
    ? canEditCertificateTemplateForTeam(user?.groups ?? [], user?.roles ?? [], draft.ownerTeam) &&
      teamCan(draft.ownerTeam, 'certificateTemplate.update')
    : canManageCertificateTemplates(user?.groups ?? [], user?.roles ?? []) &&
      anyTeamCan('certificateTemplate.create');

  const elements = draft.layout.elements;
  const selected = useMemo(
    () => elements.find((element) => element.id === selectedId),
    [elements, selectedId],
  );
  const externalSource = draft.sourceKind === 'canva' || draft.sourceKind === 'figma';
  const sourceName = draft.sourceKind === 'canva' ? 'Canva' : 'Figma';
  const backgroundId = draft.layout.backgroundMediaId;
  const backgroundIsPDF = backgroundType === 'application/pdf';
  const backgroundIsImage = Boolean(backgroundUrl) && Boolean(backgroundType?.startsWith('image/'));
  const pdfInfo = backgroundIsPDF && backgroundId ? pdfInfos[backgroundId] : undefined;
  const pdfPreview = backgroundIsPDF && backgroundId ? pdfPreviews[backgroundId] : undefined;
  // An older core: the PDF in a frame, as before (no size, no placement controls)
  const pdfLegacy = pdfInfo?.state === 'legacy' || pdfPreview?.state === 'legacy';
  const pdfProblem =
    pdfInfo?.state === 'failed' ? pdfInfo : pdfPreview?.state === 'failed' ? pdfPreview : undefined;
  const backgroundSize = backgroundIsPDF
    ? pdfInfo?.state === 'ready'
      ? pdfInfo.size
      : undefined
    : backgroundUrl
      ? backgroundSizes[backgroundUrl]
      : undefined;
  const backgroundUnsized =
    !backgroundIsPDF && Boolean(backgroundUrl && unsizedBackgrounds[backgroundUrl]);
  // The background can take a placement: an image unless its size could not be
  // read (also while it is being read), a PDF once core gave its size
  const sizable = backgroundIsPDF
    ? pdfInfo?.state === 'ready'
    : backgroundIsImage && !backgroundUnsized;
  // How core prints the background of a layout without a placement
  const legacyPlacement =
    backgroundIsPDF && backgroundSize ? legacyPdfPlacement(backgroundSize) : LEGACY_IMAGE_PLACEMENT;
  const storedPlacement = draft.layout.backgroundPlacement ?? legacyPlacement;
  const placement = normalizePlacement(placementDropped ? legacyPlacement : storedPlacement);
  // The picture the canvas draws: an image itself, a PDF's PNG from core
  const backgroundSrc = backgroundIsPDF
    ? pdfPreview?.state === 'ready'
      ? pdfPreview.url
      : undefined
    : backgroundIsImage
      ? backgroundUrl
      : undefined;
  const backgroundBox = backgroundSize
    ? placeBackground(
        draft.layout.width,
        draft.layout.height,
        backgroundSize.width,
        backgroundSize.height,
        placement,
      )
    : undefined;
  const fittedPage = backgroundSize ? pageForBackground(backgroundSize) : null;

  useEffect(() => {
    if (
      !backgroundUrl ||
      !backgroundType?.startsWith('image/') ||
      backgroundSizes[backgroundUrl] ||
      unsizedBackgrounds[backgroundUrl]
    ) {
      return;
    }
    let cancelled = false;
    backgroundNaturalSize(backgroundUrl, backgroundType)
      .then((size) => {
        if (!cancelled) setBackgroundSizes((current) => ({ ...current, [backgroundUrl]: size }));
      })
      .catch(() => {
        if (!cancelled) setUnsizedBackgrounds((current) => ({ ...current, [backgroundUrl]: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [backgroundUrl, backgroundType, backgroundSizes, unsizedBackgrounds]);

  /** Reads a PDF background's size from core and keeps it by Media id. */
  async function loadPdfInfo(id: string): Promise<PdfInfo> {
    setPdfInfos((current) => ({ ...current, [id]: { state: 'loading' } }));
    let info: PdfInfo;
    try {
      const answer = await certificatesApi.assetInfo(id);
      const size = { width: answer.widthPx, height: answer.heightPx };
      info = placeableSize(size)
        ? { state: 'ready', size, textCount: answer.textCount ?? 0 }
        : { state: 'failed', unavailable: false, message: 'PDF arka planın boyutu okunamadı.' };
    } catch (cause) {
      info = pdfFailure(cause);
    }
    if (mounted.current) setPdfInfos((current) => ({ ...current, [id]: info }));
    return info;
  }

  useEffect(() => {
    if (!backgroundIsPDF || !backgroundId) return;
    if (!pdfInfos[backgroundId]) void loadPdfInfo(backgroundId);
    if (pdfPreviews[backgroundId]) return;
    setPdfPreviews((current) => ({ ...current, [backgroundId]: { state: 'loading' } }));
    certificatesApi
      .assetPreview(backgroundId)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        if (!mounted.current) return URL.revokeObjectURL(url);
        previewUrls.current.push(url);
        setPdfPreviews((current) => ({ ...current, [backgroundId]: { state: 'ready', url } }));
      })
      .catch((cause) => {
        if (mounted.current) {
          setPdfPreviews((current) => ({ ...current, [backgroundId]: pdfFailure(cause) }));
        }
      });
    // loadPdfInfo only sets state; the maps say what is read already
  }, [backgroundIsPDF, backgroundId, pdfInfos, pdfPreviews]);

  useEffect(() => {
    if (!canEdit || !selectedId) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (event.key === 'Escape') {
        setSelectedId(undefined);
        return;
      }
      const movement = event.shiftKey ? 10 : 1;
      const delta =
        event.key === 'ArrowLeft'
          ? { x: -movement, y: 0 }
          : event.key === 'ArrowRight'
            ? { x: movement, y: 0 }
            : event.key === 'ArrowUp'
              ? { x: 0, y: -movement }
              : event.key === 'ArrowDown'
                ? { x: 0, y: movement }
                : null;
      if (!delta && event.key !== 'Delete' && event.key !== 'Backspace') return;
      event.preventDefault();
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!selected || selected.locked || REQUIRED_KINDS.includes(selected.kind)) {
          return;
        }
        if (lastVerifier(elements, selected)) {
          setError(LAST_VERIFIER);
          return;
        }
        setDraft((current) => ({
          ...current,
          layout: {
            ...current.layout,
            elements: current.layout.elements.filter((item) => item.id !== selectedId),
          },
        }));
        setSelectedId(undefined);
        return;
      }
      setDraft((current) => {
        const element = current.layout.elements.find((item) => item.id === selectedId);
        if (!element || element.locked) return current;
        if (!delta) return current;
        const x = Math.max(0, Math.min(current.layout.width - element.width, element.x + delta.x));
        const y = Math.max(
          0,
          Math.min(current.layout.height - element.height, element.y + delta.y),
        );
        return {
          ...current,
          layout: {
            ...current.layout,
            elements: current.layout.elements.map((item) =>
              item.id === selectedId ? { ...item, x, y } : item,
            ),
          },
        };
      });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canEdit, elements, selected, selectedId]);

  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    certificatesApi
      .template(templateId)
      .then(async (template) => {
        if (cancelled) return;
        setSavedName(template.name);
        const next: CertificateTemplateDraft = {
          name: template.name,
          ownerTeam: template.ownerTeam,
          sourceKind: template.sourceKind,
          sourceRef: template.sourceRef,
          sourceEditUrl: template.sourceEditUrl,
          layout: template.draftLayout,
        };
        setDraft(next);
        setBackgroundUrl(undefined);
        setBackgroundType(undefined);
        const mediaIds = [
          next.layout.backgroundMediaId,
          ...next.layout.elements.map((element) => element.mediaId),
        ].filter((id): id is string => Boolean(id));
        const media = await Promise.all(mediaIds.map((id) => mediaApi.get(id).catch(() => null)));
        if (cancelled) return;
        const urls = Object.fromEntries(
          media.filter((item) => item !== null).map((item) => [item.id, publicMediaUrl(item.url)]),
        );
        if (next.layout.backgroundMediaId) {
          const background = media.find((item) => item?.id === next.layout.backgroundMediaId);
          setBackgroundUrl(urls[next.layout.backgroundMediaId]);
          setBackgroundType(background?.type);
        }
        setImageUrls(urls);
      })
      .catch((cause) => {
        if (!cancelled) setError(coreProblemMessage(cause, 'Şablon yüklenemedi'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  function updateLayout(patch: Partial<CertificateLayout>) {
    if (!canEdit) return;
    setDraft((current) => ({ ...current, layout: { ...current.layout, ...patch } }));
  }

  function updateElement(id: string, patch: Partial<CertificateElement>) {
    if (!canEdit) return;
    const currentElement = draft.layout.elements.find((element) => element.id === id);
    if (currentElement?.locked && patch.locked !== false) return;
    updateLayout({
      elements: draft.layout.elements.map((element) =>
        element.id === id ? { ...element, ...patch } : element,
      ),
    });
  }

  function resizeLayout(presetKey: keyof typeof PAGE_PRESETS) {
    if (!canEdit) return;
    const preset = PAGE_PRESETS[presetKey];
    setDraft((current) => ({
      ...current,
      layout: resizeCertificateLayout(current.layout, preset),
    }));
  }

  function updatePlacement(patch: Partial<BackgroundPlacement>) {
    if (!sizable) return;
    updateLayout({ backgroundPlacement: { ...storedPlacement, ...patch } });
  }

  /** Sets the fitted layout; a new page size is said inline with a way back. */
  function applyFit(before: CertificateLayout, after: CertificateLayout) {
    setDraft((current) => ({ ...current, layout: after }));
    setFitNote(
      before.width !== after.width || before.height !== after.height
        ? { before, after }
        : undefined,
    );
    setMessage(undefined);
  }

  function fitPage() {
    if (!canEdit || !backgroundSize) return;
    const after = fitPageToBackground(draft.layout, backgroundSize);
    if (after) applyFit(draft.layout, after);
  }

  function undoFit() {
    if (!canEdit || !fitNote) return;
    const { before } = fitNote;
    setDraft((current) => ({ ...current, layout: before }));
    setFitNote(undefined);
  }

  function removeBackground() {
    if (!canEdit) return;
    updateLayout({ backgroundMediaId: undefined, backgroundPlacement: undefined });
    setBackgroundUrl(undefined);
    setBackgroundType(undefined);
    setFitNote(undefined);
    setMessage(undefined);
  }

  function moveLayer(id: string, direction: -1 | 1) {
    if (!canEdit) return;
    const index = draft.layout.elements.findIndex((element) => element.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= draft.layout.elements.length) return;
    const elements = [...draft.layout.elements];
    [elements[index], elements[target]] = [elements[target], elements[index]];
    updateLayout({ elements });
  }

  function duplicateElement(element: CertificateElement) {
    if (!canEdit) return;
    const copy = {
      ...element,
      id: `${element.kind}-${crypto.randomUUID()}`,
      locked: false,
      x: Math.min(draft.layout.width - element.width, element.x + 20),
      y: Math.min(draft.layout.height - element.height, element.y + 20),
    };
    updateLayout({ elements: [...draft.layout.elements, copy] });
    setSelectedId(copy.id);
  }

  function deleteElement(element: CertificateElement) {
    if (!canEdit || REQUIRED_KINDS.includes(element.kind)) return;
    if (lastVerifier(draft.layout.elements, element)) {
      setError(LAST_VERIFIER);
      return;
    }
    updateLayout({
      elements: draft.layout.elements.filter((candidate) => candidate.id !== element.id),
    });
    setSelectedId(undefined);
  }

  function alignElement(
    element: CertificateElement,
    alignment: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom',
  ) {
    const positions = {
      left: { x: 0 },
      centerX: { x: Math.round((draft.layout.width - element.width) / 2) },
      right: { x: draft.layout.width - element.width },
      top: { y: 0 },
      centerY: { y: Math.round((draft.layout.height - element.height) / 2) },
      bottom: { y: draft.layout.height - element.height },
    };
    updateElement(element.id, positions[alignment]);
  }

  function addElement(kind: CertificateElementKind) {
    if (!canEdit) return;
    if (
      draft.layout.elements.some((element) => element.kind === kind) &&
      kind !== 'staticText' &&
      kind !== 'image' &&
      kind !== 'shape'
    ) {
      setMessage(`${ELEMENT_LABELS[kind]} zaten tasarımda.`);
      return;
    }
    const element = makeElement(kind);
    updateLayout({ elements: [...draft.layout.elements, element] });
    setSelectedId(element.id);
  }

  // TODO(media redesign ticket 06): upload the sertifika şablon görseli with the
  // `certificate_asset` purpose once private Media storage ships. Until then
  // core refuses that purpose with `private_media_disabled`, so it goes up
  // without a purpose (legacy), which also still takes the SVG backgrounds
  // `certificate_asset` will not.
  async function uploadBackground(file?: File) {
    if (!file || !canEdit) return;
    setBusy(true);
    try {
      const media = await mediaApi.upload(file);
      const url = publicMediaUrl(media.url);
      const pdf = media.type === 'application/pdf';
      // The natural size, read before the page is fitted (K1): an image's in the
      // browser, a PDF's from core
      const image = Boolean(media.type?.startsWith('image/'));
      const info = pdf ? await loadPdfInfo(media.id) : undefined;
      const size = image
        ? await backgroundNaturalSize(url, media.type, file).catch(() => undefined)
        : info?.state === 'ready'
          ? info.size
          : undefined;
      if (image && size) setBackgroundSizes((current) => ({ ...current, [url]: size }));
      if (image && !size) setUnsizedBackgrounds((current) => ({ ...current, [url]: true }));
      setBackgroundUrl(url);
      setBackgroundType(media.type);
      setFitNote(undefined);
      // A background of unknown size keeps no placement: core prints it the old way
      // (an image covered, a PDF by its width or height) and refuses an image's placement
      const before: CertificateLayout = {
        ...latestDraft.current.layout,
        backgroundMediaId: media.id,
        backgroundPlacement: size ? latestDraft.current.layout.backgroundPlacement : undefined,
      };
      const uploaded = pdf
        ? 'PDF arka planı yüklendi.'
        : 'Arka plan yüklendi. Kaydettikten sonra yeni sürümü yayınlayabilirsin.';
      // A background of another ratio than the page's fits the page to it (K1)
      const after = size
        ? ratioDiffers(before, size)
          ? fitPageToBackground(before, size)
          : { ...before, backgroundPlacement: { fit: 'fill' as const, x: 0.5, y: 0.5, scale: 1 } }
        : null;
      if (after) {
        applyFit(before, after);
        if (after.width === before.width && after.height === before.height) setMessage(uploaded);
        return;
      }
      setDraft((current) => ({ ...current, layout: before }));
      setMessage(uploaded);
    } catch (cause) {
      setError(coreProblemMessage(cause, 'Arka plan yüklenemedi'));
    } finally {
      setBusy(false);
    }
  }

  async function uploadElementImage(file?: File) {
    if (!file || !selected || !canEdit) return;
    setBusy(true);
    try {
      // No purpose yet: see the ticket 06 TODO on uploadBackground.
      const media = await mediaApi.upload(file);
      updateElement(selected.id, { kind: 'image', mediaId: media.id, fit: 'contain' });
      setImageUrls((current) => ({ ...current, [media.id]: publicMediaUrl(media.url) }));
    } catch (cause) {
      setError(coreProblemMessage(cause, 'Görsel yüklenemedi'));
    } finally {
      setBusy(false);
    }
  }

  /**
   * The draft as core takes it: the placement in range, and none once core
   * dropped it. A saved placement whose background could not be sized now (a
   * CDN hiccup, pdf-tools down) goes back as it was; an upload of unknown size
   * has already cleared it.
   */
  function draftToSave(): CertificateTemplateDraft {
    const { backgroundPlacement, ...layout } = draft.layout;
    const keep = backgroundPlacement && layout.backgroundMediaId && !placementDropped;
    return {
      ...draft,
      layout: keep
        ? { ...layout, backgroundPlacement: normalizePlacement(backgroundPlacement) }
        : layout,
    };
  }

  /**
   * Saves the draft; `announce` is off when publishing says the outcome itself.
   * `dropped` is a placement core did not keep: a core before the placement
   * (core-backend #446) reads the draft without it.
   */
  async function save(announce = true): Promise<{ id: string; dropped: boolean } | undefined> {
    if (!canEdit) {
      setError('Bu şablonu düzenleme yetkin yok.');
      return undefined;
    }
    setBusy(true);
    setError(undefined);
    try {
      const body = draftToSave();
      const template = savedId
        ? await certificatesApi.updateTemplate(savedId, body)
        : await certificatesApi.createTemplate(body);
      const dropped = Boolean(
        body.layout.backgroundPlacement &&
        template.draftLayout &&
        !template.draftLayout.backgroundPlacement,
      );
      if (dropped) setPlacementDropped(true);
      setSavedId(template.id);
      // It says the next step, which the designer reads: inline, not a toast (K5)
      if (announce) setMessage('Taslak kaydedildi. Verilen sertifikaları etkilemesi için yayınla.');
      if (!savedId) router.replace(`/certificates/templates/${template.id}`);
      return { id: template.id, dropped };
    } catch (cause) {
      setError(coreProblemMessage(cause, 'Şablon kaydedilemedi'));
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    const saved = await save(false);
    // A version without the placement the editor shows is not published
    if (!saved || saved.dropped) return;
    const id = saved.id;
    setBusy(true);
    try {
      const version = await certificatesApi.publishTemplate(id);
      setMessage(undefined);
      notify.success(`Sürüm ${version.version} yayınlandı; yeni işler bu sürümü kullanacak`);
    } catch (cause) {
      setError(coreProblemMessage(cause, 'Şablon yayınlanamadı'));
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    const id = canEdit ? (await save())?.id : savedId;
    if (!id) return;
    setBusy(true);
    try {
      const blob = await certificatesApi.previewTemplate(id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setError(coreProblemMessage(cause, 'Önizleme üretilemedi'));
    } finally {
      setBusy(false);
    }
  }

  function startDrag(event: React.PointerEvent, element: CertificateElement) {
    if (!canEdit || element.locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(element.id);
    dragRef.current = {
      id: element.id,
      startX: event.clientX,
      startY: event.clientY,
      x: element.x,
      y: element.y,
    };
  }

  function moveDrag(event: React.PointerEvent) {
    if (!canEdit) return;
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    const scale = canvas.getBoundingClientRect().width / draft.layout.width;
    const element = draft.layout.elements.find((item) => item.id === drag.id);
    if (!element) return;
    const x = Math.max(
      0,
      Math.min(draft.layout.width - element.width, drag.x + (event.clientX - drag.startX) / scale),
    );
    const y = Math.max(
      0,
      Math.min(
        draft.layout.height - element.height,
        drag.y + (event.clientY - drag.startY) / scale,
      ),
    );
    updateElement(drag.id, { x: Math.round(x), y: Math.round(y) });
  }

  if (loading) return <PageSkeleton variant="workspace" />;
  if (error && templateId && !savedId) return <StateCard title={error} tone="danger" />;

  return (
    <div className="space-y-5">
      {!canEdit ? (
        <p className="border-warning/30 bg-warning/5 text-warning rounded-md border px-3 py-2 text-[13px]/5">
          Bu şablon salt okunur.
        </p>
      ) : null}
      <details
        open={!templateId}
        className="border-border bg-sidebar/40 group rounded-xl border [&_summary::-webkit-details-marker]:hidden"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 select-none">
          <ChevronRight
            className="text-subtle-foreground size-4 transition-transform group-open:rotate-90"
            aria-hidden
          />
          <span className="text-foreground text-sm font-semibold">Şablon bilgileri</span>
          <span className="text-subtle-foreground min-w-0 truncate text-[13px]/5">
            {[draft.ownerTeam || 'Kulüp geneli', SOURCE_LABELS[draft.sourceKind]].join(' · ')}
          </span>
        </summary>
        <div className="grid gap-3 px-4 pb-4 lg:grid-cols-4">
          <label className="space-y-1.5 lg:col-span-2">
            <FieldLabel>Şablon adı</FieldLabel>
            <Field
              disabled={!canEdit}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label className="space-y-1.5">
            <FieldLabel>Sahip ekip</FieldLabel>
            <Field
              disabled={!canEdit}
              value={draft.ownerTeam}
              placeholder="Boşsa kulüp geneli"
              onChange={(event) =>
                setDraft({ ...draft, ownerTeam: event.target.value.toUpperCase() })
              }
            />
          </label>
          <label className="space-y-1.5">
            <FieldLabel>Tasarım kaynağı</FieldLabel>
            <Select
              disabled={!canEdit}
              value={draft.sourceKind}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  sourceKind: event.target.value as CertificateTemplateDraft['sourceKind'],
                })
              }
            >
              <option value="upload">Dosya yükleme</option>
              <option value="canva">Canva</option>
              <option value="figma">Figma</option>
              <option value="sky">SKY LAB editörü</option>
            </Select>
          </label>
          <label className="space-y-1.5">
            <FieldLabel>Sayfa ölçüsü</FieldLabel>
            <Select
              disabled={!canEdit}
              value={currentPreset(draft.layout)}
              onChange={(event) => resizeLayout(event.target.value as keyof typeof PAGE_PRESETS)}
            >
              {Object.entries(PAGE_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.label}
                </option>
              ))}
              {currentPreset(draft.layout) === 'custom' ? (
                <option value="custom">Özel</option>
              ) : null}
            </Select>
          </label>
          {externalSource ? (
            <div className="border-border bg-muted space-y-3 rounded-lg border p-3 lg:col-span-4">
              <ol
                aria-label={`${sourceName} adımları`}
                className="text-secondary-foreground flex flex-wrap gap-x-4 gap-y-1 text-[13px]/5"
              >
                <li>1 · Bağlantıyı ekle</li>
                <li>2 · {sourceName}&apos;dan PNG, JPG, SVG ya da PDF indir</li>
                <li className={backgroundUrl ? 'text-success' : undefined}>
                  3 · Dosyayı yükle{backgroundUrl ? ' ✓' : ''}
                </li>
              </ol>
              <div className="flex flex-wrap items-end gap-3">
                <label className="block min-w-64 flex-1 space-y-1.5">
                  <FieldLabel>Kaynak bağlantısı</FieldLabel>
                  <Field
                    disabled={!canEdit}
                    type="url"
                    value={draft.sourceEditUrl}
                    placeholder={`${sourceName} düzenleme bağlantısı`}
                    onChange={(event) => setDraft({ ...draft, sourceEditUrl: event.target.value })}
                  />
                </label>
                {draft.sourceEditUrl ? (
                  <a
                    className="text-skylab-300 hover:text-foreground inline-flex h-8 items-center gap-1.5 text-[13px]/5"
                    href={draft.sourceEditUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> {sourceName}&apos;da aç
                  </a>
                ) : null}
                <label className="border-border text-secondary-foreground hover:bg-accent inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border px-3 text-[13px]">
                  <ImagePlus className="h-4 w-4" /> {sourceName} dosyasını yükle
                  <input
                    className="sr-only"
                    type="file"
                    accept={BACKGROUND_FILE_TYPES}
                    disabled={busy || !canEdit}
                    onChange={(event) => void uploadBackground(event.target.files?.[0])}
                  />
                </label>
              </div>
              <details className="text-subtle-foreground text-[13px]/5">
                <summary className="cursor-pointer select-none">Kaynak kimliği</summary>
                <label className="mt-2 block max-w-md space-y-1.5">
                  <FieldLabel>Kaynak kimliği</FieldLabel>
                  <Field
                    disabled={!canEdit}
                    value={draft.sourceRef}
                    placeholder="Canva tasarım kimliği ya da Figma düğümü"
                    onChange={(event) => setDraft({ ...draft, sourceRef: event.target.value })}
                  />
                </label>
              </details>
            </div>
          ) : (
            <div className="border-border bg-muted flex flex-wrap items-center gap-3 rounded-lg border p-3 lg:col-span-4">
              <label className="border-border text-secondary-foreground hover:bg-accent inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border px-3 text-[13px]">
                <ImagePlus className="h-4 w-4" /> Arka plan görseli yükle
                <input
                  className="sr-only"
                  type="file"
                  accept={BACKGROUND_FILE_TYPES}
                  disabled={busy || !canEdit}
                  onChange={(event) => void uploadBackground(event.target.files?.[0])}
                />
              </label>
              <span className="text-subtle-foreground text-[13px]/5">PNG, JPG, SVG ya da PDF</span>
            </div>
          )}
        </div>
      </details>

      <p className="border-border bg-muted text-secondary-foreground rounded-md border px-3 py-2 text-[13px]/5 lg:hidden">
        Bu ekran geniş ekranda düzenlenir.
      </p>

      <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)_240px] xl:grid-cols-[220px_minmax(0,1fr)_260px]">
        <aside
          aria-label="Katman ekle"
          className="border-border bg-sidebar/40 hidden space-y-3 rounded-xl border p-3 lg:block"
        >
          <p className="text-secondary-foreground text-[13px]/5 font-semibold">Katman ekle</p>
          {(Object.keys(ELEMENT_LABELS) as CertificateElementKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => addElement(kind)}
              disabled={!canEdit}
              className="border-border-subtle text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-[13px]/5"
            >
              <Plus className="h-3.5 w-3.5" /> {ELEMENT_LABELS[kind]}
            </button>
          ))}
          {draft.layout.elements.length ? (
            <div className="border-border border-t pt-3">
              <p className="text-secondary-foreground mb-2 text-[13px]/5 font-semibold">
                Katmanlar
              </p>
              <div className="space-y-1">
                {draft.layout.elements.map((element) => (
                  <button
                    key={element.id}
                    type="button"
                    onClick={() => setSelectedId(element.id)}
                    className={`w-full truncate rounded-md px-2 py-1.5 text-left text-[13px]/5 ${selectedId === element.id ? 'bg-skylab-500/15 text-skylab-300' : 'text-subtle-foreground hover:bg-accent'}`}
                  >
                    {ELEMENT_LABELS[element.kind]} {element.locked ? '· kilitli' : ''}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <section className="border-border bg-sidebar/60 min-w-0 overflow-auto rounded-xl border p-4">
          <div
            ref={canvasRef}
            className="relative mx-auto w-full max-w-[1123px] overflow-hidden bg-white shadow-2xl"
            style={{
              aspectRatio: `${draft.layout.width} / ${draft.layout.height}`,
              containerType: 'inline-size',
              backgroundColor: draft.layout.backgroundColor,
            }}
            onPointerMove={moveDrag}
            onPointerUp={() => (dragRef.current = null)}
            onPointerCancel={() => (dragRef.current = null)}
          >
            {backgroundSrc ? (
              // The box core prints the background in (placeBackground); until its size
              // is read, an image covered and centred as a layout without a placement
              // prints, a PDF's page whole
              <img
                src={backgroundSrc}
                alt=""
                aria-hidden
                draggable={false}
                data-background=""
                className="pointer-events-none absolute z-0 max-w-none select-none"
                style={
                  backgroundBox
                    ? {
                        left: `${(backgroundBox.left / draft.layout.width) * 100}%`,
                        top: `${(backgroundBox.top / draft.layout.height) * 100}%`,
                        width: `${(backgroundBox.width / draft.layout.width) * 100}%`,
                        height: `${(backgroundBox.height / draft.layout.height) * 100}%`,
                      }
                    : {
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: backgroundIsPDF ? 'contain' : 'cover',
                      }
                }
              />
            ) : null}
            {backgroundIsPDF && !pdfLegacy && !pdfProblem && !backgroundSrc ? (
              <Skeleton
                data-background-skeleton=""
                aria-hidden
                className="pointer-events-none absolute inset-0 z-0 rounded-none"
              />
            ) : null}
            {backgroundIsPDF && pdfLegacy && backgroundUrl ? (
              // A frame, not an <object>: the panel's CSP allows no objects (object-src 'none')
              <iframe
                title="PDF arka plan önizlemesi"
                src={`${backgroundUrl}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
                tabIndex={-1}
                className="pointer-events-none absolute inset-0 z-0 h-full w-full border-0"
              />
            ) : null}
            {draft.layout.elements.map((element) => {
              const style = {
                left: `${(element.x / draft.layout.width) * 100}%`,
                top: `${(element.y / draft.layout.height) * 100}%`,
                width: `${(element.width / draft.layout.width) * 100}%`,
                height: `${(element.height / draft.layout.height) * 100}%`,
                color: element.color,
                fontFamily: certificateFontStack(element.fontFamily),
                fontSize: `${((element.fontSize ?? 16) / draft.layout.width) * 100}cqw`,
                fontWeight: element.fontWeight,
                textAlign: element.align,
                opacity: element.opacity,
                transform: `rotate(${element.rotation ?? 0}deg)`,
                backgroundColor: element.backgroundColor,
                borderColor: element.borderColor,
                borderWidth: element.borderWidth,
                borderRadius: element.borderRadius,
                lineHeight: element.lineHeight,
                letterSpacing: element.letterSpacing,
              } as React.CSSProperties;
              return (
                <button
                  key={element.id}
                  type="button"
                  aria-label={ELEMENT_LABELS[element.kind]}
                  onPointerDown={(event) => startDrag(event, element)}
                  style={style}
                  className={`absolute z-10 flex touch-none items-center ${justifyClass(element.align)} overflow-hidden whitespace-nowrap ${element.locked ? 'cursor-not-allowed' : 'cursor-move'} ${selectedId === element.id ? 'ring-skylab-400/60 ring-2' : 'hover:ring-1 hover:ring-black/25'} ${element.kind === 'verificationQr' ? 'bg-[repeating-conic-gradient(#111_0_25%,#fff_0_50%)] bg-[length:18px_18px]' : ''}`}
                >
                  {element.kind === 'image' && element.mediaId ? (
                    <img
                      src={imageUrls[element.mediaId]}
                      alt=""
                      className={`h-full w-full ${element.fit === 'contain' ? 'object-contain' : 'object-cover'}`}
                    />
                  ) : element.kind === 'verificationQr' ||
                    element.kind === 'shape' ? null : element.kind === 'staticText' ? (
                    element.text
                  ) : (
                    SAMPLE[element.kind]
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <aside
          aria-label="Özellikler"
          className="border-border bg-sidebar/40 hidden space-y-3 rounded-xl border p-3 lg:block"
        >
          <p className="text-secondary-foreground text-[13px]/5 font-semibold">Özellikler</p>
          {selected ? (
            <>
              <div className="grid grid-cols-4 gap-1">
                <ActionButton
                  icon={selected.locked ? Unlock : Lock}
                  label={selected.locked ? 'Kilidi aç' : 'Kilitle'}
                  disabled={!canEdit}
                  onClick={() => updateElement(selected.id, { locked: !selected.locked })}
                />
                <ActionButton
                  icon={Copy}
                  label="Çoğalt"
                  disabled={!canEdit}
                  onClick={() => duplicateElement(selected)}
                />
                <ActionButton
                  icon={ArrowUp}
                  label="Öne al"
                  disabled={!canEdit}
                  onClick={() => moveLayer(selected.id, 1)}
                />
                <ActionButton
                  icon={ArrowDown}
                  label="Arkaya al"
                  disabled={!canEdit}
                  onClick={() => moveLayer(selected.id, -1)}
                />
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    ['left', 'Sol'],
                    ['centerX', 'Yatay orta'],
                    ['right', 'Sağ'],
                    ['top', 'Üst'],
                    ['centerY', 'Dikey orta'],
                    ['bottom', 'Alt'],
                  ] as const
                ).map(([alignment, label]) => (
                  <button
                    key={alignment}
                    type="button"
                    disabled={!canEdit || selected.locked}
                    className="border-border text-muted-foreground hover:bg-accent h-7 rounded border px-1 text-[13px] disabled:opacity-40"
                    onClick={() => alignElement(selected, alignment)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['x', 'y', 'width', 'height'] as const).map((key) => (
                  <label key={key} className="space-y-1">
                    <FieldLabel>{key.toUpperCase()}</FieldLabel>
                    <Field
                      disabled={!canEdit || selected.locked}
                      type="number"
                      value={selected[key]}
                      onChange={(event) =>
                        updateElement(selected.id, { [key]: Number(event.target.value) })
                      }
                    />
                  </label>
                ))}
              </div>
              {selected.kind !== 'verificationQr' &&
              selected.kind !== 'image' &&
              selected.kind !== 'shape' ? (
                <>
                  {selected.kind === 'staticText' ? (
                    <label className="block space-y-1">
                      <FieldLabel>Metin</FieldLabel>
                      <Field
                        disabled={!canEdit || selected.locked}
                        value={selected.text ?? ''}
                        onChange={(event) =>
                          updateElement(selected.id, { text: event.target.value })
                        }
                      />
                    </label>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <FieldLabel>Punto</FieldLabel>
                      <Field
                        disabled={!canEdit || selected.locked}
                        type="number"
                        value={selected.fontSize ?? 16}
                        onChange={(event) =>
                          updateElement(selected.id, { fontSize: Number(event.target.value) })
                        }
                      />
                    </label>
                    <label className="space-y-1">
                      <FieldLabel>Kalınlık</FieldLabel>
                      <Field
                        disabled={!canEdit || selected.locked}
                        type="number"
                        step={100}
                        value={selected.fontWeight ?? 400}
                        onChange={(event) =>
                          updateElement(selected.id, { fontWeight: Number(event.target.value) })
                        }
                      />
                    </label>
                  </div>
                  <label className="block space-y-1">
                    <FieldLabel>Yazı tipi</FieldLabel>
                    <Select
                      disabled={!canEdit || selected.locked}
                      value={selected.fontFamily ?? 'Arial'}
                      onChange={(event) =>
                        updateElement(selected.id, { fontFamily: event.target.value })
                      }
                    >
                      {FONT_GROUPS.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.fonts.map(([font]) => (
                            <option
                              key={font}
                              value={font}
                              style={{ fontFamily: certificateFontStack(font) }}
                            >
                              {font}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <FieldLabel>Satır aralığı</FieldLabel>
                      <Field
                        disabled={!canEdit || selected.locked}
                        type="number"
                        min={0.5}
                        max={5}
                        step={0.05}
                        value={selected.lineHeight ?? 1.15}
                        onChange={(event) =>
                          updateElement(selected.id, { lineHeight: Number(event.target.value) })
                        }
                      />
                    </label>
                    <label className="space-y-1">
                      <FieldLabel>Harf aralığı</FieldLabel>
                      <Field
                        disabled={!canEdit || selected.locked}
                        type="number"
                        min={-20}
                        max={100}
                        step={0.5}
                        value={selected.letterSpacing ?? 0}
                        onChange={(event) =>
                          updateElement(selected.id, { letterSpacing: Number(event.target.value) })
                        }
                      />
                    </label>
                  </div>
                  <label className="block space-y-1">
                    <FieldLabel>Renk</FieldLabel>
                    <Field
                      disabled={!canEdit || selected.locked}
                      type="color"
                      value={selected.color ?? '#111111'}
                      onChange={(event) =>
                        updateElement(selected.id, { color: event.target.value })
                      }
                    />
                  </label>
                  <label className="block space-y-1">
                    <FieldLabel>Hizalama</FieldLabel>
                    <Select
                      disabled={!canEdit || selected.locked}
                      value={selected.align ?? 'center'}
                      onChange={(event) =>
                        updateElement(selected.id, {
                          align: event.target.value as CertificateElement['align'],
                        })
                      }
                    >
                      <option value="left">Sol</option>
                      <option value="center">Orta</option>
                      <option value="right">Sağ</option>
                    </Select>
                  </label>
                  <label className="block space-y-1">
                    <FieldLabel>Taşma davranışı</FieldLabel>
                    <Select
                      disabled={!canEdit || selected.locked}
                      value={selected.fit ?? 'cover'}
                      onChange={(event) =>
                        updateElement(selected.id, {
                          fit: event.target.value as CertificateElement['fit'],
                        })
                      }
                    >
                      <option value="cover">Kırp</option>
                      <option value="shrink">Sığana kadar küçült</option>
                    </Select>
                  </label>
                  {selected.fit === 'shrink' ? (
                    <label className="block space-y-1">
                      <FieldLabel>En küçük punto</FieldLabel>
                      <Field
                        disabled={!canEdit || selected.locked}
                        type="number"
                        min={1}
                        max={300}
                        value={selected.minFontSize ?? 12}
                        onChange={(event) =>
                          updateElement(selected.id, { minFontSize: Number(event.target.value) })
                        }
                      />
                    </label>
                  ) : null}
                </>
              ) : null}
              {selected.kind === 'image' ? (
                <>
                  <label className="border-border text-secondary-foreground inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border px-3 text-[13px]">
                    <ImagePlus className="h-4 w-4" /> Görsel yükle
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/*"
                      disabled={!canEdit || selected.locked}
                      onChange={(event) => void uploadElementImage(event.target.files?.[0])}
                    />
                  </label>
                  <label className="block space-y-1">
                    <FieldLabel>Görsel yerleşimi</FieldLabel>
                    <Select
                      disabled={!canEdit || selected.locked}
                      value={selected.fit ?? 'cover'}
                      onChange={(event) =>
                        updateElement(selected.id, {
                          fit: event.target.value as CertificateElement['fit'],
                        })
                      }
                    >
                      <option value="cover">Alanı doldur</option>
                      <option value="contain">Tamamını göster</option>
                    </Select>
                  </label>
                </>
              ) : null}
              {selected.kind === 'shape' ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <FieldLabel>Dolgu</FieldLabel>
                    <Field
                      disabled={!canEdit || selected.locked}
                      type="color"
                      value={selected.backgroundColor ?? '#ddd6fe'}
                      onChange={(event) =>
                        updateElement(selected.id, { backgroundColor: event.target.value })
                      }
                    />
                  </label>
                  <label className="space-y-1">
                    <FieldLabel>Çerçeve</FieldLabel>
                    <Field
                      disabled={!canEdit || selected.locked}
                      type="color"
                      value={selected.borderColor ?? '#8b5cf6'}
                      onChange={(event) =>
                        updateElement(selected.id, { borderColor: event.target.value })
                      }
                    />
                  </label>
                  <label className="space-y-1">
                    <FieldLabel>Çerçeve kalınlığı</FieldLabel>
                    <Field
                      disabled={!canEdit || selected.locked}
                      type="number"
                      min={0}
                      max={100}
                      value={selected.borderWidth ?? 0}
                      onChange={(event) =>
                        updateElement(selected.id, { borderWidth: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label className="space-y-1">
                    <FieldLabel>Köşe</FieldLabel>
                    <Field
                      disabled={!canEdit || selected.locked}
                      type="number"
                      min={0}
                      max={2000}
                      value={selected.borderRadius ?? 0}
                      onChange={(event) =>
                        updateElement(selected.id, { borderRadius: Number(event.target.value) })
                      }
                    />
                  </label>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <FieldLabel>Döndürme</FieldLabel>
                  <Field
                    disabled={!canEdit || selected.locked}
                    type="number"
                    min={-360}
                    max={360}
                    value={selected.rotation ?? 0}
                    onChange={(event) =>
                      updateElement(selected.id, { rotation: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="space-y-1">
                  <FieldLabel>Saydamlık</FieldLabel>
                  <Field
                    disabled={!canEdit || selected.locked}
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={selected.opacity ?? 1}
                    onChange={(event) =>
                      updateElement(selected.id, { opacity: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
              {!REQUIRED_KINDS.includes(selected.kind) ? (
                <>
                  <button
                    type="button"
                    disabled={lastVerifier(elements, selected)}
                    aria-describedby={
                      lastVerifier(elements, selected) ? 'last-verifier-note' : undefined
                    }
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 flex h-8 w-full items-center justify-center gap-2 rounded-md border text-[13px]/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                    onClick={() => {
                      deleteElement(selected);
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Katmanı sil
                  </button>
                  {lastVerifier(elements, selected) ? (
                    <p id="last-verifier-note" className="text-subtle-foreground text-[13px]/5">
                      {LAST_VERIFIER}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-subtle-foreground text-[13px]/5">Zorunlu katman</p>
              )}
            </>
          ) : (
            <div role="group" aria-label="Arka plan" className="space-y-3">
              <p className="text-secondary-foreground text-[13px]/5 font-semibold">Arka plan</p>
              {backgroundIsImage && backgroundUnsized ? (
                <p className="text-subtle-foreground text-[13px]/5">Görselin boyutu okunamadı.</p>
              ) : null}
              {sizable && !placementDropped ? (
                <>
                  <label className="block space-y-1">
                    <FieldLabel>Yerleşim</FieldLabel>
                    <Select
                      disabled={!canEdit}
                      value={placement.fit}
                      onChange={(event) =>
                        updatePlacement({ fit: event.target.value as BackgroundFit })
                      }
                    >
                      {(Object.keys(FIT_LABELS) as BackgroundFit[]).map((fit) => (
                        <option key={fit} value={fit}>
                          {FIT_LABELS[fit]}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <div className="space-y-1">
                    <FieldLabel>Konum</FieldLabel>
                    <div className="flex items-center gap-2">
                      <div role="group" aria-label="Konum" className="grid grid-cols-3 gap-1">
                        {POSITIONS.map(([x, y, label]) => (
                          <button
                            key={label}
                            type="button"
                            aria-label={label}
                            aria-pressed={placement.x === x && placement.y === y}
                            disabled={!canEdit || placement.fit === 'fill'}
                            className="border-border-strong hover:bg-accent aria-pressed:bg-skylab-500/30 aria-pressed:border-skylab-400 focus-visible:ring-skylab-500/60 size-6 rounded border outline-none focus-visible:ring-2 disabled:opacity-40"
                            onClick={() => updatePlacement({ x, y })}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={!canEdit || placement.fit === 'fill'}
                        className="border-border text-muted-foreground hover:bg-accent h-7 rounded border px-2 text-[13px] disabled:opacity-40"
                        onClick={() => updatePlacement({ x: 0.5, y: 0.5 })}
                      >
                        Ortala
                      </button>
                    </div>
                  </div>
                  <label className="block space-y-1">
                    <FieldLabel>Ölçek (%)</FieldLabel>
                    <Field
                      disabled={!canEdit || placement.fit === 'fill'}
                      type="number"
                      min={10}
                      max={1000}
                      step={5}
                      value={
                        placement.fit === 'fill'
                          ? 100
                          : Math.round(storedPlacement.scale * 1000) / 10
                      }
                      onChange={(event) =>
                        updatePlacement({ scale: Number(event.target.value) / 100 })
                      }
                      onBlur={() => updatePlacement({ scale: placement.scale })}
                    />
                  </label>
                </>
              ) : null}
              {sizable ? (
                <>
                  <button
                    type="button"
                    disabled={!canEdit || !fittedPage}
                    aria-describedby={backgroundSize && !fittedPage ? 'fit-page-note' : undefined}
                    className="border-border text-secondary-foreground hover:bg-accent flex h-8 w-full items-center justify-center rounded-md border text-[13px]/5 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={fitPage}
                  >
                    Sayfayı arka plana uydur
                  </button>
                  {backgroundSize && !fittedPage ? (
                    <p id="fit-page-note" className="text-subtle-foreground text-[13px]/5">
                      Oran 300–4000 px sınırına sığmıyor.
                    </p>
                  ) : null}
                </>
              ) : null}
              {backgroundUrl ? (
                <button
                  type="button"
                  disabled={!canEdit}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 flex h-8 w-full items-center justify-center gap-2 rounded-md border text-[13px]/5 disabled:opacity-50"
                  onClick={removeBackground}
                >
                  <Trash2 className="h-4 w-4" /> Arka planı kaldır
                </button>
              ) : null}
              <label className="block space-y-1">
                <FieldLabel>Arka plan rengi</FieldLabel>
                <Field
                  disabled={!canEdit}
                  type="color"
                  value={draft.layout.backgroundColor}
                  onChange={(event) => updateLayout({ backgroundColor: event.target.value })}
                />
              </label>
            </div>
          )}
        </aside>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {pdfProblem ? (
        <p className="border-warning/30 bg-warning/5 text-warning rounded-md border px-3 py-2 text-[13px]/5">
          {pdfProblem.message}
        </p>
      ) : null}
      {placementDropped ? (
        <p className="border-warning/30 bg-warning/5 text-warning rounded-md border px-3 py-2 text-[13px]/5">
          {PLACEMENT_DROPPED}
        </p>
      ) : null}
      {fitNote ? (
        <p role="status" className="text-skylab-300 text-sm">
          Sayfa arka plana uyduruldu ({pageSize(fitNote.before)} → {pageSize(fitNote.after)})
          {draft.layout === fitNote.after ? (
            <>
              {' · '}
              <button
                type="button"
                className="hover:text-foreground underline underline-offset-2"
                onClick={undoFit}
              >
                Geri al
              </button>
            </>
          ) : null}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-skylab-300 text-sm">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <ActionButton
          icon={Eye}
          label="PDF önizle"
          showLabel
          disabled={busy}
          onClick={() => void preview()}
        />
        {canEdit ? (
          <span className="hidden gap-2 lg:flex">
            <SaveButton type="button" disabled={busy} onClick={() => void save()}>
              <Save className="h-4 w-4" /> Taslağı kaydet
            </SaveButton>
            <SaveButton type="button" disabled={busy} onClick={() => void publish()}>
              <Send className="h-4 w-4" /> Kaydet ve yayınla
            </SaveButton>
          </span>
        ) : null}
      </div>
    </div>
  );
}
