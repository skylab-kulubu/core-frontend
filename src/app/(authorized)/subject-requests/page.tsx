'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { ActionButton } from '@/components/chrome/ActionButton';
import { Drawer } from '@/components/chrome/Drawer';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { ListItem } from '@/components/chrome/ListItem';
import { FilterPills, ListToolbar } from '@/components/chrome/ListToolbar';
import { ListPanel } from '@/components/chrome/ListPanel';
import { Pagination } from '@/components/chrome/Pagination';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import { StateCard } from '@/components/chrome/StateCard';
import { StatusChip } from '@/components/chrome/StatusChip';
import { TextArea } from '@/components/chrome/TextArea';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  subjectRequestsApi,
  type SubjectRequest,
  type SubjectRequestBody,
  type SubjectRequestChannel,
  type SubjectRequestEvent,
  type SubjectRequestStatus,
} from '@/lib/api/subject-requests';
import { useCapabilities } from '@/lib/capabilities-context';
import { coreProblemMessage } from '@/lib/core-problems';
import { emptyListCopy, matchesQuery, paginateRows } from '@/lib/list-query';
import { listStatus } from '@/lib/list-status';
import {
  CHANNEL_LABELS,
  DEFAULT_RESPONDER,
  STATUS_LABELS,
  TYPE_LABELS,
  TYPE_ORDER,
  deadlineBadge,
  describeFields,
  formatDay,
  isConcluded,
  statusKind,
  todayInTurkey,
} from '@/lib/subject-requests';
import { useAppCan } from '@/lib/use-app-can';
import { useNotify } from '@/lib/ui/use-notify';

type Filter = 'open' | 'concluded' | 'all';

type Form = {
  receivedOn: string;
  channel: SubjectRequestChannel;
  requesterName: string;
  requesterContact: string;
  userId: string;
  requestTypes: SubjectRequestBody['requestTypes'];
  status: SubjectRequestStatus;
  answeredOn: string;
  answerSummary: string;
  responder: string;
};

const emptyForm = (today: string): Form => ({
  receivedOn: today,
  channel: 'email',
  requesterName: '',
  requesterContact: '',
  userId: '',
  requestTypes: [],
  status: 'received',
  answeredOn: '',
  answerSummary: '',
  responder: DEFAULT_RESPONDER,
});

function formOf(request: SubjectRequest): Form {
  return {
    receivedOn: request.receivedOn,
    channel: request.channel,
    requesterName: request.requesterName,
    requesterContact: request.requesterContact,
    userId: request.userId ?? '',
    requestTypes: request.requestTypes,
    status: request.status,
    answeredOn: request.answeredOn ?? '',
    answerSummary: request.answerSummary,
    responder: request.responder,
  };
}

function bodyOf(form: Form): SubjectRequestBody {
  const concluded = isConcluded(form.status);
  return {
    receivedOn: form.receivedOn,
    channel: form.channel,
    requesterName: form.requesterName.trim(),
    requesterContact: form.requesterContact.trim(),
    userId: form.userId.trim() || null,
    requestTypes: form.requestTypes,
    status: form.status,
    answeredOn: concluded ? form.answeredOn || null : null,
    answerSummary: form.answerSummary.trim(),
    responder: form.responder.trim(),
  };
}

function eventLine(event: SubjectRequestEvent): string {
  const at = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(event.at));
  const what =
    event.action === 'create' ? 'Kaydedildi' : `Değişti: ${describeFields(event.fields)}`;
  return `${at} · ${what} · ${STATUS_LABELS[event.status]}`;
}

/** KVKK başvuruları: the register of md. 11 requests (core /v1/subject-requests). ADMIN and YK only. */
export default function SubjectRequestsPage() {
  const capabilities = useCapabilities();
  const canManage = useAppCan(false)('subjectRequest.manage');
  const today = todayInTurkey();
  const [requests, setRequests] = useState<SubjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('open');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm(today));
  const [events, setEvents] = useState<SubjectRequestEvent[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const notify = useNotify();

  async function load() {
    try {
      setRequests(await subjectRequestsApi.list());
      setError(null);
    } catch (err) {
      setError(coreProblemMessage(err, 'Başvurular yüklenemedi'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canManage) void load();
  }, [canManage]);

  useEffect(() => {
    setPage(1);
  }, [query, filter]);

  const filtered = useMemo(
    () =>
      requests.filter((request) => {
        const concluded = isConcluded(request.status);
        if (filter === 'open' && concluded) return false;
        if (filter === 'concluded' && !concluded) return false;
        return matchesQuery(query, request.requesterName, request.requesterContact);
      }),
    [requests, query, filter],
  );
  const paged = paginateRows(filtered, page);

  if (capabilities.status === 'loading') return <StateCard title="Yükleniyor…" isLoading />;
  if (!canManage) return <StateCard title="Bu kayda yalnız YK erişir" />;

  const concluded = isConcluded(form.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title="KVKK başvuruları"
        description="İlgili kişi başvuruları (KVKK md. 11). Cevap süresi başvurudan itibaren 30 gün."
        actions={
          <ActionButton
            icon={Plus}
            variant="primary"
            label="Başvuru ekle"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm(today));
              setEvents([]);
              setFormError(null);
              setOpen(true);
            }}
          />
        }
      />
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <ListToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Ad ya da iletişim"
        searchLabel="Başvuru ara"
      >
        <FilterPills
          ariaLabel="Başvuru durumu"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: 'Açık' },
            { value: 'concluded', label: 'Sonuçlanan' },
            { value: 'all', label: 'Tümü' },
          ]}
        />
      </ListToolbar>
      <ListPanel
        status={listStatus({
          loading,
          failed: Boolean(error),
          rowCount: filtered.length,
          emptyMessage: emptyListCopy({
            none: 'Başvuru yok',
            noneMatch: 'Eşleşen başvuru yok',
            query,
            filtered: filter !== 'all',
          }),
        })}
      >
        {paged.slice.map((request) => {
          const badge = deadlineBadge(request, today);
          const when = isConcluded(request.status)
            ? `cevap ${formatDay(request.answeredOn)}`
            : `son gün ${formatDay(request.dueOn)}`;
          return (
            <ListItem
              key={request.id}
              title={request.requesterName}
              subtitle={`${formatDay(request.receivedOn)} · ${CHANNEL_LABELS[request.channel]} · ${when}`}
              trailing={
                <div className="flex items-center gap-1">
                  {badge ? <StatusChip kind={badge.kind} label={badge.label} /> : null}
                  <StatusChip
                    kind={statusKind(request.status)}
                    label={STATUS_LABELS[request.status]}
                  />
                  <ActionButton
                    icon={Pencil}
                    label="Düzenle"
                    onClick={() => {
                      setEditingId(request.id);
                      setForm(formOf(request));
                      setEvents([]);
                      setFormError(null);
                      setOpen(true);
                      subjectRequestsApi
                        .get(request.id)
                        .then((full) => setEvents(full.events ?? []))
                        .catch(() => setEvents([]));
                    }}
                  />
                </div>
              }
            />
          );
        })}
      </ListPanel>
      <Pagination current={paged.page} totalPages={paged.totalPages} onPageChange={setPage} />
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? 'Başvuruyu düzenle' : 'Başvuru ekle'}
      >
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setFormError(null);
            if (form.requestTypes.length === 0) {
              setFormError('En az bir talep türü seç.');
              return;
            }
            try {
              const body = bodyOf(form);
              if (editingId) await subjectRequestsApi.update(editingId, body);
              else await subjectRequestsApi.create(body);
              setOpen(false);
              notify.success(editingId ? 'Başvuru kaydedildi' : 'Başvuru eklendi');
              await load();
            } catch (err) {
              setFormError(coreProblemMessage(err, 'Kaydedilemedi'));
            }
          }}
        >
          <p className="text-muted-foreground text-xs">
            T.C. kimlik no, adres, onay kodu ya da kimlik belgesi yazma.
          </p>
          <label className="block space-y-1">
            <FieldLabel>Başvuru tarihi</FieldLabel>
            <Field
              type="date"
              value={form.receivedOn}
              max={today}
              onChange={(e) => setForm({ ...form, receivedOn: e.target.value })}
              required
            />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Kanal</FieldLabel>
            <Select
              value={form.channel}
              onChange={(e) =>
                setForm({ ...form, channel: e.target.value as SubjectRequestChannel })
              }
            >
              {(Object.keys(CHANNEL_LABELS) as SubjectRequestChannel[]).map((channel) => (
                <option key={channel} value={channel}>
                  {CHANNEL_LABELS[channel]}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1">
            <FieldLabel>Ad soyad</FieldLabel>
            <Field
              value={form.requesterName}
              maxLength={200}
              onChange={(e) => setForm({ ...form, requesterName: e.target.value })}
              required
            />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Cevabın gideceği adres</FieldLabel>
            <Field
              value={form.requesterContact}
              maxLength={320}
              onChange={(e) => setForm({ ...form, requesterContact: e.target.value })}
              required
            />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Hesap kimliği (hesabı varsa)</FieldLabel>
            <Field
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
            />
          </label>
          <fieldset className="space-y-2">
            <legend>
              <FieldLabel>Talep türü</FieldLabel>
            </legend>
            {TYPE_ORDER.map((type) => (
              <label key={type} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.requestTypes.includes(type)}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      requestTypes: event.target.checked
                        ? TYPE_ORDER.filter((t) => t === type || form.requestTypes.includes(t))
                        : form.requestTypes.filter((t) => t !== type),
                    })
                  }
                />
                <span>{TYPE_LABELS[type]}</span>
              </label>
            ))}
          </fieldset>
          <label className="block space-y-1">
            <FieldLabel>Durum</FieldLabel>
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as SubjectRequestStatus })}
            >
              {(Object.keys(STATUS_LABELS) as SubjectRequestStatus[]).map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </label>
          {concluded ? (
            <label className="block space-y-1">
              <FieldLabel>Cevap tarihi</FieldLabel>
              <Field
                type="date"
                value={form.answeredOn}
                min={form.receivedOn}
                max={today}
                onChange={(e) => setForm({ ...form, answeredOn: e.target.value })}
                required
              />
            </label>
          ) : null}
          <label className="block space-y-1">
            <FieldLabel>Cevap özeti</FieldLabel>
            <TextArea
              value={form.answerSummary}
              maxLength={2000}
              rows={3}
              onChange={(e) => setForm({ ...form, answerSummary: e.target.value })}
            />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Yanıtlayan</FieldLabel>
            <Field
              value={form.responder}
              maxLength={100}
              onChange={(e) => setForm({ ...form, responder: e.target.value })}
            />
          </label>
          {editingId && events.length ? (
            <section className="space-y-1">
              <FieldLabel>Geçmiş</FieldLabel>
              <ul className="text-muted-foreground space-y-1 text-xs">
                {events.map((event, index) => (
                  <li key={`${event.at}-${index}`}>{eventLine(event)}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {formError ? (
            <p role="alert" className="text-destructive text-sm">
              {formError}
            </p>
          ) : null}
          <SaveButton>Kaydet</SaveButton>
        </form>
      </Drawer>
    </div>
  );
}
