'use client';

import { useEffect, useState } from 'react';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { QrPreview } from '@/components/chrome/QrPreview';
import { SaveButton } from '@/components/chrome/SaveButton';
import {
  eventsApi,
  type CoreEvent,
  type FeedbackCount,
  type FeedbackSendResult,
} from '@/lib/api/events';
import { publicShortUrl, shortQrFileName, shortQrPath, shortQrUrl } from '@/lib/api/urls';
import { useConfirm } from '@/lib/ui/use-confirm';
import { useNotify } from '@/lib/ui/use-notify';

/**
 * The Event's feedback form on its overview: the link and its QR (shown at
 * the end of a talk), how many it was mailed to and answered, and "Şimdi
 * gönder" for whoever may edit the Event. Nothing without a form.
 */
export function EventFeedbackPanel({ event, canSend }: { event: CoreEvent; canSend: boolean }) {
  const [count, setCount] = useState<FeedbackCount | null>(null);
  const url = event.feedbackFormUrl?.trim() ?? '';

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    // The counts are the editors' and DK's; anyone else is refused and sees none
    eventsApi
      .feedbackCounts(event.id)
      .then((counts) => {
        if (!cancelled) setCount(counts.event);
      })
      .catch(() => {
        if (!cancelled) setCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [event.id, url]);

  return (
    <FeedbackFormPanel
      url={url}
      alias={event.feedbackFormAlias}
      count={count}
      canSend={canSend}
      description="Yoklaması alınanlara kişiye özel bağlantıyla posta gider. Form bir kez gönderilir; etkinlik bitince yeniden gitmez."
      send={() => eventsApi.sendFeedback(event.id)}
    />
  );
}

/**
 * A feedback form (the Event's or a Session's): its link and QR, its counts
 * and "Şimdi gönder" with its question. Nothing without a form.
 */
export function FeedbackFormPanel({
  url: rawUrl,
  alias: rawAlias,
  count,
  canSend,
  description,
  send,
}: {
  url?: string;
  alias?: string;
  count: FeedbackCount | null;
  canSend: boolean;
  /** The question's line under "şimdi gönderilsin mi?". */
  description: string;
  send: () => Promise<FeedbackSendResult>;
}) {
  const [confirm, confirmDialog] = useConfirm();
  const notify = useNotify();
  const url = rawUrl?.trim() ?? '';
  const alias = rawAlias?.trim() ?? '';

  if (!url) return null;
  const link = alias ? publicShortUrl(alias) : url;

  return (
    <section className="space-y-3">
      <FieldLabel>Geri bildirim formu</FieldLabel>
      <p className="text-3xs text-subtle-foreground">
        <a
          className="text-skylab-300 hover:text-foreground"
          href={link}
          target="_blank"
          rel="noreferrer"
        >
          {link}
        </a>
      </p>
      {count ? (
        <p className="text-muted-foreground text-sm">
          Gönderilen {count.sent} · Cevaplayan {count.answered}
        </p>
      ) : null}
      {alias ? (
        <QrPreview
          imageUrl={shortQrUrl(alias)}
          downloadPath={shortQrPath(alias, { size: 1024 })}
          fileName={shortQrFileName(alias)}
          label={`QR ${alias}`}
        />
      ) : null}
      {canSend ? (
        <SaveButton
          type="button"
          onClick={() =>
            confirm({
              title: 'Geri bildirim formu şimdi gönderilsin mi?',
              description,
              actionLabel: 'Şimdi gönder',
              destructive: false,
              failure: 'Form gönderilemedi',
              onConfirm: async () => {
                const result = await send();
                notify.success(
                  result.sent
                    ? `${result.recipients ?? 0} kişiye gönderiliyor`
                    : 'Bu form daha önce gönderildi',
                );
              },
            })
          }
        >
          Şimdi gönder
        </SaveButton>
      ) : null}
      {confirmDialog}
    </section>
  );
}
