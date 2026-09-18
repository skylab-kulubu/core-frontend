'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Upload, X } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { saveClass } from '@/components/chrome/SaveButton';
import { ProblemError } from '@/lib/api/core';
import { eventsApi } from '@/lib/api/events';
import { mediaApi, type Media } from '@/lib/api/media';
import { teamEventPhotos, type EventMediaHint, type TeamPhoto } from '@/lib/event-media';
import { pickerMatch } from '@/lib/picker';

const ghostClass =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-3 text-2xs font-medium text-neutral-200 hover:border-white/20 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60';

type EventMediaFieldsProps = {
  ownerTeam: string;
  coverImageId: string;
  imageIds: string[];
  knownMedia?: EventMediaHint[];
  onCover: (id: string, preview?: string) => void;
  onGallery: (ids: string[], previews?: Record<string, string>) => void;
};

export function EventMediaFields({
  ownerTeam,
  coverImageId,
  imageIds,
  knownMedia = [],
  onCover,
  onGallery,
}: EventMediaFieldsProps) {
  const coverRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [library, setLibrary] = useState<TeamPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<'cover' | 'gallery' | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const team = ownerTeam.trim();
    if (!team) {
      setLibrary([]);
      return;
    }
    let cancelled = false;
    eventsApi
      .list(team)
      .then((rows) => {
        if (!cancelled) setLibrary(teamEventPhotos(rows, team));
      })
      .catch(() => {
        if (!cancelled) setLibrary([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerTeam]);

  async function uploadFiles(files: FileList | null, target: 'cover' | 'gallery') {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: Media[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await mediaApi.upload(file));
      }
      const extra: Record<string, string> = {};
      for (const row of uploaded) extra[row.id] = row.url;
      setPreviews((prev) => ({ ...prev, ...extra }));
      if (target === 'cover') {
        const first = uploaded[0];
        if (first) onCover(first.id, first.url);
      } else {
        const ids = uploaded.map((row) => row.id).filter((id) => !imageIds.includes(id));
        onGallery([...imageIds, ...ids], extra);
      }
    } catch (err) {
      setError(err instanceof ProblemError ? err.title : 'Yüklenemedi');
    } finally {
      setUploading(false);
    }
  }

  function pick(id: string) {
    const photo = library.find((row) => row.id === id);
    if (photo?.url) setPreviews((prev) => ({ ...prev, [id]: photo.url! }));
    if (picker === 'cover') onCover(id, photo?.url);
    if (picker === 'gallery' && !imageIds.includes(id)) {
      onGallery([...imageIds, id], photo?.url ? { [id]: photo.url } : undefined);
    }
    setPicker(null);
  }

  const filtered = library.filter((row) => pickerMatch(query, row.title, row.eventName));
  const urls: Record<string, string> = { ...previews };
  for (const row of knownMedia) {
    if (row.id && row.url && !urls[row.id]) urls[row.id] = row.url;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <FieldLabel>Kapak görseli</FieldLabel>
        {coverImageId ? (
          <div className="flex items-center gap-2">
            {urls[coverImageId] ? (
              <img src={urls[coverImageId]} alt="" className="h-12 w-12 rounded-md object-cover" />
            ) : (
              <span className="text-3xs text-neutral-500">{coverImageId}</span>
            )}
            <ActionButton icon={X} label="Kapağı kaldır" onClick={() => onCover('')} />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              void uploadFiles(e.target.files, 'cover');
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className={saveClass}
            disabled={uploading}
            onClick={() => coverRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Yükleniyor…' : 'Yükle'}
          </button>
          <button
            type="button"
            className={ghostClass}
            disabled={!ownerTeam.trim()}
            onClick={() => {
              setQuery('');
              setPicker('cover');
            }}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Varolanlardan seç
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <FieldLabel>Galeri görselleri</FieldLabel>
        {imageIds.length ? (
          <div className="flex flex-wrap gap-2">
            {imageIds.map((id) => (
              <div key={id} className="relative">
                {urls[id] ? (
                  <img src={urls[id]} alt="" className="h-12 w-12 rounded-md object-cover" />
                ) : (
                  <span className="text-3xs block max-w-[4.5rem] truncate text-neutral-500">
                    {id}
                  </span>
                )}
                <ActionButton
                  icon={X}
                  label="Kaldır"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={() => onGallery(imageIds.filter((row) => row !== id))}
                />
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              void uploadFiles(e.target.files, 'gallery');
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className={saveClass}
            disabled={uploading}
            onClick={() => galleryRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Yükleniyor…' : 'Yükle'}
          </button>
          <button
            type="button"
            className={ghostClass}
            disabled={!ownerTeam.trim()}
            onClick={() => {
              setQuery('');
              setPicker('gallery');
            }}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Varolanlardan seç
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <PickerDrawer
        open={picker !== null}
        onClose={() => setPicker(null)}
        title="Ekibin fotoğrafları"
        query={query}
        onQuery={setQuery}
        placeholder="Ada göre ara"
        loading={false}
        options={filtered.map((row) => ({
          id: row.id,
          title: row.title,
          subtitle: row.eventName,
        }))}
        emptyMessage={ownerTeam.trim() ? 'Bu ekibin önceki fotoğrafı yok' : 'Önce sahip ekip seç'}
        onPick={pick}
      />
    </div>
  );
}
