'use client';

import { Button, SearchInput, Skeleton, cn } from '@skylab-kulubu/skylcn-ui';
import { ImageIcon, ImagePlus, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '@/components/chrome/Drawer';
import { mediaApi, type Media } from '@/lib/api/media';
import { coreProblemMessage } from '@/lib/core-problems';
import { publicMediaUrl } from '@/lib/event-media';
import { pickerMatch } from '@/lib/picker';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';

/**
 * Pictures a cover may reuse: images uploaded without a purpose (kept as they are) or
 * attached to a record. A pending or detached purposed upload is purged unless something
 * attaches it, and the CMS stores only the address, so it would break later.
 */
export function reusableCovers(rows: readonly Media[]): Media[] {
  return rows
    .filter((row) => row.type?.startsWith('image/') && Boolean(row.url))
    .filter((row) => !row.purpose || row.purpose === 'legacy' || row.status === 'attached')
    .filter((row) => row.purpose !== 'profile_picture' && row.purpose !== 'certificate_asset')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

/** The picture whole, never cropped, on a quiet ground; a placeholder without one. */
export function CoverPreview({ src, className }: { src?: string; className?: string }) {
  const url = src?.trim() ? publicMediaUrl(src) : '';
  return (
    <div
      className={cn(
        'bg-muted border-border-subtle grid aspect-[16/9] w-full place-items-center overflow-hidden rounded-md border',
        className,
      )}
    >
      {url ? (
        <img src={url} alt="Kapak önizlemesi" className="size-full object-contain" />
      ) : (
        <ImageIcon className="text-subtle-foreground size-6" aria-hidden />
      )}
    </div>
  );
}

/**
 * The announcement's cover: the picture as it will show, a new upload, or one picked from
 * the media library.
 */
export function CoverField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      // Without a purpose (legacy), as the CMS write contract says: a purposed Media is
      // purged unless something attaches it, and cms_image is not open until the CMS has
      // its service client. The CMS stores the address.
      const media = await mediaApi.upload(file);
      onChange(publicMediaUrl(media.url) || media.url);
    } catch (err) {
      setError(coreProblemMessage(err, 'Görsel yüklenemedi'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <CoverPreview src={value} />
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        aria-label="Kapak görseli dosyası"
        className="sr-only"
        onChange={(event) => {
          void upload(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={BUTTON_TEXT}
          disabled={uploading}
          onClick={() => input.current?.click()}
        >
          <Upload aria-hidden />
          {uploading ? 'Yükleniyor…' : value.trim() ? 'Değiştir' : 'Yükle'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={BUTTON_TEXT}
          onClick={() => setPicking(true)}
        >
          <ImagePlus aria-hidden />
          Kütüphaneden seç
        </Button>
        {value.trim() ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={BUTTON_TEXT}
            onClick={() => onChange('')}
          >
            <X aria-hidden />
            Kaldır
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className={`text-destructive ${TEXT_SECONDARY}`}>
          {error}
        </p>
      ) : null}
      <MediaLibrary
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(url) => {
          onChange(url);
          setPicking(false);
        }}
      />
    </div>
  );
}

function MediaLibrary({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
}) {
  const [rows, setRows] = useState<Media[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open || rows) return;
    let cancelled = false;
    mediaApi
      .list()
      .then((all) => {
        if (!cancelled) setRows(reusableCovers(all ?? []));
      })
      .catch((err) => {
        if (!cancelled) setFailed(coreProblemMessage(err, 'Medya yüklenemedi'));
      });
    return () => {
      cancelled = true;
    };
  }, [open, rows]);

  const shown = useMemo(
    () => (rows ?? []).filter((row) => pickerMatch(query, row.name)).slice(0, 60),
    [rows, query],
  );

  return (
    <Drawer open={open} onClose={onClose} title="Medya kütüphanesi">
      <div className="space-y-3">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder="Dosya adı"
          aria-label="Medya ara"
        />
        {failed ? (
          <p role="alert" className={`text-destructive ${TEXT_SECONDARY}`}>
            {failed}
          </p>
        ) : rows === null ? (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="aspect-[16/9] w-full" />
            ))}
          </div>
        ) : shown.length ? (
          <ul className="grid grid-cols-2 gap-2">
            {shown.map((row) => {
              const url = publicMediaUrl(row.url);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onPick(url)}
                    className="border-border-subtle hover:border-border focus-visible:ring-ring block w-full overflow-hidden rounded-md border text-left outline-hidden focus-visible:ring-2"
                  >
                    <span className="bg-muted grid aspect-[16/9] place-items-center">
                      <img src={url} alt="" className="size-full object-contain" loading="lazy" />
                    </span>
                    <span className={`block truncate px-2 py-1 ${TEXT_SECONDARY}`}>{row.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={`text-subtle-foreground py-6 text-center ${TEXT_SECONDARY}`}>
            {query.trim() ? 'Eşleşen görsel yok' : 'Kütüphanede görsel yok'}
          </p>
        )}
      </div>
    </Drawer>
  );
}
