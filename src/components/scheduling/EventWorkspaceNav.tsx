import Link from 'next/link';

type EventWorkspaceNavProps = {
  eventId: string;
  canSeeParticipants?: boolean;
  canSeeCompetitors?: boolean;
  canUseDoor?: boolean;
  canSeeCertificates?: boolean;
};

const localLink =
  'focus-visible:ring-skylab-400/40 rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-100 focus-visible:ring-2 focus-visible:outline-none';

export function EventWorkspaceNav({
  eventId,
  canSeeParticipants = false,
  canSeeCompetitors = false,
  canUseDoor = false,
  canSeeCertificates = false,
}: EventWorkspaceNavProps) {
  return (
    <nav
      aria-label="Etkinlik çalışma alanı"
      className="sticky top-14 z-20 -mx-2 flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-neutral-900/90 p-1.5 shadow-lg shadow-black/10 backdrop-blur md:top-0"
    >
      <a className={localLink} href="#overview">
        Özet
      </a>
      {canSeeParticipants ? (
        <a className={localLink} href="#participants">
          Başvuranlar
        </a>
      ) : null}
      <a className={localLink} href="#program">
        Program
      </a>
      {canSeeCompetitors ? (
        <a className={localLink} href="#competitors">
          Yarışmacılar
        </a>
      ) : null}
      {canSeeCertificates ? (
        <a className={localLink} href="#certificates">
          Sertifikalar
        </a>
      ) : null}
      {canUseDoor ? (
        <Link
          className={`${localLink} text-skylab-300`}
          href={`/qr?eventId=${encodeURIComponent(eventId)}`}
        >
          Kapı
        </Link>
      ) : null}
    </nav>
  );
}
