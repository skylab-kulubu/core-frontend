'use client';

import { useState } from 'react';
import { FieldLabel } from '@/components/chrome/FieldLabel';
import { SaveButton } from '@/components/chrome/SaveButton';
import { Select } from '@/components/chrome/Select';
import type { EventSession } from '@/lib/api/sessions';
import { feedbackSessionLines } from '@/lib/session-feedback';
import { useNotify } from '@/lib/ui/use-notify';

/** How the Event's form asks about the Sessions (decision S1); the form's own structure, not saved. */
type SessionStyle = 'all' | 'self';

const STYLE_HINT: Record<SessionStyle, string> = {
  all: 'Skyforms’ta matris sorusu: satırlar oturumlar, sütunlar 1–5 ve “Katılmadım”.',
  self: 'Skyforms’ta “Hangi oturumlara katıldın?” çoklu seçim sorusu: seçenekler oturumlar. Her oturumun sorusu o seçime bağlı gösterilir.',
};

/**
 * The Sessions for an Event form that asks about each of them
 * (`event_with_sessions`): the organizer picks how the form asks, and copies
 * the list into Skyforms.
 */
export function FeedbackSessionList({ sessions }: { sessions: EventSession[] }) {
  const [style, setStyle] = useState<SessionStyle>('all');
  const [error, setError] = useState<string | null>(null);
  const notify = useNotify();
  const lines = feedbackSessionLines(sessions);
  if (!lines.length) return null;

  async function copyList() {
    setError(null);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      notify.success('Oturum listesi kopyalandı');
    } catch {
      setError('Oturum listesi kopyalanamadı');
    }
  }

  return (
    <section className="space-y-3">
      <label className="block space-y-1">
        <FieldLabel>Formda oturumlar</FieldLabel>
        <Select value={style} onChange={(e) => setStyle(e.target.value as SessionStyle)}>
          <option value="all">Herkes tüm oturumları görür (Katılmadım ile)</option>
          <option value="self">Kişi katıldığı oturumları işaretler</option>
        </Select>
      </label>
      <p className="text-3xs text-subtle-foreground">{STYLE_HINT[style]}</p>
      <ul className="text-muted-foreground space-y-1 text-sm">
        {lines.map((line, index) => (
          <li key={`${index}-${line}`}>{line}</li>
        ))}
      </ul>
      <SaveButton type="button" onClick={() => void copyList()}>
        Listeyi kopyala
      </SaveButton>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </section>
  );
}
