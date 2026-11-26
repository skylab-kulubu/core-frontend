'use client';

import { Button, Card, Checkbox } from '@skylab-kulubu/skylcn-ui';
import { Dices } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Field } from '@/components/chrome/Field';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { Select } from '@/components/chrome/Select';
import {
  DEFAULT_RAFFLE_CRITERIA,
  RAFFLE_MAX_ALTERNATES,
  RAFFLE_MAX_WINNERS,
  RAFFLE_TITLE_MAX,
  rafflesApi,
  type Raffle,
  type RaffleCriteria,
  type RafflePreview,
} from '@/lib/api/raffles';
import type { EventSession } from '@/lib/api/sessions';
import { useConfirm } from '@/lib/ui/use-confirm';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';
import { countedSessions, raffleDayLabel, raffleProblemMessage } from './raffle-copy';
import { useRafflePreview } from './use-raffle-preview';

type Exclusion =
  | 'excludePastWinners'
  | 'excludeOrganizers'
  | 'excludeDoorStaff'
  | 'excludeCoOrganizers';

const EXCLUSIONS: readonly {
  key: Exclusion;
  label: string;
  count: keyof RafflePreview['excluded'];
}[] = [
  { key: 'excludePastWinners', label: 'Önceki çekilişlerin kazananları', count: 'pastWinners' },
  { key: 'excludeOrganizers', label: 'Düzenleyen ekip üyeleri', count: 'organizers' },
  { key: 'excludeDoorStaff', label: 'Kapı görevlileri', count: 'doorStaff' },
  {
    key: 'excludeCoOrganizers',
    label: 'Ortak düzenleyen ekipler ve kişiler',
    count: 'coOrganizers',
  },
];

const EXCLUDED_WORDS: Record<keyof RafflePreview['excluded'], string> = {
  pastWinners: 'önceki kazanan',
  organizers: 'düzenleyen',
  doorStaff: 'kapı görevlisi',
  coOrganizers: 'ortak düzenleyen',
};

/** A whole number in [min, max], or null. */
function wholeNumber(text: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const value = Number(text);
  return value >= min && value <= max ? value : null;
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="text-secondary-foreground flex items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(next) => onChange(next)} />
      {label}
    </label>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-foreground mb-2 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

/** The "excluded" line under the count: "Hariç: 3 önceki kazanan · 12 düzenleyen". */
function excludedLine(preview: RafflePreview): string {
  const parts = (Object.keys(EXCLUDED_WORDS) as (keyof RafflePreview['excluded'])[])
    .filter((key) => (preview.excluded?.[key] ?? 0) > 0)
    .map((key) => `${preview.excluded[key]} ${EXCLUDED_WORDS[key]}`);
  return parts.length ? `Hariç tutulan: ${parts.join(' · ')}` : '';
}

/**
 * The new raffle: who may be drawn, how many of them now (asked of core as the form changes),
 * their masked names, and how many winners and alternates to draw.
 */
export function RaffleForm({
  eventId,
  sessions,
  dates,
  onDrawn,
}: {
  eventId: string;
  sessions: readonly EventSession[];
  /** The Event's days, 'YYYY-MM-DD'. */
  dates: readonly string[];
  onDrawn: (raffle: Raffle) => void;
}) {
  const ids = useId();
  const [confirm, confirmDialog] = useConfirm();
  const [criteria, setCriteria] = useState<RaffleCriteria>(DEFAULT_RAFFLE_CRITERIA);
  const [minCounted, setMinCounted] = useState('');
  const [title, setTitle] = useState('');
  const [winners, setWinners] = useState('1');
  const [alternates, setAlternates] = useState('1');
  const [listOpen, setListOpen] = useState(false);

  const open = useMemo(() => sessions.filter((session) => !session.cancelled), [sessions]);
  const countedTotal = countedSessions(sessions).length;
  const minValue = minCounted.trim() === '' ? null : wholeNumber(minCounted, 1, countedTotal);
  const minInvalid = minCounted.trim() !== '' && minValue === null;
  const asked = useMemo<RaffleCriteria | null>(
    () => (minInvalid ? null : { ...criteria, minCounted: minValue }),
    [criteria, minInvalid, minValue],
  );
  const { preview, loading, error } = useRafflePreview(eventId, asked);

  const winnerCount = wholeNumber(winners, 1, RAFFLE_MAX_WINNERS);
  const alternateCount = wholeNumber(alternates, 0, RAFFLE_MAX_ALTERNATES);
  const eligible = preview?.eligible ?? 0;
  const tooFew = preview !== null && winnerCount !== null && eligible < winnerCount;
  const canDraw =
    asked !== null &&
    preview !== null &&
    !loading &&
    winnerCount !== null &&
    alternateCount !== null &&
    !tooFew;

  const set = <K extends keyof RaffleCriteria>(key: K, value: RaffleCriteria[K]) =>
    setCriteria((last) => ({ ...last, [key]: value }));

  function toggleSession(id: string, on: boolean) {
    setCriteria((last) => ({
      ...last,
      sessionIds: on
        ? open.filter((s) => s.id === id || last.sessionIds.includes(s.id)).map((s) => s.id)
        : last.sessionIds.filter((sessionId) => sessionId !== id),
    }));
  }

  function askDraw() {
    if (!canDraw || !asked || winnerCount === null || alternateCount === null) return;
    const drawnAlternates = Math.min(alternateCount, Math.max(0, eligible - winnerCount));
    const body = {
      title: title.trim(),
      criteria: asked,
      winners: winnerCount,
      alternates: alternateCount,
    };
    confirm({
      title: 'Çekiliş yapılsın mı?',
      description: `${eligible} kişi arasından ${winnerCount} kazanan ve ${drawnAlternates} yedek çekilecek. Çekiliş kaydı silinemez.`,
      actionLabel: 'Çek',
      destructive: false,
      failure: (err) => raffleProblemMessage(err, 'Çekiliş yapılamadı'),
      onConfirm: async () => {
        const raffle = await rafflesApi.draw(eventId, body);
        onDrawn(raffle);
      },
    });
  }

  const excluded = preview ? excludedLine(preview) : '';

  return (
    <section aria-label="Yeni çekiliş" className="space-y-3">
      <h2 className="text-foreground text-sm font-semibold">Yeni çekiliş</h2>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <Card className="space-y-6 p-4">
          <Group title="Şartlar">
            {/* An Event without Sessions counts its Venue entry: "Alana giriş" asks that. */}
            {countedTotal > 0 ? (
              <div className="space-y-1">
                <label htmlFor={`${ids}-min-input`} className="block">
                  <FieldLabel>En az kaç sayılan oturuma katılmış</FieldLabel>
                </label>
                <span className="flex items-center gap-2">
                  <Field
                    id={`${ids}-min-input`}
                    className="w-24"
                    inputMode="numeric"
                    placeholder="Şart yok"
                    value={minCounted}
                    aria-invalid={minInvalid || undefined}
                    aria-describedby={minInvalid ? `${ids}-min` : undefined}
                    onChange={(change) => setMinCounted(change.target.value)}
                  />
                  <span className={`text-muted-foreground ${TEXT_SECONDARY}`}>/{countedTotal}</span>
                </span>
                {minInvalid ? (
                  <span id={`${ids}-min`} className={`text-destructive block ${TEXT_SECONDARY}`}>
                    1 ile {countedTotal} arasında bir sayı yaz
                  </span>
                ) : null}
              </div>
            ) : null}

            {open.length ? (
              <div className="space-y-2 pt-2">
                <FieldLabel>Belirli oturumlara katılmış</FieldLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {open.map((session) => (
                    <CheckRow
                      key={session.id}
                      label={session.title || 'Adsız oturum'}
                      checked={criteria.sessionIds.includes(session.id)}
                      onChange={(on) => toggleSession(session.id, on)}
                    />
                  ))}
                </div>
                {criteria.sessionIds.length > 1 ? (
                  <Select
                    aria-label="Seçilen oturumlar"
                    className="w-full sm:w-64"
                    value={criteria.sessionMatch}
                    onChange={(change) =>
                      set('sessionMatch', change.target.value === 'any' ? 'any' : 'all')
                    }
                  >
                    <option value="all">Seçilenlerin hepsine katılmış</option>
                    <option value="any">Seçilenlerden birine katılmış</option>
                  </Select>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor={`${ids}-entered`} className="block">
                  <FieldLabel>Alana giriş</FieldLabel>
                </label>
                <Select
                  id={`${ids}-entered`}
                  value={criteria.enteredOn}
                  onChange={(change) => set('enteredOn', change.target.value)}
                >
                  <option value="">Şart yok</option>
                  <option value="any">Herhangi bir gün girmiş</option>
                  {dates.map((date) => (
                    <option key={date} value={date}>
                      {raffleDayLabel(date)} girmiş
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <label htmlFor={`${ids}-type`} className="block">
                  <FieldLabel>Bilet türü</FieldLabel>
                </label>
                <Select
                  id={`${ids}-type`}
                  value={criteria.ticketType}
                  onChange={(change) =>
                    set(
                      'ticketType',
                      change.target.value === 'REGISTERED' || change.target.value === 'GUEST'
                        ? change.target.value
                        : '',
                    )
                  }
                >
                  <option value="">Hepsi</option>
                  <option value="REGISTERED">Üye</option>
                  <option value="GUEST">Misafir</option>
                </Select>
              </div>
            </div>
            <div className="pt-2">
              <CheckRow
                label="Sertifika eşiğini geçenler"
                checked={criteria.certificateEligible}
                onChange={(on) => set('certificateEligible', on)}
              />
            </div>
          </Group>

          <Group title="Hariç tut">
            {EXCLUSIONS.map((row) => (
              <CheckRow
                key={row.key}
                label={row.label}
                checked={criteria[row.key]}
                onChange={(on) => set(row.key, on)}
              />
            ))}
            <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
              İptal edilen ve bekleme listesindeki biletler çekilişe girmez.
            </p>
          </Group>
        </Card>

        <Card className="space-y-4 p-4 lg:sticky lg:top-4">
          <div aria-live="polite" className="space-y-1">
            <p className="text-foreground-strong text-2xl font-semibold tabular-nums">
              {preview ? `Uygun: ${preview.eligible} kişi` : loading ? 'Uygun: …' : 'Uygun: –'}
            </p>
            {error ? (
              <p role="alert" className={`text-destructive ${TEXT_SECONDARY}`}>
                {error}
              </p>
            ) : null}
            {excluded ? (
              <p className={`text-muted-foreground ${TEXT_SECONDARY}`}>{excluded}</p>
            ) : null}
            {loading && preview ? (
              <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>Güncelleniyor…</p>
            ) : null}
          </div>

          {preview && preview.candidates.length ? (
            <div className="space-y-2">
              <button
                type="button"
                className={`text-skylab-300 hover:underline ${TEXT_SECONDARY}`}
                aria-expanded={listOpen}
                aria-controls={`${ids}-list`}
                onClick={() => setListOpen((last) => !last)}
              >
                {listOpen ? 'Listeyi gizle' : 'Listeyi göster'}
              </button>
              {listOpen ? (
                <div id={`${ids}-list`} className="space-y-1">
                  <ol
                    aria-label="Uygun kişiler"
                    className="border-border max-h-64 overflow-y-auto rounded-md border px-3 py-2 text-sm"
                  >
                    {preview.candidates.map((candidate, index) => (
                      <li
                        key={`${candidate.name}-${index}`}
                        className="text-secondary-foreground flex justify-between gap-2 py-0.5"
                      >
                        <span className="truncate">{candidate.name}</span>
                        <span className={`text-subtle-foreground shrink-0 ${TEXT_SECONDARY}`}>
                          {candidate.ticketType === 'GUEST' ? 'Misafir' : 'Üye'}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {preview.truncated ? (
                    <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
                      İlk {preview.candidates.length} kişi gösteriliyor.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="border-border space-y-3 border-t pt-4">
            <div className="space-y-1">
              <label htmlFor={`${ids}-title`} className="block">
                <FieldLabel>Başlık</FieldLabel>
              </label>
              <Field
                id={`${ids}-title`}
                placeholder="Çekiliş"
                maxLength={RAFFLE_TITLE_MAX}
                value={title}
                onChange={(change) => setTitle(change.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor={`${ids}-winners`} className="block">
                  <FieldLabel>Kazanan</FieldLabel>
                </label>
                <Field
                  id={`${ids}-winners`}
                  inputMode="numeric"
                  value={winners}
                  aria-invalid={winnerCount === null || tooFew || undefined}
                  onChange={(change) => setWinners(change.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor={`${ids}-alternates`} className="block">
                  <FieldLabel>Yedek</FieldLabel>
                </label>
                <Field
                  id={`${ids}-alternates`}
                  inputMode="numeric"
                  value={alternates}
                  aria-invalid={alternateCount === null || undefined}
                  onChange={(change) => setAlternates(change.target.value)}
                />
              </div>
            </div>
            {winnerCount === null ? (
              <p className={`text-destructive ${TEXT_SECONDARY}`}>
                Kazanan 1 ile {RAFFLE_MAX_WINNERS} arasında olmalı.
              </p>
            ) : alternateCount === null ? (
              <p className={`text-destructive ${TEXT_SECONDARY}`}>
                Yedek 0 ile {RAFFLE_MAX_ALTERNATES} arasında olmalı.
              </p>
            ) : tooFew ? (
              <p className={`text-destructive ${TEXT_SECONDARY}`}>
                Uygun kişi kazanan sayısından az.
              </p>
            ) : null}
            <Button
              className={`${BUTTON_TEXT} w-full`}
              variant="primary"
              disabled={!canDraw}
              onClick={askDraw}
            >
              <Dices aria-hidden />
              Çek
            </Button>
          </div>
        </Card>
      </div>
      {confirmDialog}
    </section>
  );
}
