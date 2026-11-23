'use client';

import { Button } from '@skylab-kulubu/skylcn-ui';
import {
  CircleAlert,
  FileQuestion,
  Inbox,
  RotateCw,
  Search,
  SearchX,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { StateCard } from '@/components/chrome/StateCard';
import { useOpenSearch } from '@/components/layout/search-context';
import { PageHeader } from '@/components/layout/PageHeader';
import { BUTTON_TEXT } from '@/lib/ui/type-scale';

/**
 * The panel's states in one family (Carbon empty states, Fluent MessageBar), all the
 * same size, centred, under the page's title when it has one:
 *
 * | kind        | title                           | action          |
 * | ----------- | ------------------------------- | --------------- |
 * | `first-use` | "Henüz duyuru yok"              | the page's own  |
 * | `no-results`| "Bu süzgeçte sonuç yok"         | Süzgeci temizle |
 * | `failed`    | "Liste yüklenemedi"             | Tekrar dene     |
 * | Forbidden   | "Bu sayfaya erişimin yok"       | Özete dön       |
 * | NotFound    | "Sayfa bulunamadı"              | Özete dön, Ara  |
 *
 * No error codes or details; a forbidden page names no role.
 */

const HOME = '/dashboard';

function HomeButton() {
  return (
    <Button className={BUTTON_TEXT} size="sm" variant="outline" render={<Link href={HOME} />}>
      Özete dön
    </Button>
  );
}

function WithTitle({ title, children }: { title?: string; children: ReactNode }) {
  if (!title) return <>{children}</>;
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      {children}
    </div>
  );
}

/** A list's empty or failed state, in place of its rows. */
export function EmptyState({
  kind,
  title,
  action,
  onRetry,
  onClear,
}: {
  kind: 'first-use' | 'no-results' | 'failed';
  /** "Henüz duyuru yok", "Liste yüklenemedi"; the kind's own words when left out. */
  title?: string;
  /** first-use: the page's one way to add the first, such as "Duyuru ekle". */
  action?: ReactNode;
  onRetry?: () => void;
  onClear?: () => void;
}) {
  if (kind === 'failed') {
    return (
      <StateCard title={title ?? 'Liste yüklenemedi'} Icon={CircleAlert} tone="danger">
        {onRetry ? (
          <Button className={BUTTON_TEXT} size="sm" variant="outline" onClick={onRetry}>
            <RotateCw className="size-4" aria-hidden />
            Tekrar dene
          </Button>
        ) : null}
      </StateCard>
    );
  }
  if (kind === 'no-results') {
    return (
      <StateCard title={title ?? 'Bu süzgeçte sonuç yok'} Icon={SearchX}>
        {onClear ? (
          <Button className={BUTTON_TEXT} size="sm" variant="outline" onClick={onClear}>
            Süzgeci temizle
          </Button>
        ) : null}
      </StateCard>
    );
  }
  return (
    <StateCard title={title ?? 'Henüz kayıt yok'} Icon={Inbox}>
      {action}
    </StateCard>
  );
}

/**
 * The one "no access" state: the page's title, then the card. Pages do not write
 * their own; `note` is one short line when the reader must know whom to ask.
 */
export function Forbidden({ pageTitle, note }: { pageTitle?: string; note?: string }) {
  return (
    <WithTitle title={pageTitle}>
      <StateCard
        title="Bu sayfaya erişimin yok"
        description={note}
        Icon={ShieldAlert}
        tone="warning"
      >
        <HomeButton />
      </StateCard>
    </WithTitle>
  );
}

/** The panel's not-found page, inside the chrome: back to Özet, or search. */
export function NotFoundState() {
  const openSearch = useOpenSearch();
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <StateCard title="Sayfa bulunamadı" Icon={FileQuestion}>
        <div className="flex flex-wrap justify-center gap-2">
          <HomeButton />
          {openSearch ? (
            <Button className={BUTTON_TEXT} size="sm" variant="ghost" onClick={openSearch}>
              <Search className="size-4" aria-hidden />
              Ara
            </Button>
          ) : null}
        </div>
      </StateCard>
    </div>
  );
}

/** A page that broke while drawing (a route's error.tsx): try again, or back to Özet. */
export function RouteErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <StateCard title="Sayfa açılamadı" Icon={CircleAlert} tone="danger">
        <div className="flex flex-wrap justify-center gap-2">
          <Button className={BUTTON_TEXT} size="sm" variant="outline" onClick={onRetry}>
            <RotateCw className="size-4" aria-hidden />
            Tekrar dene
          </Button>
          <HomeButton />
        </div>
      </StateCard>
    </div>
  );
}
