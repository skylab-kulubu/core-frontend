'use client';

import {
  Badge,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Dropzone,
  IconButton,
  MenuItem,
  Notice,
  Progress,
} from '@skylab-kulubu/skylcn-ui';
import {
  ArrowDown,
  ArrowUp,
  FileArchive,
  FileText,
  ImagePlus,
  Images,
  ImageOff,
  Play,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { SectionHeading } from '@/components/chrome/PanelChart';
import { ProblemError } from '@/lib/api/core';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { mediaApi } from '@/lib/api/media';
import {
  eventMediaApi,
  type DirectUploadPurpose,
  type EventFile,
  type EventMediaKind,
  type EventVideo,
} from '@/lib/api/uploads';
import { teamEventPhotos, type TeamPhoto } from '@/lib/event-media';
import { pickerMatch } from '@/lib/picker';
import {
  directUpload,
  interruptedUploads,
  UploadError,
  type UploadProgress,
} from '@/lib/uploads/direct-upload';
import { formatBytes, scanResultMessage, uploadErrorMessage } from '@/lib/uploads/messages';

const GIB = 1024 ** 3;

type KindInfo = {
  purpose: DirectUploadPurpose;
  title: string;
  accept: string;
  maxBytes: number;
  hint: string;
  allowed: (file: File) => boolean;
  typeMessage: string;
};

const KINDS: Record<EventMediaKind, KindInfo> = {
  videos: {
    purpose: 'video',
    title: 'Videolar',
    accept: '.mp4,video/mp4',
    maxBytes: 2 * GIB,
    hint: 'MP4, en çok 2 GB',
    allowed: (file) => file.type === 'video/mp4' || /\.mp4$/i.test(file.name),
    typeMessage: 'Yalnız MP4 yüklenebilir.',
  },
  files: {
    purpose: 'club_file',
    title: 'Dosyalar',
    accept: '.pdf,.zip,application/pdf,application/zip',
    maxBytes: GIB,
    hint: 'PDF ya da ZIP, en çok 1 GB. Yüklendikten sonra virüs taramasından geçer.',
    allowed: (file) => /\.(pdf|zip)$/i.test(file.name),
    typeMessage: 'Yalnız PDF ya da ZIP yüklenebilir.',
  },
};

function problemMessage(error: unknown): string {
  if (error instanceof UploadError) return error.message;
  if (error instanceof ProblemError) return uploadErrorMessage(error.code, error.fields);
  return 'İşlem tamamlanamadı. Lütfen yeniden dene.';
}

/**
 * An Event's videos and files: organizers upload them straight to storage,
 * order, preview and remove them, and give each video a poster. Everyone else
 * sees only what can be served.
 */
export function EventFilesPanel({
  event,
  canEdit,
  onEvent,
}: {
  event: CoreEvent;
  canEdit: boolean;
  onEvent: (event: CoreEvent) => void;
}) {
  const videos = event.videos ?? [];
  const files = event.files ?? [];
  const scanning = [...videos, ...files].some(
    (item) => item.status === 'scanning' || item.status === 'pending',
  );

  // A file's scan runs in the background; read the Event again until it ends
  useEffect(() => {
    if (!scanning) return;
    const timer = window.setInterval(() => {
      eventsApi
        .get(event.id)
        .then(onEvent)
        .catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [scanning, event.id, onEvent]);

  if (!canEdit && videos.length === 0 && files.length === 0) return null;

  return (
    <div id="files" className="scroll-mt-24 space-y-6">
      <SectionHeading
        title="Dosyalar ve videolar"
        meta={`${videos.length} video · ${files.length} dosya`}
      />
      <MediaList kind="videos" items={videos} event={event} canEdit={canEdit} onEvent={onEvent} />
      <MediaList kind="files" items={files} event={event} canEdit={canEdit} onEvent={onEvent} />
    </div>
  );
}

type ActiveUpload = {
  key: string;
  name: string;
  progress?: UploadProgress;
  error?: string;
  /** A Media that uploaded but could not be added yet; it must be within 24 hours. */
  pendingMediaId?: string;
  controller: AbortController;
};

function MediaList({
  kind,
  items,
  event,
  canEdit,
  onEvent,
}: {
  kind: EventMediaKind;
  items: (EventFile | EventVideo)[];
  event: CoreEvent;
  canEdit: boolean;
  onEvent: (event: CoreEvent) => void;
}) {
  const info = KINDS[kind];
  const [uploads, setUploads] = useState<ActiveUpload[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<EventFile | null>(null);
  const [waiting, setWaiting] = useState<string[]>([]);
  // Uploads run one after another, so a batch never trips the three-open limit
  const queue = useRef<Promise<void>>(Promise.resolve());
  const eventId = useRef(event.id);
  eventId.current = event.id;

  useEffect(() => {
    setWaiting(interruptedUploads(info.purpose));
  }, [info.purpose]);

  const patch = (key: string, change: Partial<ActiveUpload> | null) =>
    setUploads((list) =>
      change === null
        ? list.filter((row) => row.key !== key)
        : list.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );

  async function attach(key: string, mediaId: string) {
    try {
      onEvent(await eventMediaApi.add(eventId.current, kind, [mediaId]));
      patch(key, null);
    } catch (error) {
      patch(key, { error: problemMessage(error), pendingMediaId: mediaId });
    }
  }

  function upload(picked: File[]) {
    setProblem(null);
    for (const file of picked) {
      const key = `${file.name}:${file.size}:${file.lastModified}:${Math.random()}`;
      const controller = new AbortController();
      const row: ActiveUpload = { key, name: file.name, controller };
      if (!info.allowed(file)) row.error = info.typeMessage;
      else if (file.size > info.maxBytes)
        row.error = `Dosya çok büyük (en çok ${formatBytes(info.maxBytes)}).`;
      setUploads((list) => [...list, row]);
      if (row.error) continue;
      queue.current = queue.current.then(async () => {
        if (controller.signal.aborted) return;
        try {
          const media = await directUpload(file, info.purpose, {
            signal: controller.signal,
            onProgress: (progress) => patch(key, { progress }),
          });
          setWaiting((names) => names.filter((name) => name !== file.name));
          await attach(key, media.id);
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            patch(key, null);
            return;
          }
          if (error instanceof UploadError && error.code === 'purpose_not_available')
            setUnavailable(true);
          patch(key, { error: problemMessage(error) });
        }
      });
    }
  }

  async function run(action: () => Promise<CoreEvent>) {
    setBusy(true);
    setProblem(null);
    try {
      onEvent(await action());
    } catch (error) {
      if (error instanceof ProblemError && error.status === 409) {
        // The list changed meanwhile: show it as it is now
        onEvent(await eventsApi.get(eventId.current));
        setProblem('Liste bu arada değişti; güncel hali yüklendi.');
      } else {
        setProblem(problemMessage(error));
      }
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, step: -1 | 1) {
    const ids = items.map((item) => item.id);
    const target = index + step;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    void run(() => eventMediaApi.order(eventId.current, kind, ids));
  }

  return (
    <section aria-labelledby={`${kind}-title`} className="space-y-3">
      <h3 id={`${kind}-title`} className="text-foreground text-sm font-medium">
        {info.title} <span className="text-subtle-foreground tabular-nums">{items.length}</span>
      </h3>

      {items.length ? (
        <ul className="divide-border-subtle border-border divide-y overflow-hidden rounded-lg border">
          {items.map((item, index) => (
            <MediaRow
              key={item.id}
              kind={kind}
              item={item}
              event={event}
              canEdit={canEdit}
              busy={busy}
              first={index === 0}
              last={index === items.length - 1}
              onMove={(step) => move(index, step)}
              onRemove={() => setRemoving(item)}
              onRun={run}
            />
          ))}
        </ul>
      ) : canEdit ? null : (
        <p className="text-muted-foreground text-xs">Henüz yok.</p>
      )}

      {problem ? (
        <p role="alert" className="text-destructive text-sm">
          {problem}
        </p>
      ) : null}

      {canEdit ? (
        <>
          {unavailable ? (
            <Notice tone="info" title={`${info.title} şu an yüklenemiyor`}>
              Bu ortamda henüz açık değil. Açıldığında buradan yükleyebileceksin.
            </Notice>
          ) : null}
          {waiting.length ? (
            <Notice tone="info" title="Yarım kalan yükleme">
              {waiting.join(', ')}: aynı dosyayı yeniden seçersen kaldığı yerden devam eder.
            </Notice>
          ) : null}
          <Dropzone
            onFiles={upload}
            accept={info.accept}
            multiple
            disabled={unavailable}
            hint={info.hint}
          />
          {uploads.length ? (
            <ul className="space-y-2" aria-label={`${info.title} yüklemeleri`}>
              {uploads.map((row) => (
                <li key={row.key} className="border-border rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <p className="text-foreground min-w-0 flex-1 truncate text-sm">{row.name}</p>
                    {row.pendingMediaId ? (
                      <button
                        type="button"
                        className="text-skylab-300 text-xs hover:underline"
                        onClick={() => void attach(row.key, row.pendingMediaId!)}
                      >
                        Etkinliğe ekle
                      </button>
                    ) : null}
                    <IconButton
                      icon={X}
                      size="icon-sm"
                      variant="ghost"
                      label={row.error ? 'Kapat' : 'Yüklemeyi durdur'}
                      onClick={() => {
                        row.controller.abort();
                        patch(row.key, null);
                      }}
                    />
                  </div>
                  {row.error ? (
                    <p role="alert" className="text-destructive mt-1 text-xs">
                      {row.error}
                    </p>
                  ) : (
                    <Progress
                      className="mt-2"
                      label={
                        row.progress?.phase === 'completing'
                          ? 'Tamamlanıyor…'
                          : row.progress
                            ? `${formatBytes(row.progress.sent)} / ${formatBytes(row.progress.total)}`
                            : 'Sırada'
                      }
                      value={
                        row.progress && row.progress.total
                          ? (row.progress.sent / row.progress.total) * 100
                          : null
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => (open ? undefined : setRemoving(null))}
        title={`${removing?.name || 'Bu öğe'} kaldırılsın mı?`}
        description="Etkinlikten çıkar. Başka bir yerde kullanılmıyorsa 30 gün sonra silinir."
        actionLabel="Kaldır"
        destructive
        pending={busy}
        onAction={() => {
          const target = removing;
          setRemoving(null);
          if (target) void run(() => eventMediaApi.remove(eventId.current, kind, [target.id]));
        }}
      />
    </section>
  );
}

function StatusBadge({ item }: { item: EventFile }) {
  if (item.status === 'scanning' || item.status === 'pending')
    return <Badge tone="warning">Taranıyor</Badge>;
  if (item.status === 'rejected') return <Badge tone="danger">Reddedildi</Badge>;
  return null;
}

function MediaRow({
  kind,
  item,
  event,
  canEdit,
  busy,
  first,
  last,
  onMove,
  onRemove,
  onRun,
}: {
  kind: EventMediaKind;
  item: EventFile | EventVideo;
  event: CoreEvent;
  canEdit: boolean;
  busy: boolean;
  first: boolean;
  last: boolean;
  onMove: (step: -1 | 1) => void;
  onRemove: () => void;
  onRun: (action: () => Promise<CoreEvent>) => Promise<void>;
}) {
  const video = kind === 'videos' ? (item as EventVideo) : null;
  const [preview, setPreview] = useState(false);
  const Icon = /zip/i.test(item.type) ? FileArchive : FileText;

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      {video ? (
        video.poster ? (
          <img
            src={video.poster.sizes.card.url}
            alt=""
            className="border-border aspect-video w-16 shrink-0 rounded border object-cover"
          />
        ) : (
          <span className="border-border bg-muted grid aspect-video w-16 shrink-0 place-items-center rounded border">
            <Play className="text-subtle-foreground size-4" aria-hidden />
          </span>
        )
      ) : (
        <Icon className="text-subtle-foreground size-5 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {item.url && !video ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-foreground truncate text-sm hover:underline"
            >
              {item.name || 'Adsız dosya'}
            </a>
          ) : (
            <span className="text-foreground truncate text-sm">{item.name || 'Adsız dosya'}</span>
          )}
          <StatusBadge item={item} />
        </div>
        <p className="text-2xs text-subtle-foreground tabular-nums">{formatBytes(item.size)}</p>
        {item.status === 'rejected' ? (
          <p className="text-destructive mt-0.5 text-xs">{scanResultMessage(item.scanResult)}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {video?.url ? (
          <IconButton
            icon={Play}
            size="icon-sm"
            variant="ghost"
            label="Önizle"
            onClick={() => setPreview(true)}
          />
        ) : null}
        {canEdit && video ? (
          <PosterMenu video={video} event={event} busy={busy} onRun={onRun} />
        ) : null}
        {canEdit ? (
          <>
            <IconButton
              icon={ArrowUp}
              size="icon-sm"
              variant="ghost"
              label="Yukarı taşı"
              disabled={first || busy}
              onClick={() => onMove(-1)}
            />
            <IconButton
              icon={ArrowDown}
              size="icon-sm"
              variant="ghost"
              label="Aşağı taşı"
              disabled={last || busy}
              onClick={() => onMove(1)}
            />
            <IconButton
              icon={Trash2}
              size="icon-sm"
              variant="ghost"
              label="Kaldır"
              disabled={busy}
              onClick={onRemove}
            />
          </>
        ) : null}
      </div>
      {video?.url ? (
        <Dialog open={preview} onOpenChange={setPreview}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{video.name || 'Video'}</DialogTitle>
            </DialogHeader>
            {preview ? (
              <video
                src={video.url}
                poster={video.poster?.sizes.page.url}
                controls
                preload="metadata"
                className="w-full rounded-md bg-black"
              />
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </li>
  );
}

function PosterMenu({
  video,
  event,
  busy,
  onRun,
}: {
  video: EventVideo;
  event: CoreEvent;
  busy: boolean;
  onRun: (action: () => Promise<CoreEvent>) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);
  const [library, setLibrary] = useState<TeamPhoto[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!picking || library) return;
    eventsApi
      .list(event.ownerTeam)
      .then((rows) => setLibrary(teamEventPhotos(rows, event.ownerTeam)))
      .catch(() => setLibrary([]));
  }, [picking, library, event.ownerTeam]);

  const setPoster = (posterId: string) =>
    onRun(() => eventMediaApi.setPoster(event.id, video.id, posterId));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <IconButton
              icon={ImagePlus}
              size="icon-sm"
              variant="ghost"
              label="Video kapağı"
              disabled={busy}
            />
          }
        />
        <DropdownMenuContent align="end">
          <MenuItem icon={ImagePlus} onClick={() => input.current?.click()}>
            Kapak görseli yükle
          </MenuItem>
          <MenuItem icon={Images} onClick={() => setPicking(true)}>
            Ekibin fotoğraflarından seç
          </MenuItem>
          {video.poster?.source === 'uploaded' ? (
            <MenuItem
              icon={ImageOff}
              destructive
              onClick={() => void onRun(() => eventMediaApi.clearPoster(event.id, video.id))}
            >
              Kapağı kaldır
            </MenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={input}
        type="file"
        accept="image/*"
        aria-label={`${video.name} için kapak görseli`}
        tabIndex={-1}
        className="sr-only"
        onChange={async (change) => {
          const file = change.target.files?.[0];
          change.target.value = '';
          if (!file) return;
          await onRun(async () => {
            const media = await mediaApi.upload(file, 'event_cover');
            return eventMediaApi.setPoster(event.id, video.id, media.id);
          });
        }}
      />
      <PickerDrawer
        open={picking}
        onClose={() => setPicking(false)}
        title="Ekibin fotoğrafları"
        query={query}
        onQuery={setQuery}
        placeholder="Ada göre ara"
        loading={library === null}
        options={(library ?? [])
          .filter((row) => pickerMatch(query, row.title, row.eventName))
          .map((row) => ({ id: row.id, title: row.title, subtitle: row.eventName }))}
        emptyMessage="Bu ekibin önceki fotoğrafı yok"
        onPick={(id) => {
          setPicking(false);
          void setPoster(id);
        }}
      />
    </>
  );
}
