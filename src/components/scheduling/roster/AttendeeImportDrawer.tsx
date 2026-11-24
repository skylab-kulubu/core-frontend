'use client';

import { Badge, Button, Notice, Radio, RadioGroup } from '@skylab-kulubu/skylcn-ui';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Drawer } from '@/components/chrome/Drawer';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Switch } from '@/components/chrome/Switch';
import { TextArea } from '@/components/chrome/TextArea';
import { ticketsApi, type ImportReport } from '@/lib/api/tickets';
import {
  IMPORT_OUTCOME_TONE,
  importCapacityLine,
  importFileIssue,
  importMailLine,
  importOutcomeLabel,
  importPeopleLine,
  importRowNote,
  importSummaryItems,
  importWrites,
} from '@/lib/attendee-import';
import { coreProblemMessage } from '@/lib/core-problems';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';

type Source = 'paste' | 'file';
type Step = 'input' | 'preview' | 'done';

const PASTE_HINT = 'Ad;Soyad;E-posta;Oturum\nAyşe;Yılmaz;ayse@example.com;';

/**
 * Katılımcılar → İçe aktar (core docs/attendee-import.md): the people who
 * registered on another form (Microsoft Forms and the like) become Tickets.
 * A CSV file or pasted rows, a preview of each row, then the import. The
 * list goes to core and is kept nowhere: not in the page's storage either.
 */
export function AttendeeImportDrawer({
  open,
  onClose,
  eventId,
  capacity = 0,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  /** The Event's capacity, 0 for none: "Kontenjanı aşabilir" is offered only with one. */
  capacity?: number;
  onImported: (report: ImportReport) => void | Promise<void>;
}) {
  const [step, setStep] = useState<Step>('input');
  const [source, setSource] = useState<Source>('paste');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [sendMail, setSendMail] = useState(true);
  const [pastCapacity, setPastCapacity] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function reset() {
    setStep('input');
    setSource('paste');
    setText('');
    setFileName('');
    setSendMail(true);
    setPastCapacity(false);
    setReport(null);
    setError(null);
    setPending(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function pick(file: File | undefined) {
    setError(null);
    setText('');
    setFileName('');
    if (!file) return;
    const issue = importFileIssue(file);
    if (issue) {
      setError(issue);
      return;
    }
    try {
      setText(await file.text());
      setFileName(file.name);
    } catch {
      setError('Dosya okunamadı.');
    }
  }

  async function preview() {
    setError(null);
    setPending(true);
    try {
      setReport(await ticketsApi.previewImport(eventId, { text, sendMail, pastCapacity }));
      setStep('preview');
    } catch (err) {
      setError(coreProblemMessage(err, 'Liste okunamadı'));
    } finally {
      setPending(false);
    }
  }

  async function runImport() {
    setError(null);
    setPending(true);
    try {
      const done = await ticketsApi.importAttendees(eventId, { text, sendMail, pastCapacity });
      setReport(done);
      setStep('done');
      await onImported(done);
    } catch (err) {
      setError(coreProblemMessage(err, 'İçe aktarılamadı'));
    } finally {
      setPending(false);
    }
  }

  const writes = report ? importWrites(report) : 0;

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Katılımcıları içe aktar"
      dirty={step !== 'done' && Boolean(text.trim())}
    >
      <div className="space-y-5">
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        {step === 'input' ? (
          <>
            <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
              Başka bir formla (Microsoft Forms, Google Forms) kaydolanları bilete çevir. Sütunlar:
              ad, soyad, e-posta; isteğe bağlı oturum. En çok 1000 satır.
            </p>
            <RadioGroup
              aria-label="Listenin kaynağı"
              value={source}
              onValueChange={(value: unknown) => {
                setSource(value === 'file' ? 'file' : 'paste');
                setText('');
                setFileName('');
                setError(null);
              }}
            >
              <Radio value="paste" label="Yapıştır" />
              <Radio value="file" label="CSV dosyası" />
            </RadioGroup>
            {source === 'paste' ? (
              <label className="block space-y-1">
                <FieldLabel>Liste</FieldLabel>
                <TextArea
                  aria-label="Liste"
                  rows={8}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={PASTE_HINT}
                  spellCheck={false}
                  className="font-mono text-[13px]"
                />
                <span className={`text-subtle-foreground block ${TEXT_SECONDARY}`}>
                  Excel ya da Forms yanıt tablosundan satırları kopyala; başlık satırı olabilir.
                </span>
              </label>
            ) : (
              <label className="block space-y-1">
                <FieldLabel>CSV dosyası</FieldLabel>
                <input
                  aria-label="CSV dosyası"
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/plain"
                  onChange={(e) => void pick(e.target.files?.[0])}
                  className="file:bg-skylab-700 file:text-foreground block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm"
                />
                <span className={`text-subtle-foreground block ${TEXT_SECONDARY}`}>
                  {fileName
                    ? `${fileName} okundu.`
                    : 'UTF-8 CSV, en çok 2 MB. Excel: Farklı kaydet → CSV UTF-8.'}
                </span>
              </label>
            )}
            <div className="space-y-3">
              <Switch
                checked={sendMail}
                onChange={setSendMail}
                label="Bilet postası gönder"
                hint="Yeni biletlere QR'lı bilet postası gider."
              />
              {capacity > 0 ? (
                <Switch
                  checked={pastCapacity}
                  onChange={setPastCapacity}
                  label="Kontenjanı aşabilir"
                  hint={
                    pastCapacity
                      ? 'Herkes bilet alır, kontenjan aşılabilir.'
                      : 'Yer kalmazsa bekleme listesine düşer.'
                  }
                />
              ) : null}
            </div>
            <SaveButton
              type="button"
              disabled={pending || !text.trim()}
              onClick={() => void preview()}
            >
              {pending ? 'Okunuyor…' : 'Önizle'}
            </SaveButton>
          </>
        ) : null}
        {step !== 'input' && report ? <ImportReportView report={report} /> : null}
        {step === 'preview' && report ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className={BUTTON_TEXT}
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setError(null);
                setStep('input');
              }}
            >
              <ArrowLeft className="size-4" />
              Geri
            </Button>
            <SaveButton
              type="button"
              disabled={pending || writes === 0}
              onClick={() => void runImport()}
            >
              {pending
                ? 'İçe aktarılıyor…'
                : writes
                  ? `İçe aktar (${writes})`
                  : 'Yazılacak kişi yok'}
            </SaveButton>
          </div>
        ) : null}
        {step === 'done' ? (
          <SaveButton type="button" onClick={close}>
            Kapat
          </SaveButton>
        ) : null}
      </div>
    </Drawer>
  );
}

function ImportReportView({ report }: { report: ImportReport }) {
  const items = importSummaryItems(report);
  const people = importPeopleLine(report);
  const capacityLine = importCapacityLine(report);
  return (
    <div className="space-y-4">
      {report.imported ? (
        <Notice
          tone="success"
          title={`${report.summary.active + report.summary.waitlisted} bilet yazıldı`}
        >
          {importMailLine(report)}
        </Notice>
      ) : (
        <div className="space-y-1">
          <h3 className="text-foreground text-sm font-medium">Önizleme</h3>
          <p className={`text-subtle-foreground ${TEXT_SECONDARY}`}>
            {report.summary.rows} satır okundu. Henüz hiçbir şey yazılmadı.
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2" aria-label="Özet">
        {items.map((item) => (
          <Badge key={item.key} tone={item.tone}>
            {item.label} {item.count}
          </Badge>
        ))}
      </div>
      <ul className={`text-subtle-foreground list-disc space-y-0.5 pl-5 ${TEXT_SECONDARY}`}>
        {people ? <li>{people}</li> : null}
        {capacityLine ? <li>{capacityLine}</li> : null}
        {report.imported ? null : <li>{importMailLine(report)}</li>}
        {report.summary.unknownSessions ? (
          <li>Oturum sütunu yalnız gösterilir; bilet etkinliğin tamamı içindir.</li>
        ) : null}
      </ul>
      <ul className="divide-border-subtle border-border-subtle max-h-[50vh] divide-y overflow-y-auto rounded-lg border">
        {report.rows.map((row) => {
          const note = importRowNote(row);
          const name = `${row.firstName} ${row.lastName}`.trim() || '—';
          return (
            <li key={row.line} className="flex items-start gap-3 px-3 py-2">
              <span className="text-subtle-foreground w-8 shrink-0 pt-0.5 text-xs tabular-nums">
                {row.line}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm">
                  {name}
                  {row.account ? <span className="text-subtle-foreground"> · üye</span> : null}
                </p>
                <p className="text-subtle-foreground truncate text-xs">{row.email || '—'}</p>
                {note ? <p className="text-subtle-foreground text-xs">{note}</p> : null}
              </div>
              <Badge tone={IMPORT_OUTCOME_TONE[row.outcome]} className="shrink-0">
                {importOutcomeLabel(row, report.imported)}
              </Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
