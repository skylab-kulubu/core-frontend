'use client';

import { useEffect, useMemo, useState } from 'react';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { PickerDrawer } from '@/components/chrome/PickerDrawer';
import { identityApi, type Person } from '@/lib/api/identity';
import { pickerMatch } from '@/lib/picker';

export function personLabel(person: Person): string {
  return `${person.firstName} ${person.lastName}`.trim() || person.email;
}

export function PersonPick({
  valueId,
  onChange,
  onPicked,
  label = 'Kişi',
}: {
  valueId: string;
  onChange: (id: string) => void;
  onPicked?: (person: Person | null) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<Person | null>(null);

  useEffect(() => {
    if (!valueId) {
      setPicked(null);
      return;
    }
    let cancelled = false;
    identityApi
      .getUser(valueId)
      .then((card) => {
        if (cancelled) return;
        setPicked({
          id: card.id,
          email: card.email,
          firstName: card.firstName,
          lastName: card.lastName,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [valueId]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(
      () => {
        setLoading(true);
        identityApi
          .listUsers(query)
          .then((rows) => {
            setPeople(rows);
            setFailed(false);
          })
          .catch(() => setFailed(true))
          .finally(() => setLoading(false));
      },
      query.trim() ? 250 : 0,
    );
    return () => window.clearTimeout(handle);
  }, [open, query]);

  const selected = useMemo(() => {
    if (picked && picked.id === valueId) return picked;
    return people.find((person) => person.id === valueId) ?? null;
  }, [people, picked, valueId]);

  return (
    <>
      <label className="block space-y-1">
        <FieldLabel>{label}</FieldLabel>
        <button
          type="button"
          aria-label="Kişi seç"
          className="focus:border-skylab-400/50 h-8 w-full rounded-md border border-white/10 bg-white/3 px-3 text-left text-xs text-neutral-100"
          onClick={() => {
            setQuery('');
            setOpen(true);
          }}
        >
          {selected ? personLabel(selected) : valueId ? valueId : 'Kişi seç'}
        </button>
      </label>
      <PickerDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Kişi seç"
        query={query}
        onQuery={setQuery}
        placeholder="Ad, e-posta"
        loading={loading}
        failed={failed}
        options={people
          .filter((person) => pickerMatch(query, person.email, person.firstName, person.lastName))
          .map((person) => ({
            id: person.id,
            title: personLabel(person),
            subtitle: person.email,
          }))}
        emptyMessage="Kullanıcı yok"
        onPick={(id) => {
          const person = people.find((row) => row.id === id) ?? null;
          setPicked(person);
          onChange(id);
          onPicked?.(person);
          setOpen(false);
        }}
      />
    </>
  );
}
