'use client';

import {
  CopyButton,
  DataList,
  DataListTitle,
  MenuItem,
  type DataListColumn,
} from '@skylab-kulubu/skylcn-ui';
import { Pencil, Plus, QrCode, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ColumnPicker, useColumnChoice, type ColumnChoice } from '@/components/chrome/ColumnPicker';
import { ListFooter, ListPage, RowMenu, SummaryStrip } from '@/components/chrome/ListPage';
import { ListToolbar } from '@/components/chrome/ListToolbar';
import { Command, CommandBar } from '@/components/chrome/object-page/CommandBar';
import { ObjectCard, ObjectEssentials } from '@/components/chrome/object-page/ObjectPage';
import { EmptyState, Forbidden } from '@/components/chrome/PageState';
import { QrPreview } from '@/components/chrome/QrPreview';
import { SidePanel, panelNeighbours } from '@/components/chrome/SidePanel';
import { StatusChip } from '@/components/chrome/StatusChip';
import { LinkForm, type LinkFormValue } from '@/components/urls/LinkForm';
import { LinkStats } from '@/components/urls/LinkStats';
import { useAuth } from '@/context/AuthContext';
import {
  publicShortUrl,
  shortQrFileName,
  shortQrPath,
  shortQrUrl,
  urlsApi,
  type ShortUrl,
} from '@/lib/api/urls';
import { canModerateUrls, canUseUrls } from '@/lib/auth/groups';
import { coreProblemMessage } from '@/lib/core-problems';
import { matchesQuery, paginateRows } from '@/lib/list-query';
import {
  asLinkSort,
  asLinkView,
  linksInView,
  mostClicked,
  sortLinks,
  targetHost,
  type LinkView,
} from '@/lib/short-link-list';
import {
  isManaged,
  isManagedRefusal,
  linkKind,
  linkKindLabel,
  managedDeleteWarning,
  managedNote,
  managedRefusalMessage,
} from '@/lib/short-links';
import { formatApplicantWhen } from '@/lib/tickets-ui';
import { TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { UNDO_HINT, useConfirm } from '@/lib/ui/use-confirm';
import { useListParams } from '@/lib/ui/use-list-params';
import { useNotify } from '@/lib/ui/use-notify';
import { useAppCanSince } from '@/lib/use-app-can';

const PAGE_SIZE = 50;

/** core's bare 409 on a short link's create or save: the alias is in use. */
const ALIAS_TAKEN = { 409: 'Bu kısa ad alınmış; başka bir ad seç.' };

const COLUMNS: readonly ColumnChoice[] = [
  { id: 'link', label: 'Kısa link', fixed: true },
  { id: 'kind', label: 'Tür' },
  { id: 'clicks', label: 'Tıklama' },
  { id: 'created', label: 'Oluşturma', hidden: true },
  { id: 'actions', label: 'Eylemler', fixed: true },
];

const VIEW_LABELS: Record<LinkView, string> = {
  mine: 'Benim',
  all: 'Tümü',
  personal: 'Kişisel',
  form: 'Form',
  event: 'Etkinlik',
};

export default function UrlsPage() {
  const { user } = useAuth();
  const groups = user?.groups ?? [];
  const roles = user?.roles ?? [];
  const allowed = canUseUrls(groups, roles);
  const moderate = canModerateUrls(groups, roles);
  // core's url.moderateWrite: changing someone else's link. A DK member reads
  // everyone's links (url.moderate) but changes none; an older core without
  // the key answers url.moderate, and the group rule stands in when unread.
  const moderateWrite = useAppCanSince(moderate)('url.moderateWrite', 'url.moderate');
  const canChange = (row: ShortUrl) =>
    moderateWrite || (Boolean(user?.id) && row.createdBy === user?.id);
  const [rows, setRows] = useState<ShortUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [params, setParams] = useListParams({ view: 'mine', sort: 'new' });
  const view = asLinkView(params.view, moderate);
  const sort = asLinkSort(params.sort, moderate);
  const columns = useColumnChoice('skylab.admin.columns.urls', COLUMNS);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const notify = useNotify();
  const [confirm, confirmDialog] = useConfirm();
  // Only the latest load fills the list, so a slow answer of an older one is dropped
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    if (!allowed) return;
    const seq = ++loadSeq.current;
    try {
      // A URL moderator reads every link once; "Benim" is their own among them
      const next = moderate ? await urlsApi.listAll() : await urlsApi.listMine();
      if (seq !== loadSeq.current) return;
      setRows(next ?? []);
      setFailed(null);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setFailed(coreProblemMessage(err, 'Kısa linkler yüklenemedi'));
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [allowed, moderate]);

  useEffect(() => {
    void load();
  }, [load]);

  // Someone who reads only their own links holds nothing else under "Benim"
  const inView = useCallback(
    (target: LinkView) =>
      target === 'mine' && !moderate ? rows : linksInView(rows, target, user?.id),
    [rows, moderate, user?.id],
  );
  const searched = useMemo(
    () =>
      inView(view).filter((row) =>
        matchesQuery(params.q, row.alias, row.url, row.label, publicShortUrl(row.alias)),
      ),
    [inView, view, params.q],
  );
  const sorted = useMemo(() => sortLinks(searched, sort), [searched, sort]);
  const paged = paginateRows(sorted, params.page, PAGE_SIZE);
  const open = panelNeighbours(paged.slice, params.panel, (row) => row.id);
  // A link opened from an address that is not on this page still opens
  const openRow = open.row ?? rows.find((row) => row.id === params.panel) ?? null;
  const filtered = Boolean(params.q.trim()) || view !== 'mine';
  const viewOptions: LinkView[] = moderate ? ['mine', 'all', 'form', 'event'] : ['mine'];
  const top = moderate ? mostClicked(rows) : null;

  function reloadOnManaged(err: unknown) {
    if (isManagedRefusal(err)) void load();
  }

  function refusalText(
    err: unknown,
    row: ShortUrl,
    fallback: string,
    statusText: Partial<Record<number, string>> = {},
  ): string {
    if (isManagedRefusal(err)) return managedRefusalMessage(row);
    return coreProblemMessage(err, fallback, statusText);
  }

  function startCreate() {
    setFormError(null);
    setFormDirty(false);
    setEditingId(null);
    setCreating(true);
  }

  function startEdit(row: ShortUrl) {
    setFormError(null);
    setFormDirty(false);
    setCreating(false);
    setEditingId(row.id);
    if (params.panel !== row.id) setParams({ panel: row.id });
  }

  function closePanel() {
    setCreating(false);
    setEditingId(null);
    setFormDirty(false);
    if (params.panel) setParams({ panel: null });
  }

  async function create(value: LinkFormValue) {
    setFormError(null);
    try {
      const made = await urlsApi.create({ url: value.url, alias: value.alias || undefined });
      notify.success('Kısa link oluşturuldu');
      setCreating(false);
      setFormDirty(false);
      await load();
      if (made?.id) setParams({ panel: made.id });
    } catch (err) {
      setFormError(coreProblemMessage(err, 'Kısaltılamadı', ALIAS_TAKEN));
    }
  }

  async function save(row: ShortUrl, value: LinkFormValue) {
    setFormError(null);
    try {
      await urlsApi.update(row.id, { url: value.url, alias: value.alias });
      notify.success('Kısa link kaydedildi');
      setEditingId(null);
      setFormDirty(false);
      await load();
    } catch (err) {
      setFormError(refusalText(err, row, 'Güncellenemedi', ALIAS_TAKEN));
      reloadOnManaged(err);
    }
  }

  function askDelete(row: ShortUrl) {
    const warning = managedDeleteWarning(row);
    confirm({
      title: `${publicShortUrl(row.alias)} silinsin mi?`,
      description: [warning, 'Link çalışmayı bırakır; tıklayan sayfa bulunamadı görür.', UNDO_HINT]
        .filter(Boolean)
        .join(' '),
      actionLabel: 'Linki sil',
      onConfirm: async () => {
        try {
          await urlsApi.remove(row.id);
        } catch (err) {
          reloadOnManaged(err);
          throw err;
        }
        if (params.panel === row.id) closePanel();
        notify.undoable(
          'Kısa link silindi',
          async () => {
            await urlsApi.restore(row.id);
            void load();
          },
          'Kısa link geri alındı',
        );
        await load();
      },
      failure: (err) =>
        refusalText(err, row, 'Kısa link silinemedi', { 409: 'Kısa link şu an silinemiyor.' }),
    });
  }

  if (!allowed) return <Forbidden pageTitle="Kısa link" />;

  /** The row's less used actions; a Form or Event link says why it stays closed. */
  function rowMenuItems(row: ShortUrl) {
    const managed = isManaged(row);
    const note = managedNote(row);
    const items = [
      <MenuItem key="qr" icon={QrCode} onClick={() => setParams({ panel: row.id })}>
        QR kodu
      </MenuItem>,
    ];
    if (canChange(row)) {
      items.push(
        <MenuItem key="edit" icon={Pencil} disabled={managed} onClick={() => startEdit(row)}>
          <MenuReason label="Düzenle" reason={managed ? note : null} />
        </MenuItem>,
        <MenuItem
          key="delete"
          icon={Trash2}
          destructive
          disabled={managed && !moderateWrite}
          onClick={() => askDelete(row)}
        >
          <MenuReason label="Sil" reason={managed && !moderateWrite ? note : null} />
        </MenuItem>,
      );
    }
    return items;
  }

  const listColumns: DataListColumn<ShortUrl>[] = [
    {
      id: 'link',
      width: 'minmax(0,1fr)',
      header: 'Kısa link',
      cell: (row) => (
        <DataListTitle
          title={<span className="text-[15px] font-semibold">{row.alias}</span>}
          // 13px: skylcn-ui's DataListTitle writes its line at 10px
          subtitle={
            <span className={TEXT_SECONDARY}>
              {[row.label?.trim(), targetHost(row.url)].filter(Boolean).join(' · ')}
            </span>
          }
        />
      ),
    },
    ...(columns.isShown('kind')
      ? [
          {
            id: 'kind',
            width: '7rem',
            from: 'md' as const,
            header: 'Tür',
            cell: (row: ShortUrl) => (
              <StatusChip kind="neutral" label={linkKindLabel(linkKind(row))} />
            ),
          },
        ]
      : []),
    ...(moderate && columns.isShown('clicks')
      ? [
          {
            id: 'clicks',
            width: '6rem',
            from: 'sm' as const,
            align: 'end' as const,
            header: 'Tıklama',
            cell: (row: ShortUrl) => (
              <span className="text-secondary-foreground text-[13px]/5 tabular-nums">
                {row.clickCount}
              </span>
            ),
          },
        ]
      : []),
    ...(columns.isShown('created')
      ? [
          {
            id: 'created',
            width: '9rem',
            from: 'lg' as const,
            header: 'Oluşturma',
            cell: (row: ShortUrl) => (
              <span className="text-secondary-foreground text-[13px]/5">
                {formatApplicantWhen(row.createdAt)}
              </span>
            ),
          },
        ]
      : []),
    {
      id: 'actions',
      width: '5.5rem',
      label: 'Eylemler',
      interactive: true,
      align: 'end',
      cell: (row) => (
        <span className="flex items-center gap-1">
          {/* The tick shows in place; a copy is not a write, so no toast */}
          <CopyButton
            value={publicShortUrl(row.alias)}
            label={`${row.alias}: kopyala`}
            variant="ghost"
            size="icon-sm"
          />
          <RowMenu rowName={row.alias}>{rowMenuItems(row)}</RowMenu>
        </span>
      ),
    },
  ];

  const empty = failed ? (
    <EmptyState kind="failed" title={failed} onRetry={() => void load()} />
  ) : filtered ? (
    <EmptyState kind="no-results" onClear={() => setParams({ q: '', view: 'mine' })} />
  ) : (
    <EmptyState
      kind="first-use"
      title="Henüz kısa link yok"
      action={<Command primary icon={Plus} label="Kısa link ekle" onClick={startCreate} />}
    />
  );

  const editing = openRow && editingId === openRow.id ? openRow : null;
  const panelOpen = creating || Boolean(openRow);
  const panelTitle = creating
    ? 'Kısa link ekle'
    : editing
      ? 'Kısa linki düzenle'
      : openRow
        ? openRow.alias
        : '';

  return (
    <ListPage
      title="Kısa link"
      commands={
        <CommandBar label="Kısa link komutları">
          <Command primary icon={Plus} label="Kısa link ekle" onClick={startCreate} />
          <Command icon={RefreshCw} label="Yenile" onClick={() => void load()} />
        </CommandBar>
      }
      summary={
        moderate && rows.length ? (
          <SummaryStrip
            items={[
              {
                key: 'all',
                label: 'Link',
                value: rows.length,
                active: view === 'all',
                onSelect: () => setParams({ view: 'all' }),
              },
              {
                key: 'clicks',
                label: 'Tıklama, 90 gün',
                value: rows.reduce((sum, row) => sum + row.clickCount, 0),
                active: view === 'all' && sort === 'clicks',
                onSelect: () => setParams({ view: 'all', sort: 'clicks' }),
              },
              {
                key: 'top',
                label: 'En çok tıklanan',
                value: top ? <span className="text-xl">{top.alias}</span> : '—',
                hint: top ? (
                  <span className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
                    {top.clickCount} tıklama
                  </span>
                ) : undefined,
                onSelect: top ? () => setParams({ view: 'all', panel: top.id }) : undefined,
              },
            ]}
          />
        ) : null
      }
      toolbar={
        <ListToolbar
          query={params.q}
          onQuery={(q) => setParams({ q })}
          commitDelay={250}
          placeholder="Kısa ad ya da hedef"
          searchLabel="Kısa link ara"
          views={
            viewOptions.length > 1
              ? viewOptions.map((value) => ({
                  value,
                  label: VIEW_LABELS[value],
                  count: inView(value).length,
                }))
              : undefined
          }
          view={view}
          onView={(next) => setParams({ view: next })}
          sort={{
            value: sort,
            onChange: (next) => setParams({ sort: next }),
            options: [
              { value: 'new', label: 'En yeni' },
              ...(moderate ? [{ value: 'clicks' as const, label: 'En çok tıklanan' }] : []),
              { value: 'alias', label: 'Ada göre' },
            ],
          }}
          columns={
            <ColumnPicker
              columns={moderate ? COLUMNS : COLUMNS.filter((column) => column.id !== 'clicks')}
              isShown={columns.isShown}
              onToggle={columns.toggle}
            />
          }
        />
      }
      footer={
        <ListFooter
          total={sorted.length}
          page={paged.page}
          totalPages={paged.totalPages}
          pageSize={PAGE_SIZE}
          onPage={(page) => setParams({ page })}
        />
      }
    >
      {!loading && (failed || sorted.length === 0) ? (
        empty
      ) : (
        <DataList
          columns={listColumns}
          rows={paged.slice}
          getRowId={(row) => row.id}
          onRowSelect={(row) => setParams({ panel: row.id })}
          rowLabel={(row) => publicShortUrl(row.alias)}
          loading={loading}
          skeletonRows={6}
        />
      )}
      {confirmDialog}
      <SidePanel
        open={panelOpen}
        title={panelTitle}
        onPrev={!creating && open.prev ? () => setParams({ panel: open.prev }) : undefined}
        onNext={!creating && open.next ? () => setParams({ panel: open.next }) : undefined}
        onClose={closePanel}
        dirty={formDirty}
      >
        {creating ? (
          <LinkForm mode="create" onSubmit={create} onDirty={setFormDirty} error={formError} />
        ) : editing ? (
          <LinkForm
            key={editing.id}
            mode="edit"
            initial={{ url: editing.url, alias: editing.alias }}
            currentAlias={editing.alias}
            onSubmit={(value) => save(editing, value)}
            onDirty={setFormDirty}
            error={formError}
          />
        ) : openRow ? (
          <LinkDetails
            row={openRow}
            moderate={moderate}
            canEdit={canChange(openRow) && !isManaged(openRow)}
            canDelete={canChange(openRow) && (!isManaged(openRow) || moderateWrite)}
            onEdit={() => startEdit(openRow)}
            onDelete={() => askDelete(openRow)}
          />
        ) : null}
      </SidePanel>
    </ListPage>
  );
}

/** One link beside the list: the address to copy, its facts, its QR code and its clicks. */
function LinkDetails({
  row,
  moderate,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  row: ShortUrl;
  moderate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const short = publicShortUrl(row.alias);
  const note = managedNote(row);
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-foreground-strong min-w-0 flex-1 truncate text-sm font-medium">
          {short}
        </span>
        <CopyButton value={short} label="Kopyala" variant="outline" size="sm" />
      </div>
      {canEdit || canDelete ? (
        <CommandBar label="Kısa link komutları">
          {canEdit ? <Command icon={Pencil} label="Düzenle" onClick={onEdit} /> : null}
          {canDelete ? <Command icon={Trash2} label="Sil" onClick={onDelete} /> : null}
        </CommandBar>
      ) : null}
      <ObjectEssentials
        columns={1}
        items={[
          {
            label: 'Hedef',
            value: (
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                className="text-skylab-300 break-all hover:underline"
              >
                {row.url}
              </a>
            ),
          },
          { label: 'Tür', value: note ? `${linkKindLabel(linkKind(row))} · ${note}` : 'Kişisel' },
          ...(row.label?.trim() ? [{ label: 'Ad', value: row.label }] : []),
          { label: 'Oluşturma', value: formatApplicantWhen(row.createdAt) },
        ]}
      />
      {moderate ? <LinkStats id={row.id} /> : null}
      <ObjectCard title="QR kodu">
        <QrPreview
          imageUrl={shortQrUrl(row.alias)}
          downloadPath={shortQrPath(row.alias, { size: 1024 })}
          fileName={shortQrFileName(row.alias)}
          label={`QR ${row.alias}`}
        />
      </ObjectCard>
    </>
  );
}

/** A menu action, and under it why it is closed: the desktop says it on hover, a phone cannot. */
function MenuReason({ label, reason }: { label: string; reason: string | null }) {
  return (
    <span className="flex flex-col">
      {label}
      {reason ? <span className="text-subtle-foreground text-xs">{reason}</span> : null}
    </span>
  );
}
