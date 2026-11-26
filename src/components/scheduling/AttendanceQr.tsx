'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@skylab-kulubu/skylcn-ui';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import { Switch } from '@/components/chrome/Switch';
import { useRotatingDoorQr } from '@/components/scheduling/useRotatingDoorQr';
import type { SessionQrMode } from '@/lib/api/tickets';
import {
  followProgramOn,
  pickProgramSession,
  programTitle,
  setFollowProgramOn,
  type ProgramSession,
} from '@/lib/program-follow';

/** How often "Programı izle" looks at the clock again. */
const FOLLOW_TICK_MS = 15_000;
/** How long the full-screen controls stay after the last touch or mouse move. */
const CONTROLS_MS = 4_000;

/**
 * The session's attendance QR for the projector or OBS: core's display token (a whole room
 * scans one frame), renewed every refreshAfterSeconds, full screen on demand. Reports core's
 * SESSION_QR_MODE so the page can drop the printed QR once it no longer checks anyone in.
 *
 * With the event's `program`, the operator may pick another session here, or turn on
 * "Programı izle" (off by default, remembered on this device): the screen then shows the session
 * running now by the clock, or the next one ("Sıradaki: …"), so one OBS scene can stay up all
 * day. Picking a session by hand turns it off.
 *
 * Limits (the browser's, not core's): a hidden window (minimised, fully covered, another macOS
 * Space, a background tab) does not renew the QR, and the last one leaves the screen when it
 * expires (60 s); it comes back as soon as the window is visible. Keep the window visible on its
 * own screen, and capture that screen in OBS rather than a browser source.
 */
export function AttendanceQr({
  sessionId,
  title,
  onMode,
  program,
}: {
  sessionId: string;
  title: string;
  onMode?: (mode: SessionQrMode) => void;
  program?: readonly ProgramSession[];
}) {
  const screenRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [follow, setFollow] = useState(false);
  const [pinnedId, setPinnedId] = useState(sessionId);
  const [now, setNow] = useState(() => Date.now());
  const [controls, setControls] = useState(false);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const choices = (program ?? []).filter((s) => !s.cancelled);
  const pick = follow ? pickProgramSession(choices, now) : null;
  const pinned = choices.find((s) => s.id === pinnedId) ?? { id: sessionId, title };
  const shownSession = pick?.session ?? pinned;
  const heading = pick ? programTitle(pick) : shownSession.title;

  const { src, message, mode } = useRotatingDoorQr(shownSession.id, true, 'display');

  useEffect(() => {
    if (mode) onMode?.(mode);
  }, [mode, onMode]);

  useEffect(() => {
    setPinnedId(sessionId);
  }, [sessionId]);

  const hasProgram = Boolean(program);
  useEffect(() => {
    if (hasProgram) setFollow(followProgramOn());
  }, [hasProgram]);

  useEffect(() => {
    if (!follow) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), FOLLOW_TICK_MS);
    return () => clearInterval(timer);
  }, [follow]);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === screenRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => () => clearTimeout(controlsTimer.current), []);

  const changeFollow = (on: boolean) => {
    setFollow(on);
    setFollowProgramOn(on);
  };
  // A session picked by hand stays: "Programı izle" goes off.
  const pin = (id: string) => {
    setPinnedId(id);
    changeFollow(false);
  };
  const wake = () => {
    if (!program) return;
    setControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setControls(false), CONTROLS_MS);
  };

  const modeLine = program
    ? follow
      ? pick
        ? `Programı izliyor · ${shownSession.title}`
        : 'Programı izliyor · saatli oturum yok'
      : `Elle seçildi · ${shownSession.title}`
    : null;

  const sessionPicker = (className?: string) => (
    <Select
      aria-label="Oturum"
      className={className}
      value={shownSession.id}
      onChange={(e) => pin(e.target.value)}
    >
      {choices.some((s) => s.id === shownSession.id) ? null : (
        <option value={shownSession.id}>{shownSession.title}</option>
      )}
      {choices.map((s) => (
        <option key={s.id} value={s.id}>
          {s.title}
        </option>
      ))}
    </Select>
  );

  return (
    <section aria-label="Yoklama QR'ı" className="space-y-3">
      {program ? (
        <div className="space-y-2">
          <Switch
            checked={follow}
            onChange={changeFollow}
            label="Programı izle"
            hint="Saate göre oturumdan oturuma geçer. Saatler kayarsa kapat."
          />
          {sessionPicker()}
        </div>
      ) : null}
      <div
        ref={screenRef}
        onPointerMove={full ? wake : undefined}
        onPointerDown={full ? wake : undefined}
        className={cn(
          full
            ? 'relative flex h-full w-full flex-col items-center justify-center gap-6 bg-black text-white'
            : 'space-y-2',
          full && !controls && 'cursor-none',
        )}
      >
        {full ? <p className="text-4xl font-semibold">{heading}</p> : null}
        {src ? (
          <img
            src={src}
            alt="Oturum yoklaması için QR"
            className={cn(
              'aspect-square rounded-md bg-white',
              full ? 'h-[70vh] max-w-[90vw]' : 'mx-auto w-80 max-w-full',
            )}
          />
        ) : null}
        {full ? <p className="text-2xl">Yoklama için telefonunun kamerasıyla okut</p> : null}
        {full && modeLine ? (
          <p className="absolute bottom-3 left-4 text-sm text-white/50">{modeLine}</p>
        ) : null}
        {full && program && controls ? (
          <div className="absolute top-3 right-3 left-3 flex flex-wrap items-center gap-3 rounded-lg bg-zinc-900/90 p-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={follow}
                onChange={(e) => changeFollow(e.target.checked)}
              />
              Programı izle
            </label>
            {follow ? (
              <button
                type="button"
                className="rounded-md bg-white px-3 py-1.5 font-medium text-black"
                onClick={() => pin(shownSession.id)}
              >
                Bu oturumda kal
              </button>
            ) : null}
            {sessionPicker('max-w-xs bg-black text-white')}
          </div>
        ) : null}
      </div>
      {modeLine && !full ? (
        <p className="text-secondary-foreground text-sm">
          {pick?.state === 'next' ? `${modeLine} (sıradaki)` : modeLine}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-secondary-foreground text-sm">
          {message}
        </p>
      ) : null}
      {src ? (
        <>
          <p className="text-secondary-foreground text-sm">
            Kendiliğinden yenilenir. Salondaki ekrana ver, canlı yayına koyma. Pencere görünür
            kalmalı: küçültülen ya da örtülen pencerede QR bir dakika içinde kalkar.
          </p>
          <SaveButton type="button" onClick={() => void screenRef.current?.requestFullscreen?.()}>
            Tam ekran
          </SaveButton>
        </>
      ) : null}
    </section>
  );
}
