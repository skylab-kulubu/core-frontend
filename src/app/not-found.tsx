import { StatusPage } from '@skylab-kulubu/skylcn-ui';
import Link from 'next/link';

/** Not found outside the panel's chrome (signed out, or before the chrome): in Turkish. */
export default function NotFound() {
  return (
    <StatusPage code="404" title="Sayfa bulunamadı">
      <Link
        href="/dashboard"
        className="border-border hover:bg-accent inline-flex h-8 items-center rounded-md border px-3 text-[13px]"
      >
        Özete dön
      </Link>
    </StatusPage>
  );
}
