'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
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
import { StateCard } from '@/components/chrome/StateCard';
import {
  certificatesApi,
  type CertificateElement,
  type CertificateElementKind,
  type CertificateLayout,
  type CertificateTemplateDraft,
} from '@/lib/api/certificates';
import { ProblemError } from '@/lib/api/core';
import { mediaApi } from '@/lib/api/media';
import { publicMediaUrl } from '@/lib/event-media';
import { useAuth } from '@/context/AuthContext';
import {
  canEditCertificateTemplateForTeam,
  canManageCertificateTemplates,
} from '@/lib/auth/groups';

const ELEMENT_LABELS: Record<CertificateElementKind, string> = {
  staticText: 'Sabit metin',
  recipientName: 'Katılımcı adı',
  eventName: 'Etkinlik adı',
  eventDates: 'Etkinlik tarihi',
  issueDate: 'Verilme tarihi',
  ownerTeam: 'Sahip ekip',
  serial: 'Sertifika kodu',
  verificationQr: 'Doğrulama QR',
  image: 'Görsel',
  shape: 'Şekil',
};

const SAMPLE: Record<CertificateElementKind, string> = {
  staticText: 'Metin',
  recipientName: 'Ada Lovelace',
  eventName: 'SKY LAB Etkinliği',
  eventDates: '19.09.2026',
  issueDate: '21.09.2026',
  ownerTeam: 'SKY LAB',
  serial: 'A1B2C3D4E5F6',
  verificationQr: '',
  image: '',
  shape: '',
};

const PAGE_PRESETS = {
  a4Landscape: { label: 'A4 yatay', width: 1123, height: 794, orientation: 'landscape' },
  a4Portrait: { label: 'A4 dikey', width: 794, height: 1123, orientation: 'portrait' },
  letterLandscape: { label: 'US Letter yatay', width: 1056, height: 816, orientation: 'landscape' },
  letterPortrait: { label: 'US Letter dikey', width: 816, height: 1056, orientation: 'portrait' },
} as const;

const BACKGROUND_FILE_TYPES = 'image/png,image/jpeg,image/webp,image/svg+xml,application/pdf,.pdf';

const FONT_GROUPS = [
  {
    label: 'Sans serif',
    fonts: [
      ['Arial', "'Liberation Sans', Arial, sans-serif"],
      ['Helvetica', "'Liberation Sans', Helvetica, sans-serif"],
      ['Carlito', "Carlito, 'Liberation Sans', sans-serif"],
      ['Noto Sans', "'Noto Sans', 'DejaVu Sans', sans-serif"],
      ['Noto Sans Display', "'Noto Sans Display', 'Noto Sans', sans-serif"],
      ['DejaVu Sans', "'DejaVu Sans', 'Liberation Sans', sans-serif"],
      ['DejaVu Sans Condensed', "'DejaVu Sans Condensed', 'DejaVu Sans', sans-serif"],
      ['Liberation Sans', "'Liberation Sans', Arial, sans-serif"],
    ],
  },
  {
    label: 'Serif',
    fonts: [
      ['Georgia', "'Liberation Serif', Georgia, serif"],
      ['Times New Roman', "'Liberation Serif', 'Times New Roman', serif"],
      ['Caladea', "Caladea, 'Liberation Serif', serif"],
      ['Noto Serif', "'Noto Serif', 'DejaVu Serif', serif"],
      ['Noto Serif Display', "'Noto Serif Display', 'Noto Serif', serif"],
      ['DejaVu Serif', "'DejaVu Serif', 'Liberation Serif', serif"],
      ['DejaVu Serif Condensed', "'DejaVu Serif Condensed', 'DejaVu Serif', serif"],
      ['Liberation Serif', "'Liberation Serif', 'Times New Roman', serif"],
    ],
  },
  {
    label: 'Monospace',
    fonts: [
      ['Courier New', "'Liberation Mono', 'Courier New', monospace"],
      ['DejaVu Sans Mono', "'DejaVu Sans Mono', 'Liberation Mono', monospace"],
      ['Liberation Mono', "'Liberation Mono', 'Courier New', monospace"],
    ],
  },
] as const;

function certificateFontStack(font?: string) {
  for (const group of FONT_GROUPS) {
    const match = group.fonts.find(([name]) => name === font);
    if (match) return match[1];
  }
  return "'Liberation Sans', Arial, sans-serif";
}

function currentPreset(layout: CertificateLayout) {
  return (
    Object.entries(PAGE_PRESETS).find(
      ([, preset]) => preset.width === layout.width && preset.height === layout.height,
    )?.[0] ?? 'custom'
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
  const [selectedId, setSelectedId] = useState<string>();
  const [backgroundUrl, setBackgroundUrl] = useState<string>();
  const [backgroundType, setBackgroundType] = useState<string>();
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(Boolean(templateId));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const canEdit = templateId
    ? canEditCertificateTemplateForTeam(user?.groups ?? [], user?.roles ?? [], draft.ownerTeam)
    : canManageCertificateTemplates(user?.groups ?? [], user?.roles ?? []);

  const selected = useMemo(
    () => draft.layout.elements.find((element) => element.id === selectedId),
    [draft.layout.elements, selectedId],
  );
  const externalSource = draft.sourceKind === 'canva' || draft.sourceKind === 'figma';
  const sourceName = draft.sourceKind === 'canva' ? 'Canva' : 'Figma';
  const backgroundIsPDF = backgroundType === 'application/pdf';

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
        if (
          !selected ||
          selected.locked ||
          ['recipientName', 'eventName', 'verificationQr'].includes(selected.kind)
        ) {
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
  }, [canEdit, selected, selectedId]);

  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    certificatesApi
      .template(templateId)
      .then(async (template) => {
        if (cancelled) return;
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
        if (!cancelled)
          setError(cause instanceof ProblemError ? cause.title : 'Şablon yüklenemedi');
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
    const scaleX = preset.width / draft.layout.width;
    const scaleY = preset.height / draft.layout.height;
    const fontScale = Math.min(scaleX, scaleY);
    updateLayout({
      width: preset.width,
      height: preset.height,
      orientation: preset.orientation,
      elements: draft.layout.elements.map((element) => ({
        ...element,
        x: Math.round(element.x * scaleX),
        y: Math.round(element.y * scaleY),
        width: Math.round(element.width * scaleX),
        height: Math.round(element.height * scaleY),
        fontSize: element.fontSize ? Math.max(1, Math.round(element.fontSize * fontScale)) : 0,
      })),
    });
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
    if (!canEdit || ['recipientName', 'eventName', 'verificationQr'].includes(element.kind)) return;
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

  async function uploadBackground(file?: File) {
    if (!file || !canEdit) return;
    setBusy(true);
    try {
      const media = await mediaApi.upload(file);
      updateLayout({ backgroundMediaId: media.id });
      setBackgroundUrl(publicMediaUrl(media.url));
      setBackgroundType(media.type);
      setMessage(
        media.type === 'application/pdf'
          ? 'PDF arka planı yüklendi. Vektörel taban korunacak; dinamik katmanlar üstüne işlenecek.'
          : 'Arka plan yüklendi. Kaydettikten sonra yeni sürümü yayınlayabilirsin.',
      );
    } catch (cause) {
      setError(cause instanceof ProblemError ? cause.title : 'Arka plan yüklenemedi');
    } finally {
      setBusy(false);
    }
  }

  async function uploadElementImage(file?: File) {
    if (!file || !selected || !canEdit) return;
    setBusy(true);
    try {
      const media = await mediaApi.upload(file);
      updateElement(selected.id, { kind: 'image', mediaId: media.id, fit: 'contain' });
      setImageUrls((current) => ({ ...current, [media.id]: publicMediaUrl(media.url) }));
    } catch (cause) {
      setError(cause instanceof ProblemError ? cause.title : 'Görsel yüklenemedi');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!canEdit) {
      setError('Bu şablonu düzenleme yetkin yok.');
      return undefined;
    }
    setBusy(true);
    setError(undefined);
    try {
      const template = savedId
        ? await certificatesApi.updateTemplate(savedId, draft)
        : await certificatesApi.createTemplate(draft);
      setSavedId(template.id);
      setMessage('Taslak kaydedildi. Verilen sertifikaları etkilemesi için yayınla.');
      if (!savedId) router.replace(`/certificates/templates/${template.id}`);
      return template.id;
    } catch (cause) {
      setError(cause instanceof ProblemError ? cause.title : 'Şablon kaydedilemedi');
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    const id = await save();
    if (!id) return;
    setBusy(true);
    try {
      const version = await certificatesApi.publishTemplate(id);
      setMessage(`Sürüm ${version.version} yayınlandı. Yeni işler bu sürümü kullanacak.`);
    } catch (cause) {
      setError(cause instanceof ProblemError ? cause.title : 'Şablon yayınlanamadı');
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    const id = canEdit ? await save() : savedId;
    if (!id) return;
    setBusy(true);
    try {
      const blob = await certificatesApi.previewTemplate(id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setError(cause instanceof ProblemError ? cause.title : 'Önizleme üretilemedi');
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

  if (loading) return <StateCard title="Şablon yükleniyor…" isLoading />;
  if (error && templateId && !savedId) return <StateCard title={error} tone="danger" />;

  return (
    <div className="space-y-5">
      {!canEdit ? (
        <p className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
          Bu şablon salt okunur. Önizleyebilirsin; yeni sürüm yayınlamak için şablon yönetim yetkisi
          gerekir.
        </p>
      ) : null}
      <div className="grid gap-3 rounded-xl border border-white/10 bg-neutral-950/40 p-4 lg:grid-cols-4">
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
            {currentPreset(draft.layout) === 'custom' ? <option value="custom">Özel</option> : null}
          </Select>
        </label>
        {externalSource ? (
          <div className="border-skylab-400/15 bg-skylab-500/5 space-y-4 rounded-lg border p-4 lg:col-span-4">
            <div>
              <p className="text-sm font-semibold text-neutral-100">
                {sourceName} tasarımını bağla
              </p>
              <p className="mt-1 text-xs leading-5 text-neutral-400">
                {sourceName} bağlantısı tasarımı otomatik olarak içe aktarmaz. Bağlantı, özgün
                tasarımı daha sonra tekrar açabilmen için saklanır. Sertifikada görünmesi için
                tasarımı dışa aktarıp aşağıdan yüklemelisin.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2 rounded-lg border border-white/8 bg-black/10 p-3">
                <p className="text-3xs font-semibold tracking-[0.16em] text-neutral-500 uppercase">
                  1 · Düzenleme bağlantısı
                </p>
                <label className="block space-y-1.5">
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
                    className="text-skylab-300 hover:text-skylab-200 inline-flex items-center gap-1.5 text-xs"
                    href={draft.sourceEditUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> {sourceName}&apos;da düzenle
                  </a>
                ) : (
                  <p className="text-3xs text-neutral-500">
                    İsteğe bağlı; paylaşılabilir düzenleme bağlantısını yapıştır.
                  </p>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-white/8 bg-black/10 p-3">
                <p className="text-3xs font-semibold tracking-[0.16em] text-neutral-500 uppercase">
                  2 · Tasarımı dışa aktar
                </p>
                <p className="text-xs leading-5 text-neutral-300">
                  {sourceName}&apos;da PNG, JPG, SVG veya tek sayfalık PDF olarak indir. Katılımcı
                  adı, etkinlik adı ve QR için tasarımda boş alan bırak.
                </p>
              </div>

              <div className="space-y-2 rounded-lg border border-white/8 bg-black/10 p-3">
                <p className="text-3xs font-semibold tracking-[0.16em] text-neutral-500 uppercase">
                  3 · Export dosyasını yükle
                </p>
                <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-white/10 px-3 text-xs text-neutral-200 hover:bg-white/5">
                  <ImagePlus className="h-4 w-4" /> {sourceName} exportunu yükle
                  <input
                    className="sr-only"
                    type="file"
                    accept={BACKGROUND_FILE_TYPES}
                    disabled={busy || !canEdit}
                    onChange={(event) => void uploadBackground(event.target.files?.[0])}
                  />
                </label>
                <p
                  className={`text-3xs ${backgroundUrl ? 'text-emerald-300' : 'text-neutral-500'}`}
                >
                  {backgroundUrl
                    ? backgroundIsPDF
                      ? 'PDF arka planı hazır; final dosyada vektörel olarak korunacak.'
                      : 'Arka plan hazır; aşağıdaki tuvalde görüntüleniyor.'
                    : 'Henüz bir export dosyası yüklenmedi.'}
                </p>
                {backgroundIsPDF ? (
                  <p className="text-3xs leading-4 text-neutral-500">
                    PDF&apos;in kendi öğeleri kilitli tabandır; SKY LAB metinleri, görselleri ve QR
                    katmanları ayrı ayrı düzenlenir.
                  </p>
                ) : null}
              </div>
            </div>

            <details className="text-3xs text-neutral-500">
              <summary className="cursor-pointer select-none">Gelişmiş kaynak bilgileri</summary>
              <label className="mt-2 block max-w-md space-y-1.5">
                <FieldLabel>Kaynak kimliği</FieldLabel>
                <Field
                  disabled={!canEdit}
                  value={draft.sourceRef}
                  placeholder="İsteğe bağlı Canva design id veya Figma node"
                  onChange={(event) => setDraft({ ...draft, sourceRef: event.target.value })}
                />
              </label>
            </details>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/8 bg-black/10 p-3 lg:col-span-4">
            <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-white/10 px-3 text-xs text-neutral-200 hover:bg-white/5">
              <ImagePlus className="h-4 w-4" /> Arka plan görseli yükle
              <input
                className="sr-only"
                type="file"
                accept={BACKGROUND_FILE_TYPES}
                disabled={busy || !canEdit}
                onChange={(event) => void uploadBackground(event.target.files?.[0])}
              />
            </label>
            <span className="text-3xs text-neutral-500">
              PNG/JPG/SVG veya tek sayfalık PDF yükleyebilir ya da boş tuvalle devam edebilirsin.
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_260px]">
        <aside className="space-y-3 rounded-xl border border-white/10 bg-neutral-950/40 p-3">
          <p className="text-xs font-semibold text-neutral-200">Katman ekle</p>
          {(Object.keys(ELEMENT_LABELS) as CertificateElementKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => addElement(kind)}
              disabled={!canEdit}
              className="flex w-full items-center gap-2 rounded-md border border-white/5 px-2.5 py-2 text-left text-xs text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
            >
              <Plus className="h-3.5 w-3.5" /> {ELEMENT_LABELS[kind]}
            </button>
          ))}
          <div className="border-t border-white/10 pt-3">
            <p className="mb-2 text-xs font-semibold text-neutral-200">Katmanlar</p>
            <div className="space-y-1">
              {draft.layout.elements.map((element) => (
                <button
                  key={element.id}
                  type="button"
                  onClick={() => setSelectedId(element.id)}
                  className={`w-full truncate rounded-md px-2 py-1.5 text-left text-xs ${selectedId === element.id ? 'bg-skylab-500/15 text-skylab-300' : 'text-neutral-500 hover:bg-white/5'}`}
                >
                  {ELEMENT_LABELS[element.kind]} {element.locked ? '· kilitli' : ''}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="min-w-0 overflow-auto rounded-xl border border-white/10 bg-neutral-950/60 p-4">
          <div
            ref={canvasRef}
            className="relative mx-auto w-full max-w-[1123px] overflow-hidden bg-white shadow-2xl"
            style={{
              aspectRatio: `${draft.layout.width} / ${draft.layout.height}`,
              containerType: 'inline-size',
              backgroundColor: draft.layout.backgroundColor,
              backgroundImage:
                backgroundUrl && !backgroundIsPDF ? `url(${backgroundUrl})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            onPointerMove={moveDrag}
            onPointerUp={() => (dragRef.current = null)}
            onPointerCancel={() => (dragRef.current = null)}
          >
            {backgroundIsPDF && backgroundUrl ? (
              <object
                title="PDF arka plan önizlemesi"
                data={`${backgroundUrl}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
                type="application/pdf"
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
                  className={`absolute z-10 flex touch-none items-center justify-center overflow-hidden whitespace-nowrap ${element.locked ? 'cursor-not-allowed' : 'cursor-move'} ${selectedId === element.id ? 'ring-skylab-400/60 ring-2' : 'hover:ring-1 hover:ring-black/25'} ${element.kind === 'verificationQr' ? 'bg-[repeating-conic-gradient(#111_0_25%,#fff_0_50%)] bg-[length:18px_18px]' : ''}`}
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
          <p className="text-3xs mt-3 text-center text-neutral-500">
            Katmanı seçip sürükle. Kesin ölçüler sağ panelden değişir. PDF seçilen sayfa ölçüsünde
            üretilir.
          </p>
        </section>

        <aside className="space-y-3 rounded-xl border border-white/10 bg-neutral-950/40 p-3">
          <p className="text-xs font-semibold text-neutral-200">Özellikler</p>
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
                    className="text-3xs h-7 rounded border border-white/10 px-1 text-neutral-400 hover:bg-white/5 disabled:opacity-40"
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
                  <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-white/10 px-3 text-xs text-neutral-200">
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
              {!['recipientName', 'eventName', 'verificationQr'].includes(selected.kind) ? (
                <button
                  type="button"
                  className="flex h-8 w-full items-center justify-center gap-2 rounded-md border border-red-500/20 text-xs text-red-300 hover:bg-red-500/10"
                  onClick={() => {
                    deleteElement(selected);
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Katmanı sil
                </button>
              ) : (
                <p className="text-3xs text-neutral-500">
                  Bu alan geçerli sertifika için zorunludur.
                </p>
              )}
            </>
          ) : (
            <p className="text-xs leading-relaxed text-neutral-500">
              Düzenlemek için bir katman seç.
            </p>
          )}
          <label className="block space-y-1 border-t border-white/10 pt-3">
            <FieldLabel>Arka plan rengi</FieldLabel>
            <Field
              disabled={!canEdit}
              type="color"
              value={draft.layout.backgroundColor}
              onChange={(event) => updateLayout({ backgroundColor: event.target.value })}
            />
          </label>
        </aside>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
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
          disabled={busy}
          onClick={() => void preview()}
        />
        {canEdit ? (
          <>
            <SaveButton type="button" disabled={busy} onClick={() => void save()}>
              <Save className="h-4 w-4" /> Taslağı kaydet
            </SaveButton>
            <SaveButton type="button" disabled={busy} onClick={() => void publish()}>
              <Send className="h-4 w-4" /> Kaydet ve yayınla
            </SaveButton>
          </>
        ) : null}
      </div>
    </div>
  );
}
