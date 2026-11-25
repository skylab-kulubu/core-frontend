'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Upload } from 'lucide-react';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton, saveClass } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import { ProblemError } from '@/lib/api/core';
import {
  ticketImageApi,
  type TicketImage,
  type TicketImageBody,
  type TicketImageCrop,
  type TicketImageSource,
} from '@/lib/api/ticket-image';
import { coreProblemMessage } from '@/lib/core-problems';
import { publicMediaUrl, type EventMediaHint } from '@/lib/event-media';
import { uploadMediaBatch } from '@/lib/media-upload-batch';
import {
  BAND_HEIGHT_MM,
  BAND_WIDTH_MM,
  MAX_ZOOM,
  centreOf,
  cropAt,
  cropFits,
  fullCrop,
  imagePlacement,
  moveCrop,
  zoomOf,
} from '@/lib/ticket-image-crop';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';

const SOURCES: { value: TicketImageSource; label: string; hint: string }[] = [
  { value: 'auto', label: 'Otomatik', hint: 'Kapağın ortası.' },
  { value: 'cover', label: 'Kapaktan bir bölüm', hint: 'Kapağın gösterilecek bölümünü seç.' },
  { value: 'upload', label: 'Ayrı görsel', hint: 'Logo ya da afiş yükle, bölümünü seç.' },
];

type EventTicketImageFieldsProps = {
  /** The Event's id; a new Event that is not saved yet answers 404. */
  eventId?: string;
  /** The cover in the form. */
  coverImageId: string;
  /** Addresses of images the page knows (the saved cover). */
  knownMedia?: EventMediaHint[];
};

type Draft = {
  source: TicketImageSource;
  mediaId?: string;
  mediaUrl?: string;
  crop?: TicketImageCrop;
};

function draftOf(saved: TicketImage): Draft {
  return {
    source: saved.source,
    mediaId: saved.mediaId,
    mediaUrl: saved.mediaUrl,
    crop: saved.crop,
  };
}

function bodyOf(draft: Draft, coverImageId: string): TicketImageBody {
  if (draft.source === 'cover') {
    return { source: 'cover', coverMediaId: coverImageId, crop: draft.crop };
  }
  if (draft.source === 'upload') {
    return { source: 'upload', mediaId: draft.mediaId, crop: draft.crop };
  }
  return { source: 'auto' };
}

/**
 * The PDF ticket's band (core docs/ticket-image.md): the cover's middle, a region of the cover,
 * or a region of an image of its own. Saved on its own, apart from the form's bar.
 */
export function EventTicketImageFields({
  eventId,
  coverImageId,
  knownMedia = [],
}: EventTicketImageFieldsProps) {
  const [saved, setSaved] = useState<TicketImage | null>(null);
  const [draft, setDraft] = useState<Draft>({ source: 'auto' });
  const [state, setState] = useState<'loading' | 'ready' | 'unsaved' | 'failed'>('loading');
  const [natural, setNatural] = useState<{ src: string; w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!eventId) {
      setState('unsaved');
      return;
    }
    let cancelled = false;
    setState('loading');
    ticketImageApi
      .get(eventId)
      .then((answer) => {
        if (cancelled) return;
        setSaved(answer);
        setDraft(draftOf(answer));
        setState('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState(err instanceof ProblemError && err.status === 404 ? 'unsaved' : 'failed');
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const coverUrl = publicMediaUrl(knownMedia.find((row) => row.id === coverImageId)?.url);
  const src =
    draft.source === 'upload'
      ? publicMediaUrl(draft.mediaUrl)
      : draft.source === 'cover' || draft.source === 'auto'
        ? coverUrl
        : '';
  const size = natural && natural.src === src ? natural : null;
  // A crop drawn on another image (or none yet) starts as the widest strip.
  const crop: TicketImageCrop | undefined = size
    ? draft.source === 'auto'
      ? fullCrop(size.w, size.h)
      : cropFits(draft.crop, size.w, size.h)
        ? draft.crop
        : fullCrop(size.w, size.h)
    : undefined;
  // Until the image loads its crop is the saved one.
  const dirty =
    saved !== null &&
    JSON.stringify(bodyOf({ ...draft, crop: crop ?? draft.crop }, coverImageId)) !==
      JSON.stringify(bodyOf(draftOf(saved), saved.coverMediaId ?? coverImageId));

  if (state === 'loading') {
    return <Shell>Yükleniyor…</Shell>;
  }
  if (state === 'unsaved') {
    return <Shell>Etkinlik kaydedilince seçilir.</Shell>;
  }
  if (state === 'failed' || !eventId) {
    return <Shell>Bilet görseli yüklenemedi.</Shell>;
  }

  async function upload(file: File) {
    setBusy(true);
    setNote('');
    try {
      const { uploaded, refused, stopped } = await uploadMediaBatch([file], 'event_cover');
      const row = uploaded[0];
      if (row) {
        setDraft({ source: 'upload', mediaId: row.id, mediaUrl: row.url });
      } else {
        setNote(refused[0]?.message ?? stopped?.message ?? 'Yüklenemedi');
      }
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!eventId) return;
    setBusy(true);
    setNote('');
    try {
      const body = bodyOf({ ...draft, crop }, coverImageId);
      const answer = await ticketImageApi.save(eventId, body);
      setSaved(answer);
      setDraft(draftOf(answer));
      setNote('Kaydedildi.');
    } catch (err) {
      setNote(coreProblemMessage(err, 'Kaydedilemedi'));
    } finally {
      setBusy(false);
    }
  }

  const hint = SOURCES.find((row) => row.value === draft.source)?.hint;
  const missing =
    draft.source === 'upload'
      ? !draft.mediaId || !crop
      : draft.source === 'cover'
        ? !coverImageId || !coverUrl || !crop
        : false;

  return (
    <div className="space-y-2" data-slot="ticket-image">
      <label className="block space-y-1">
        <FieldLabel>Bilet görseli</FieldLabel>
        <Select
          value={draft.source}
          onChange={(e) => {
            const source = e.target.value as TicketImageSource;
            setNote('');
            setDraft((prev) =>
              source === 'upload'
                ? {
                    source,
                    mediaId: prev.mediaId ?? saved?.mediaId,
                    mediaUrl: prev.mediaUrl ?? saved?.mediaUrl,
                  }
                : { source, crop: source === saved?.source ? saved.crop : undefined },
            );
          }}
          aria-label="Bilet görseli kaynağı"
          aria-describedby="bilet-gorseli-ipucu"
        >
          {SOURCES.map((row) => (
            <option key={row.value} value={row.value}>
              {row.label}
            </option>
          ))}
        </Select>
        <span id="bilet-gorseli-ipucu" className={`text-subtle-foreground block ${TEXT_SECONDARY}`}>
          PDF biletin üstündeki şerit ({BAND_WIDTH_MM} × {BAND_HEIGHT_MM} mm). {hint}
        </span>
      </label>
      {draft.source === 'upload' ? (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            aria-label="Bilet görseli seç"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void upload(file);
            }}
          />
          <button
            type="button"
            className={saveClass}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            {draft.mediaId ? 'Başka görsel yükle' : 'Görsel yükle'}
          </button>
        </div>
      ) : null}
      {src ? (
        <BandCropper
          src={src}
          crop={crop}
          editable={draft.source !== 'auto'}
          onNatural={(w, h) => setNatural({ src, w, h })}
          onCrop={(next) => setDraft((prev) => ({ ...prev, crop: next }))}
          size={size}
        />
      ) : draft.source !== 'upload' ? (
        <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
          {coverImageId
            ? 'Kapak kaydedilince bölümü seçilir.'
            : 'Kapak yok: şerit etkinliğin rengini alır.'}
        </p>
      ) : null}
      {saved?.coverChanged && draft.source === 'cover' && !dirty ? (
        <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
          Kapak değişti: bilet yeni kapağın ortasını gösteriyor. Bölümü yeniden seçip kaydet.
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <SaveButton type="button" disabled={busy || !dirty || missing} onClick={() => void save()}>
          Bilet görselini kaydet
        </SaveButton>
        {note ? (
          <span role="status" className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
            {note}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Shell({ children }: { children: string }) {
  return (
    <div className="space-y-1" data-slot="ticket-image">
      <FieldLabel>Bilet görseli</FieldLabel>
      <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>{children}</p>
    </div>
  );
}

type BandCropperProps = {
  src: string;
  crop?: TicketImageCrop;
  size: { w: number; h: number } | null;
  editable: boolean;
  onNatural: (w: number, h: number) => void;
  onCrop: (crop: TicketImageCrop) => void;
};

/**
 * The band at its own shape showing the crop: drag to move it, the slider to zoom, the arrow keys
 * to nudge. What it shows is what the PDF prints.
 */
function BandCropper({ src, crop, size, editable, onNatural, onCrop }: BandCropperProps) {
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; crop: TicketImageCrop } | null>(null);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!editable || !crop) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, crop };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    const box = frame.current?.getBoundingClientRect();
    if (!start || !box || box.width <= 0 || box.height <= 0) return;
    const dx = (-(e.clientX - start.x) / box.width) * start.crop.w;
    const dy = (-(e.clientY - start.y) / box.height) * start.crop.h;
    onCrop(moveCrop(start.crop, dx, dy));
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!editable || !crop) return;
    const step = 0.05;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step * crop.w, 0],
      ArrowRight: [step * crop.w, 0],
      ArrowUp: [0, -step * crop.h],
      ArrowDown: [0, step * crop.h],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    onCrop(moveCrop(crop, move[0], move[1]));
  }

  const zoom = crop && size ? zoomOf(crop, size.w, size.h) : 1;

  return (
    <div className="space-y-2">
      <div
        ref={frame}
        data-slot="ticket-band"
        role={editable ? 'group' : undefined}
        aria-label={
          editable ? 'Bilet şeridi: sürükleyerek ya da ok tuşlarıyla kaydır' : 'Bilet şeridi'
        }
        tabIndex={editable ? 0 : undefined}
        className={`border-border bg-muted relative w-full touch-none overflow-hidden rounded-md border select-none ${
          editable ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        style={{ aspectRatio: `${BAND_WIDTH_MM} / ${BAND_HEIGHT_MM}` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={onKeyDown}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) => onNatural(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
          className="pointer-events-none absolute max-w-none"
          style={crop ? imagePlacement(crop) : { visibility: 'hidden' }}
        />
      </div>
      {editable && crop && size ? (
        <label className={`text-subtle-foreground flex items-center gap-3 ${TEXT_SECONDARY}`}>
          Yakınlaştır
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            className="w-48"
            onChange={(e) => {
              const { cx, cy } = centreOf(crop);
              onCrop(cropAt(size.w, size.h, Number(e.target.value), cx, cy));
            }}
          />
        </label>
      ) : null}
    </div>
  );
}
