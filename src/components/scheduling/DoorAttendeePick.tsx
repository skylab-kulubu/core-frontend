'use client';

import { useEffect, useState } from 'react';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { ticketsApi, type DoorAttendee } from '@/lib/api/tickets';

function optionID(attendee: DoorAttendee): string {
  return attendee.personId ? `person:${attendee.personId}` : `guest:${attendee.email}`;
}

export function DoorAttendeePick({
  eventId,
  valueKey,
  onPick,
}: {
  eventId: string;
  valueKey: string;
  onPick: (attendee: DoorAttendee) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [attendees, setAttendees] = useState<DoorAttendee[]>([]);
  const [picked, setPicked] = useState<DoorAttendee | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!picked) return;
    const pickedKey = picked.personId ?? picked.email;
    if (valueKey !== pickedKey) setPicked(null);
  }, [picked, valueKey]);

  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) {
      setAttendees([]);
      setFailed(false);
      setLoading(false);
      return;
    }
    setAttendees([]);
    setFailed(false);
    setLoading(true);
    let cancelled = false;
    const handle = window.setTimeout(() => {
      ticketsApi
        .searchDoorAttendees(eventId, query)
        .then((rows) => {
          if (cancelled) return;
          setAttendees(rows);
          setFailed(false);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [eventId, open, query]);

  return (
    <>
      <label className="block space-y-1">
        <FieldLabel>Katılımcı</FieldLabel>
        <button
          type="button"
          aria-label="Katılımcı bul"
          className="focus:border-skylab-400/50 h-8 w-full rounded-md border border-white/10 bg-white/3 px-3 text-left text-xs text-neutral-100"
          onClick={() => {
            setQuery('');
            setOpen(true);
          }}
        >
          {picked ? `${picked.name} · ${picked.email}` : 'Katılımcı bul'}
        </button>
      </label>
      <PickerDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Katılımcı bul"
        query={query}
        onQuery={setQuery}
        placeholder="Ad veya e-posta"
        loading={loading}
        failed={failed}
        options={attendees.map((attendee) => ({
          id: optionID(attendee),
          title: attendee.name,
          subtitle: attendee.email,
        }))}
        emptyMessage={query.trim().length < 2 ? 'En az 2 karakter yazın' : 'Katılımcı yok'}
        onPick={(id) => {
          const attendee = attendees.find((row) => optionID(row) === id);
          if (!attendee) return;
          setPicked(attendee);
          onPick(attendee);
          setOpen(false);
        }}
      />
    </>
  );
}
