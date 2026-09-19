'use client';

import { useState } from 'react';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { PersonPick } from '@/components/identity/PersonPick';
import { ProblemError } from '@/lib/api/core';
import { ticketsApi, type GuestApplyBody, type Ticket } from '@/lib/api/tickets';

export function AddParticipantDrawer({
  open,
  onClose,
  eventId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  onCreated: (ticket: Ticket) => void;
}) {
  const [personId, setPersonId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function reset() {
    setPersonId('');
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setError(null);
  }

  return (
    <Drawer
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Katılımcı ekle"
    >
      <div className="space-y-6">
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!personId) return;
            setPending(true);
            try {
              const ticket = await ticketsApi.applyForOther(eventId, personId);
              reset();
              onCreated(ticket);
              onClose();
            } catch (err) {
              setError(err instanceof ProblemError ? err.title : 'Üye kaydı yazılamadı');
            } finally {
              setPending(false);
            }
          }}
        >
          <PersonPick valueId={personId} onChange={setPersonId} />
          <SaveButton disabled={pending || !personId}>Üye kaydı yaz</SaveButton>
        </form>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            try {
              const body: GuestApplyBody = {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
              };
              const phoneNumber = phone.trim();
              if (phoneNumber) body.phoneNumber = phoneNumber;
              const ticket = await ticketsApi.applyGuest(eventId, body);
              reset();
              onCreated(ticket);
              onClose();
            } catch (err) {
              setError(err instanceof ProblemError ? err.title : 'Misafir kaydı yazılamadı');
            } finally {
              setPending(false);
            }
          }}
        >
          <label className="block space-y-1">
            <FieldLabel>Ad</FieldLabel>
            <Field value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Soyad</FieldLabel>
            <Field value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </label>
          <label className="block space-y-1">
            <FieldLabel>E-posta</FieldLabel>
            <Field type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Telefon</FieldLabel>
            <Field value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <SaveButton disabled={pending}>Misafir kaydı yaz</SaveButton>
        </form>
      </div>
    </Drawer>
  );
}
