'use client';

import {
  Button,
  CommandPalette,
  Kbd,
  useCommandShortcut,
  type CommandItem,
} from '@skylab-kulubu/skylcn-ui';
import { CalendarDays, CalendarPlus, FolderTree, Search, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react';
import { useNewEvent } from '@/components/scheduling/NewEventProvider';
import { eventsApi, type CoreEvent } from '@/lib/api/events';
import { identityApi, type Group, type Person } from '@/lib/api/identity';
import { isPrivileged } from '@/lib/auth/groups';
import { navIcon } from '@/lib/navigation/nav-icons';
import {
  eventSearchItems,
  groupSearchItems,
  PERSON_SEARCH_MIN,
  personSearchItems,
  type SearchItem,
} from '@/lib/navigation/search-items';
import { searchPages, type SidebarNavigationContext } from '@/lib/navigation/sidebar-nav';
import type { UserDto } from '@/types/api';

const PLACEHOLDER = 'Sayfa, etkinlik ya da kişi ara';

const RECORD_ICON = {
  Etkinlikler: CalendarDays,
  Kişiler: UserRound,
  Gruplar: FolderTree,
} as const;

const noSubscription = () => () => {};
const onApple = () => /Mac|iPhone|iPad/.test(navigator.platform);

/** What the person may search besides the pages: the lists they can open from the sidebar. */
function searchScope(user: UserDto, pages: ReadonlyArray<{ href: string }>) {
  const hrefs = new Set(pages.map((page) => page.href));
  return {
    events: hrefs.has('/events'),
    people: hrefs.has('/users'),
    groups: hrefs.has('/groups') && isPrivileged(user.groups ?? []),
  };
}

/**
 * The records Ctrl+K finds: events and groups read once each time it opens and
 * matched here, people searched in core as the query is typed (as every person
 * picker does: from two characters, 250 ms after the last key).
 */
function useRecordSearch(
  open: boolean,
  query: string,
  scope: ReturnType<typeof searchScope>,
): SearchItem[] {
  const [events, setEvents] = useState<CoreEvent[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [people, setPeople] = useState<{ query: string; rows: Person[] }>({
    query: '',
    rows: [],
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    if (scope.events) {
      eventsApi
        .list(undefined, undefined, { drafts: true })
        .then((rows) => !cancelled && setEvents(rows))
        .catch(() => undefined);
    }
    if (scope.groups) {
      identityApi
        .listGroups()
        .then((rows) => !cancelled && setGroups(rows))
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [open, scope.events, scope.groups]);

  const personQuery = query.trim();
  const searchesPeople = open && scope.people && personQuery.length >= PERSON_SEARCH_MIN;
  useEffect(() => {
    if (!searchesPeople) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      identityApi
        .listUsers(personQuery)
        .then((rows) => !cancelled && setPeople({ query: personQuery, rows }))
        .catch(() => undefined);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [personQuery, searchesPeople]);

  return useMemo(
    () => [
      ...eventSearchItems(events, query),
      // An answer for an older query is not shown under a newer one
      ...(searchesPeople && people.query === personQuery
        ? personSearchItems(people.rows, personQuery)
        : []),
      ...groupSearchItems(groups, query),
    ],
    [events, groups, people, personQuery, query, searchesPeople],
  );
}

/** "Hızlı git": every page the sidebar offers, and the events, people and groups the person may open (Ctrl/⌘+K). */
export function AdminSearch({
  user,
  navigationContext,
}: {
  user: UserDto;
  navigationContext: SidebarNavigationContext;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // skylcn-ui's palette clears its text only when it closes itself (Esc, outside), not when a
  // result is picked: a new palette on every opening starts empty, as `query` does here
  const [openings, setOpenings] = useState(0);
  const show = useCallback(() => {
    setOpenings((n) => n + 1);
    setOpen(true);
  }, []);
  const apple = useSyncExternalStore(noSubscription, onApple, () => false);
  useCommandShortcut(show);

  const pages = useMemo(() => searchPages(user, navigationContext), [navigationContext, user]);
  const scope = useMemo(() => searchScope(user, pages), [pages, user]);
  const records = useRecordSearch(open, query, scope);
  const newEvent = useNewEvent();

  const items = useMemo<CommandItem[]>(
    () => [
      // core's event.create, as the events page's own button
      ...(newEvent.canCreate
        ? [
            {
              id: 'action:new-event',
              label: 'Yeni etkinlik',
              group: 'Eylemler',
              icon: CalendarPlus,
              keywords: 'oluştur ekle',
              onSelect: newEvent.open,
            },
          ]
        : []),
      ...pages.map((page) => ({
        id: page.href,
        label: page.label,
        group: 'Sayfalar',
        icon: navIcon(page.href),
        keywords: [page.section, page.keywords].filter(Boolean).join(' ') || undefined,
        href: page.href,
      })),
      ...records.map((record) => ({
        id: record.id,
        label: record.label,
        group: record.group,
        icon: RECORD_ICON[record.group as keyof typeof RECORD_ICON],
        keywords: record.keywords,
        shortcut: record.note,
        href: record.href,
      })),
    ],
    [newEvent, pages, records],
  );

  // skylcn-ui's palette keeps its query to itself; its input's change reaches here through
  // React's tree (the palette is a portal under this element). skylcn-ui should take an
  // onQueryChange for searches that ask a server.
  const onPaletteInput = (event: FormEvent<HTMLDivElement>) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.getAttribute('role') === 'combobox') {
      setQuery(target.value);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={show} aria-label="Hızlı git" className="gap-2">
        <Search />
        <span className="text-subtle-foreground hidden lg:inline">Hızlı git</span>
        <span className="hidden items-center gap-0.5 lg:flex">
          <Kbd>{apple ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </Button>
      <div className="contents" onChange={onPaletteInput}>
        <CommandPalette
          key={openings}
          items={items}
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setQuery('');
          }}
          navigate={(href) => router.push(href)}
          placeholder={PLACEHOLDER}
        />
      </div>
    </>
  );
}
