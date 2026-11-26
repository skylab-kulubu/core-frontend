'use client';

import { Button, cn } from '@skylab-kulubu/skylcn-ui';
import { useEffect, useMemo, useState } from 'react';
import { SaveButton } from '@/components/chrome/SaveButton';
import { SidePanel } from '@/components/chrome/SidePanel';
import {
  certificatesApi,
  type BackgroundPlacement,
  type BackgroundTextConversion,
  type BackgroundTextList,
  type BackgroundTextReason,
  type BackgroundTextSpan,
  type CertificateElement,
} from '@/lib/api/certificates';
import { ELEMENT_LABELS } from '@/lib/certificate-layout';
import { suggestTextField, type TextFieldKind } from '@/lib/certificate-text-fields';
import { coreProblemMessage } from '@/lib/core-problems';
import { BUTTON_TEXT, TEXT_SECONDARY } from '@/lib/ui/type-scale';

/** Core keeps at most this many layers in a layout. */
export const MAX_LAYERS = 100;

const CHECKBOX = 'accent-skylab-400 size-4 shrink-0 disabled:opacity-40';

const REASONS: Record<BackgroundTextReason, string> = {
  unreadable: 'okunamayan karakter',
  stroke: 'kontur yazı',
  invisible: 'görünmez yazı (OCR)',
  clip: 'kırpma yazısı',
  vertical: 'dikey yazı',
  skewed: 'eğik ya da aynalı yazı',
  shared: 'PDF içinde tekrar kullanılan yazı',
  unmatched: "PDF'ten ayrılamıyor",
  limit: `katman sınırı (${MAX_LAYERS})`,
  truncated: 'PDF çok fazla metin içeriyor',
};

const MISSING: Record<NonNullable<BackgroundTextList['textMissing']>, string> = {
  outlines: "Bu PDF'teki yazılar eğriye çevrilmiş; düzenlenemez.",
  image: 'Bu PDF bir görsel; içinde metin yok.',
  unknown: "Bu PDF'te düzenlenebilir metin bulunamadı.",
};

const pt = (size: number) => Math.round(size * 10) / 10;

/** "Montserrat-Bold 32 → Noto Sans 700 32": the PDF's font and the one the layer gets. */
export function spanFontLine(span: BackgroundTextSpan) {
  const style = span.fontStyle === 'italic' ? ' italik' : '';
  return `${span.sourceFont} ${pt(span.fontSizePt)} → ${span.font} ${span.fontWeight}${style} ${pt(span.fontSizePt)}`;
}

/** What the editor applies: the answer, and the layer kinds the new fields take over. */
export type AppliedConversion = {
  result: BackgroundTextConversion;
  replacedKinds: TextFieldKind[];
};

/**
 * The layers the draft keeps beside a conversion: those of a kind a chosen
 * placeholder becomes are replaced by it ("Ad Soyad" → Katılımcı adı takes the
 * place of the template's own).
 */
export function keptLayers(
  elements: readonly CertificateElement[],
  kinds: readonly TextFieldKind[],
) {
  return elements.filter((element) => !kinds.includes(element.kind as TextFieldKind));
}

export function BackgroundTextSheet({
  open,
  mediaId,
  templateId,
  page,
  placement,
  elements,
  onClose,
  onConverted,
}: {
  open: boolean;
  /** The PDF background's Media. */
  mediaId: string;
  /** The saved template the draft is of: core matches its team's fonts too. */
  templateId?: string;
  page: { width: number; height: number };
  /** The draft's own placement; left out for a layout without one. */
  placement?: BackgroundPlacement;
  elements: readonly CertificateElement[];
  onClose: () => void;
  onConverted: (applied: AppliedConversion) => void;
}) {
  const [list, setList] = useState<BackgroundTextList>();
  const [loadError, setLoadError] = useState<string>();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [fields, setFields] = useState<Record<string, TextFieldKind>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setList(undefined);
    setLoadError(undefined);
    setError(undefined);
    setFields({});
    certificatesApi
      .assetText(mediaId, templateId)
      .then((answer) => {
        if (cancelled) return;
        setList(answer);
        setChosen(new Set(answer.spans.filter((span) => span.convertible).map((span) => span.id)));
      })
      .catch((cause) => {
        if (!cancelled) setLoadError(coreProblemMessage(cause, 'Metinler okunamadı'));
      });
    return () => {
      cancelled = true;
    };
  }, [open, mediaId, templateId]);

  const spans = useMemo(() => list?.spans ?? [], [list]);
  const convertible = spans.filter((span) => span.convertible);
  const picked = convertible.filter((span) => chosen.has(span.id));
  const kinds = Object.fromEntries(
    picked.filter((span) => fields[span.id]).map((span) => [span.id, fields[span.id]]),
  );
  const replacedKinds = [...new Set(Object.values(kinds))];
  const existing = keptLayers(elements, replacedKinds).length;
  const room = Math.max(0, MAX_LAYERS - existing);

  function toggle(id: string, on: boolean) {
    setChosen((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function convert() {
    if (!picked.length || picked.length > room) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await certificatesApi.convertAssetText(mediaId, {
        spanIds: picked.map((span) => span.id),
        kinds,
        page,
        ...(placement ? { placement } : {}),
        existingElements: existing,
        ...(templateId ? { templateId } : {}),
      });
      onConverted({ result, replacedKinds });
    } catch (cause) {
      setError(coreProblemMessage(cause, 'Metinler dönüştürülemedi'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SidePanel open={open} title="Metinleri düzenlenebilir yap" onClose={onClose}>
      {error || loadError ? (
        <p role="alert" className={cn('text-destructive', TEXT_SECONDARY)}>
          {error ?? loadError}
        </p>
      ) : null}
      {!list && !loadError ? (
        <p role="status" className={cn('text-subtle-foreground', TEXT_SECONDARY)}>
          Metinler okunuyor…
        </p>
      ) : null}
      {list && !spans.length ? (
        <p className={cn('text-subtle-foreground', TEXT_SECONDARY)}>
          {MISSING[list.textMissing ?? 'unknown']}
        </p>
      ) : null}
      {spans.length ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={BUTTON_TEXT}
              disabled={!convertible.length}
              onClick={() => setChosen(new Set(convertible.map((span) => span.id)))}
            >
              Hepsini seç
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={BUTTON_TEXT}
              disabled={!picked.length}
              onClick={() => setChosen(new Set())}
            >
              Hiçbirini
            </Button>
            <span
              className={cn(
                'ml-auto',
                picked.length > room ? 'text-destructive' : 'text-subtle-foreground',
                TEXT_SECONDARY,
              )}
            >
              {picked.length} seçili · en çok {room}
            </span>
          </div>
          <ul aria-label="PDF metinleri" className="divide-border divide-y">
            {spans.map((span) => {
              const suggestion = span.convertible ? suggestTextField(span.text) : undefined;
              const on = chosen.has(span.id);
              return (
                <li
                  key={span.id}
                  className={cn('space-y-1 py-2', span.convertible ? undefined : 'opacity-60')}
                >
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className={cn(CHECKBOX, 'mt-0.5')}
                      checked={span.convertible && on}
                      disabled={!span.convertible}
                      onChange={(event) => toggle(span.id, event.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground block text-sm break-words whitespace-pre-wrap">
                        {span.text}
                      </span>
                      <span className={cn('text-subtle-foreground block', TEXT_SECONDARY)}>
                        {span.convertible
                          ? spanFontLine(span)
                          : `Dönüşmez: ${REASONS[span.reason ?? 'unreadable']}`}
                      </span>
                    </span>
                  </label>
                  {suggestion ? (
                    <label
                      className={cn(
                        'text-secondary-foreground ml-6 flex items-center gap-2',
                        TEXT_SECONDARY,
                      )}
                    >
                      <input
                        type="checkbox"
                        className={CHECKBOX}
                        checked={fields[span.id] === suggestion}
                        disabled={!on}
                        onChange={(event) =>
                          setFields((current) => {
                            // One piece per kind: choosing it here unchooses it elsewhere
                            const next = Object.fromEntries(
                              Object.entries(current).filter(([, kind]) => kind !== suggestion),
                            );
                            if (event.target.checked) next[span.id] = suggestion;
                            else delete next[span.id];
                            return next;
                          })
                        }
                      />
                      {ELEMENT_LABELS[suggestion]} yap
                    </label>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {replacedKinds.length ? (
            <p className={cn('text-subtle-foreground', TEXT_SECONDARY)}>
              Şablondaki {replacedKinds.map((kind) => ELEMENT_LABELS[kind]).join(', ')} katmanının
              yerini alır.
            </p>
          ) : null}
        </>
      ) : null}
      <div className="flex items-center gap-2 pt-1">
        <SaveButton
          type="button"
          disabled={busy || !picked.length || picked.length > room}
          onClick={() => void convert()}
        >
          {busy ? 'Dönüştürülüyor…' : 'Dönüştür'}
        </SaveButton>
        <Button type="button" variant="ghost" className={BUTTON_TEXT} onClick={onClose}>
          Vazgeç
        </Button>
      </div>
    </SidePanel>
  );
}
