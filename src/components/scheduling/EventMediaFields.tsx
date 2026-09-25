'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Upload, X } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { saveClass } from '@/components/chrome/SaveButton';
import { eventsApi } from '@/lib/api/events';
import {
  publicMediaUrl,
  teamEventPhotos,
  type EventMediaHint,
  type TeamPhoto,
} from '@/lib/event-media';
import { uploadMediaBatch } from '@/lib/media-upload-batch';
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
  const [problems, setProblems] = useState<string[]>([]);
  const [remaining, setRemaining] = useState<File[]>([]);
  // When the organizer may continue the waiting files; null once they may.
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [picker, setPicker] = useState<'cover' | 'gallery' | null>(null);
  const [query, setQuery] = useState('');
  // The props of the latest render: an upload hands its Media to the form as
  // it is when the upload ends, so edits made meanwhile survive.
  const latest = useRef({ imageIds, onCover, onGallery });
  useEffect(() => {
    latest.current = { imageIds, onCover, onGallery };
  });

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

  useEffect(() => {
    if (resumeAt === null) return;
    const timer = window.setTimeout(() => setResumeAt(null), resumeAt - Date.now());
    return () => window.clearTimeout(timer);
  }, [resumeAt]);

  // What already uploaded is always handed to the Event (and attached on
  // save). Gallery files a refusal stopped join the ones waiting for the
  // organizer to continue, after the wait core gives when the upload limit
  // stopped them.
  async function uploadFiles(files: File[], target: 'cover' | 'gallery', resuming = false) {
    if (!files.length) return;
    setUploading(true);
    setProblems([]);
    if (resuming) setRemaining([]);
    try {
      const { uploaded, refused, stopped } = await uploadMediaBatch(
        files,
        target === 'cover' ? 'event_cover' : 'event_gallery',
      );
      const extra: Record<string, string> = {};
      for (const row of uploaded) {
        const href = publicMediaUrl(row.url);
        if (href) extra[row.id] = href;
      }
      if (uploaded.length) {
        setPreviews((prev) => ({ ...prev, ...extra }));
        const form = latest.current;
        if (target === 'cover') {
          const first = uploaded[0];
          form.onCover(first.id, extra[first.id]);
        } else {
          const ids = uploaded.map((row) => row.id).filter((id) => !form.imageIds.includes(id));
          form.onGallery([...form.imageIds, ...ids], extra);
        }
      }
      const notes = refused.map(({ file, message }) => `${file.name}: ${message}`);
      if (stopped) {
        notes.push(stopped.message);
        if (target === 'gallery') {
          setRemaining((waiting) => [...waiting, ...stopped.rest]);
          const seconds = stopped.retryAfterSeconds;
          if (seconds !== undefined) {
            // Only core's upload limit sets a wait; another stop keeps the running one.
            const until = Date.now() + seconds * 1000;
            setResumeAt((current) => Math.max(current ?? 0, until));
          }
        }
      }
      setProblems(notes);
    } finally {
      setUploading(false);
    }
  }

  function pick(id: string) {
    const photo = library.find((row) => row.id === id);
    const href = publicMediaUrl(photo?.url);
    if (href) setPreviews((prev) => ({ ...prev, [id]: href }));
    if (picker === 'cover') onCover(id, href || undefined);
    if (picker === 'gallery' && !imageIds.includes(id)) {
      onGallery([...imageIds, id], href ? { [id]: href } : undefined);
    }
    setPicker(null);
  }

  const filtered = library.filter((row) => pickerMatch(query, row.title, row.eventName));
  const urls: Record<string, string> = {};
  for (const [id, url] of Object.entries(previews)) {
    const href = publicMediaUrl(url);
    if (href) urls[id] = href;
  }
  for (const row of knownMedia) {
    const href = publicMediaUrl(row.url);
    if (row.id && href && !urls[row.id]) urls[row.id] = href;
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
            aria-label="Kapak görseli seç"
            className="sr-only"
            onChange={(e) => {
              void uploadFiles(Array.from(e.target.files ?? []), 'cover');
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
            aria-label="Galeri görselleri seç"
            className="sr-only"
            onChange={(e) => {
              void uploadFiles(Array.from(e.target.files ?? []), 'gallery');
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
      {problems.map((problem, index) => (
        <p key={index} className="text-sm text-red-300">
          {problem}
        </p>
      ))}
      {remaining.length ? (
        <button
          type="button"
          className={ghostClass}
          disabled={uploading || resumeAt !== null}
          onClick={() => void uploadFiles(remaining, 'gallery', true)}
        >
          <Upload className="h-3.5 w-3.5" />
          Kalan {remaining.length} görseli yükle
        </button>
      ) : null}
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
