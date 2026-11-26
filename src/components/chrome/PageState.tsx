'use client';

import {
  Button,
  ForbiddenScenePage,
  NotFoundScenePage,
  ServerErrorScenePage,
} from '@skylab-kulubu/skylcn-ui';
import { CircleAlert, Inbox, RotateCw, Search, SearchX, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { StateCard } from '@/components/chrome/StateCard';
import { useOpenSearch } from '@/components/layout/search-context';
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
 *
 * A whole page that cannot be shown (no access, not found, broke while drawing) takes the
 * club's error scene instead (skylcn-ui ErrorScene), as `div` inside the chrome: the scene's
 * title is the page's h1, so these pages draw no PageHeader of their own. A forbidden tab
 * inside an object page keeps the card, under the object's own h1.
 *
 * No error details; a forbidden page names no role.
 */

const HOME = '/dashboard';

function HomeButton() {
  return (
    <Button className={BUTTON_TEXT} size="sm" variant="outline" render={<Link href={HOME} />}>
      Özete dön
    </Button>
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
 * The one "no access" state. A whole page (`pageTitle` given) takes the 403 scene, back to
 * Özet; a tab inside an object page (no `pageTitle`) keeps the card under the object's h1.
 * Pages do not write their own; `note` is one short line when the reader must know whom to ask.
 */
export function Forbidden({ pageTitle, note }: { pageTitle?: string; note?: string }) {
  if (pageTitle) {
    return <ForbiddenScenePage as="div" href={HOME} description={note} />;
  }
  return (
    <StateCard title="Bu sayfaya erişimin yok" description={note} Icon={ShieldAlert} tone="warning">
      <HomeButton />
    </StateCard>
  );
}

/** "Ara" beside a missing page's way back, when the chrome's search is there. */
export function SearchButton() {
  const openSearch = useOpenSearch();
  if (!openSearch) return null;
  return (
    <Button className={BUTTON_TEXT} variant="ghost" onClick={openSearch}>
      <Search className="size-4" aria-hidden />
      Ara
    </Button>
  );
}

/** The panel's not-found page, inside the chrome: the 404 scene, back to Özet, or search. */
export function NotFoundState() {
  return (
    <NotFoundScenePage as="div" href={HOME}>
      <SearchButton />
    </NotFoundScenePage>
  );
}

/** A page that broke while drawing (a route's error.tsx): the 500 scene, try again, or back to Özet. */
export function RouteErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <ServerErrorScenePage as="div" onAction={onRetry}>
      <Button className={BUTTON_TEXT} variant="outline" render={<Link href={HOME} />}>
        Özete dön
      </Button>
    </ServerErrorScenePage>
  );
}
