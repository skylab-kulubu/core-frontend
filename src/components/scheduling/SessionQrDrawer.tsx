'use client';

import { useState } from 'react';
import { Drawer } from '@/components/chrome/Drawer';
import { QrPreview } from '@/components/chrome/QrPreview';
import { AttendanceQr } from '@/components/scheduling/AttendanceQr';
import { StaticSessionQr } from '@/components/scheduling/StaticSessionQr';
import {
  sessionQrFileName,
  sessionQrPath,
  sessionQrUrl,
  type EventSession,
} from '@/lib/api/sessions';
import type { SessionQrMode } from '@/lib/api/tickets';
import { sessionNowAndNext } from '@/lib/event-overview';

/**
 * The session a QR opens on when none was picked: the one running now, else the next, else the
 * first not cancelled. The drawer then moves between sessions itself (Programı izle).
 */
export function sessionForQr(sessions: readonly EventSession[]): EventSession | null {
  const { current, next } = sessionNowAndNext(sessions);
  return current ?? next ?? sessions.find((session) => !session.cancelled) ?? null;
}

/**
 * Oturum QR: the session's attendance QR for the screen (who works the door), the printable
 * static one that follows it, and the old printed QR while core still takes it. Program opens it
 * from a session's row or its top command, the door from its header.
 */
export function SessionQrDrawer({
  session,
  sessions,
  canDesk,
  onClose,
}: {
  session: EventSession | null;
  sessions: readonly EventSession[];
  canDesk: boolean;
  onClose: () => void;
}) {
  // The session the attendance QR shows now (picked by hand or by "Programı izle"); the static QR
  // follows it.
  const [shown, setShown] = useState<{ id: string; title: string } | null>(null);
  // Core's SESSION_QR_MODE, learnt from the attendance QR; null until it answers.
  const [mode, setMode] = useState<SessionQrMode | null>(null);
  return (
    <Drawer
      open={session !== null}
      onClose={() => {
        setShown(null);
        onClose();
      }}
      title={session ? `${session.title} QR` : 'Oturum QR'}
    >
      {session ? (
        <div className="space-y-6">
          {canDesk ? (
            <AttendanceQr
              sessionId={session.id}
              title={session.title}
              onMode={setMode}
              program={sessions}
              onSession={setShown}
            />
          ) : null}
          {canDesk && !session.cancelled ? (
            <StaticSessionQr
              sessionId={shown?.id ?? session.id}
              title={shown?.title ?? session.title}
            />
          ) : null}
          {mode === 'qr' ? (
            <p className="text-secondary-foreground text-sm">
              Basılı oturum QR&apos;ı artık yoklama yazmaz.
            </p>
          ) : (
            <div className="space-y-2">
              {canDesk ? (
                <p className="text-secondary-foreground text-sm">
                  Basılı QR: sky-app&apos;in bugünkü sürümü bunu okur. Geçiş bitince kalkar.
                </p>
              ) : null}
              <QrPreview
                imageUrl={sessionQrUrl(session.id)}
                downloadPath={sessionQrPath(session.id, { size: 1024 })}
                fileName={sessionQrFileName(session.id, session.title)}
                label={`${session.title} QR`}
              />
            </div>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}
