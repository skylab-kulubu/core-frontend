'use client';

import {
  BulkBar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  IconButton,
  cn,
  type DataListColumn,
} from '@skylab-kulubu/skylcn-ui';
import { MoreHorizontal, X } from 'lucide-react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pagination } from '@/components/chrome/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';

/**
 * A list page (Entra "All users", Azure "All resources"), top to bottom: the title,
 * the command bar, optional summary cards that filter, the toolbar, the list and its
 * footer. The row's side panel can sit anywhere inside; it draws over the page.
 *
 * ```tsx
 * <ListPage
 *   title="Duyurular"
 *   commands={
 *     selection.count ? (
 *       <SelectionBar count={selection.count} onClear={selection.clear}>
 *         <Command icon={Mail} label="E-posta" onClick={mailChosen} />
 *       </SelectionBar>
 *     ) : (
 *       <CommandBar label="Duyuru komutları">
 *         <Command primary icon={Plus} label="Duyuru ekle" href="/announcements/new" />
 *         <Command icon={RefreshCw} label="Yenile" onClick={reload} />
 *       </CommandBar>
 *     )
 *   }
 *   summary={<SummaryStrip items={…} />}
 *   toolbar={<ListToolbar query={params.q} onQuery={(q) => setParams({ q })} commitDelay={250} … />}
 *   footer={<ListFooter total={rows.length} page={paged.page} totalPages={paged.totalPages} onPage={(page) => setParams({ page })} />}
 * >
 *   <DataList … />
 * </ListPage>
 * ```
 */
export function ListPage({
  title,
  badge,
  commands,
  summary,
  toolbar,
  footer,
  children,
  className,
}: {
  title: ReactNode;
  /** At most one status badge beside the title. */
  badge?: ReactNode;
  /**
   * The command bar under the title: the object pages' CommandBar, Command and
   * CommandMenu (chrome/object-page/CommandBar), or SelectionBar while rows are chosen.
   */
  commands?: ReactNode;
  /** The SummaryStrip, when the figures help. */
  summary?: ReactNode;
  /** The ListToolbar. */
  toolbar?: ReactNode;
  /** The ListFooter: the count and the pages. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-col gap-3">
        <PageHeader title={title} badge={badge} />
        {commands}
      </div>
      {summary}
      <section className="flex flex-col gap-3">
        {toolbar}
        {children}
        {footer}
      </section>
    </div>
  );
}

export type SummaryItem = {
  key: string;
  label: string;
  value: ReactNode;
  /** A line or a small chart under the figure. */
  hint?: ReactNode;
  /** Pressing the card turns the list to its view; left out, the card only says. */
  onSelect?: () => void;
  /** The card's view is the list's now. */
  active?: boolean;
};

/**
 * Two to four figures over a list; each card that filters turns the list to its view
 * when pressed (P6 A). Two columns on phones.
 */
export function SummaryStrip({
  items,
  label = 'Özet',
}: {
  items: readonly SummaryItem[];
  label?: string;
}) {
  if (!items.length) return null;
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'grid grid-cols-2 gap-3',
        items.length >= 4 ? 'lg:grid-cols-4' : items.length === 3 ? 'lg:grid-cols-3' : '',
      )}
    >
      {items.map((item) => {
        const body = (
          <>
            <span className={cn('text-subtle-foreground font-medium', TEXT_SECONDARY)}>
              {item.label}
            </span>
            <span className="text-foreground-strong text-2xl leading-none font-semibold tabular-nums">
              {item.value}
            </span>
            {item.hint ? <span className="mt-auto block">{item.hint}</span> : null}
          </>
        );
        const look = cn(
          'bg-card border-border-subtle flex min-h-20 flex-col gap-1.5 rounded-lg border p-3 text-left sm:p-4',
          item.active && 'border-skylab-600/60 ring-skylab-600/25 ring-2',
        );
        return item.onSelect ? (
          <button
            key={item.key}
            type="button"
            aria-pressed={Boolean(item.active)}
            onClick={item.onSelect}
            className={cn(
              look,
              'hover:border-border focus-visible:ring-ring outline-hidden transition-colors focus-visible:ring-2',
            )}
          >
            {body}
          </button>
        ) : (
          <div key={item.key} className={look}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** Under the list: how many rows, and the pages (50 a page by the standard). */
export function ListFooter({
  total,
  page,
  totalPages,
  pageSize,
  onPage,
  noun = 'kayıt',
}: {
  total: number;
  page: number;
  totalPages: number;
  /** Given, the count reads "1–50 / 120"; else "120 kayıt". */
  pageSize?: number;
  onPage: (page: number) => void;
  noun?: string;
}) {
  if (!total) return null;
  const count = pageSize
    ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} / ${total}`
    : `${total} ${noun}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-subtle-foreground text-xs tabular-nums">{count}</p>
      {totalPages > 1 ? (
        <Pagination current={page} totalPages={totalPages} onPageChange={onPage} />
      ) : null}
    </div>
  );
}

/** "Süzgeci temizle", under an empty list that a search or a view emptied (Carbon). */
export function ClearFiltersButton({ onClear }: { onClear: () => void }) {
  return (
    <Button className={BUTTON_TEXT} size="sm" variant="outline" onClick={onClear}>
      <X className="size-4" aria-hidden />
      Süzgeci temizle
    </Button>
  );
}

/**
 * Chosen rows of a list, by id, for the bulk bar. `resetKey` is the list's view (search,
 * view chip, page): when it changes the choice is dropped, so a bulk command never reaches
 * rows the reader no longer sees. Pass, for example, `${params.q}|${params.view}|${params.page}`.
 */
export function useRowSelection(resetKey = '') {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    if (selected.size) setSelected(new Set());
  }
  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const toggleAll = useCallback((ids: readonly string[]) => {
    setSelected((current) =>
      ids.length > 0 && ids.every((id) => current.has(id))
        ? new Set([...current].filter((id) => !ids.includes(id)))
        : new Set([...current, ...ids]),
    );
  }, []);
  const clear = useCallback(() => setSelected(new Set()), []);
  return useMemo(
    () => ({ selected, count: selected.size, toggle, toggleAll, clear }),
    [selected, toggle, toggleAll, clear],
  );
}

const CHECKBOX = 'accent-skylab-400 size-3.5 shrink-0';

/**
 * A DataList column of checkboxes: one per row and one in the header for the rows
 * on the page. Put it first in `columns`.
 */
export function selectionColumn<T>({
  selection,
  pageIds,
  idOf,
  nameOf,
}: {
  selection: ReturnType<typeof useRowSelection>;
  /** The ids of the rows on the page shown, for the header's box. */
  pageIds: readonly string[];
  idOf: (row: T) => string;
  /** Names each box for screen readers: "<name> seç". */
  nameOf: (row: T) => string;
}): DataListColumn<T> {
  const all = pageIds.length > 0 && pageIds.every((id) => selection.selected.has(id));
  const some = !all && pageIds.some((id) => selection.selected.has(id));
  return {
    id: 'select',
    width: '1.75rem',
    label: 'Seç',
    interactive: true,
    header: (
      <input
        type="checkbox"
        className={CHECKBOX}
        aria-label="Sayfadakilerin hepsini seç"
        checked={all}
        // Some of the page chosen: neither ticked nor empty
        ref={(box) => {
          if (box) box.indeterminate = some;
        }}
        onChange={() => selection.toggleAll(pageIds)}
      />
    ),
    cell: (row) => (
      <input
        type="checkbox"
        className={CHECKBOX}
        aria-label={`${nameOf(row)} seç`}
        checked={selection.selected.has(idOf(row))}
        onChange={() => selection.toggle(idOf(row))}
      />
    ),
  };
}

/**
 * The command bar while rows are chosen: "3 seçili", the bulk commands (Command) and a
 * way to drop the choice. Put it in ListPage's `commands` in place of the CommandBar.
 */
export function SelectionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <BulkBar count={count} onClear={onClear}>
      {children}
    </BulkBar>
  );
}

/**
 * A row's less used actions behind "⋯" (MenuItem / MenuLinkItem children), so a row
 * keeps at most one written action of its own. The button reads "<rowName>: eylemler".
 */
export function RowMenu({ rowName, children }: { rowName: string; children: ReactNode }) {
  const name = `${rowName}: eylemler`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<IconButton icon={MoreHorizontal} size="icon-sm" variant="ghost" label={name} />}
      />
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}
