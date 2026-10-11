'use client';

import { useState } from 'react';
import { SaveButton } from '@/components/chrome/SaveButton';
import { useEventWorkspace } from '@/components/scheduling/EventWorkspace';
import { useAuth } from '@/context/AuthContext';
import { ProblemError } from '@/lib/api/core';
import { ticketsApi } from '@/lib/api/tickets';
import { publicShortUrl } from '@/lib/api/urls';
import { publicMediaUrl } from '@/lib/event-media';

/** Genel bakış tab: the event's cover and description, and registering with one's own account. */
export default function EventOverviewPage() {
  const { user } = useAuth();
  const { event, tickets, setTickets, setError, applyNote, setApplyNote, canTickets } =
    useEventWorkspace();
  const [applying, setApplying] = useState(false);
  const myTicket = Boolean(
    (user?.id && tickets.some((row) => row.ownerId === user.id)) || applyNote,
  );

  return (
    <div className="space-y-6">
      {event.coverImageUrl ? (
        <img
          src={publicMediaUrl(event.coverImageUrl)}
          alt=""
          className="h-40 w-full rounded-lg object-cover"
        />
      ) : null}
      <p className="text-muted-foreground text-sm whitespace-pre-wrap">
        {event.description || '—'}
      </p>
      {user ? (
        <div className="border-border space-y-2 rounded-lg border p-3">
          <p className="text-secondary-foreground text-sm">Üye kaydı</p>
          <p className="text-3xs text-subtle-foreground">
            Giriş yapmış kişiler public forma düşmez. Ticket hesabınla yazılır.
          </p>
          {myTicket ? (
            <p className="text-skylab-300 text-sm">Bu etkinliğe kayıtlısın.</p>
          ) : (
            <SaveButton
              type="button"
              disabled={applying}
              onClick={async () => {
                setApplying(true);
                try {
                  await ticketsApi.applyMe(event.id);
                  setApplyNote('Bu etkinliğe kayıtlısın.');
                  if (canTickets) {
                    setTickets(await ticketsApi.listByEvent(event.id).catch(() => tickets));
                  }
                } catch (err) {
                  if (err instanceof ProblemError && err.status === 409) {
                    setApplyNote('Bu etkinliğe kayıtlısın.');
                  } else {
                    setError(err instanceof ProblemError ? err.title : 'Kayıt olunamadı');
                  }
                } finally {
                  setApplying(false);
                }
              }}
            >
              {applying ? 'Kaydediliyor…' : 'Hesabınla kaydol'}
            </SaveButton>
          )}
          {event.formAlias || event.formUrl ? (
            <p className="text-3xs text-subtle-foreground">
              Misafir başvurusu (hesabı olmayanlar):{' '}
              <a
                className="text-skylab-300 hover:text-foreground"
                href={event.formAlias ? publicShortUrl(event.formAlias) : event.formUrl}
                target="_blank"
                rel="noreferrer"
              >
                {event.formAlias ? publicShortUrl(event.formAlias) : event.formUrl}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
