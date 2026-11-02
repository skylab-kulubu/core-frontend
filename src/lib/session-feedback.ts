import { ProblemError } from '@/lib/api/core';
import type { ShortUrl, ShortUrlBody } from '@/lib/api/urls';
import { sessionsApi, type EventSession, type SessionBody } from '@/lib/api/sessions';
import { toDatetimeLocal } from '@/lib/datetime-local';
import {
  FEEDBACK_SLOT_LABEL,
  SESSION_FEEDBACK_SLOT_PREFIX,
  attachFormAliases,
  looksLikeSkyforms,
  type EventFormSlot,
} from '@/lib/event-forms';

/** The slot key of a Session's feedback form; Skyforms brings it back in `formSlot`. */
export function sessionFeedbackSlotKey(sessionId: string): string {
  return `${SESSION_FEEDBACK_SLOT_PREFIX}${sessionId}`;
}

/** The Session a returning `formSlot` names, or none for any other slot. */
export function sessionIdOfFeedbackSlot(slotKey: string): string | null {
  if (!slotKey.startsWith(SESSION_FEEDBACK_SLOT_PREFIX)) return null;
  return slotKey.slice(SESSION_FEEDBACK_SLOT_PREFIX.length) || null;
}

/**
 * The Session's feedback form as a form slot: its short link and Skyforms
 * title are named after the Session (SPEC §2.2).
 */
export function sessionFeedbackSlot(session: EventSession, origin?: string): EventFormSlot {
  const url = session.feedbackFormUrl ?? '';
  const alias = session.feedbackFormAlias ?? '';
  return {
    key: sessionFeedbackSlotKey(session.id),
    label: FEEDBACK_SLOT_LABEL,
    extra: session.title,
    mode: looksLikeSkyforms(url, origin) ? 'skyforms' : 'external',
    url,
    alias,
    saved: url.trim() && alias.trim() ? { url: url.trim(), alias: alias.trim() } : undefined,
  };
}

/**
 * The Session as `PUT /v1/sessions/{id}` takes it back: a whole-body update
 * of its own fields. The feedback fields are left out, so core keeps them.
 */
export function sessionBody(session: EventSession): SessionBody {
  return {
    eventDayId: session.eventDayId,
    title: session.title,
    speakerName: session.speakerName,
    speakerLinkedin: session.speakerLinkedin,
    description: session.description,
    startTime: session.startTime,
    endTime: session.endTime,
    orderIndex: session.orderIndex,
    sessionType: session.sessionType,
  };
}

/** The feedback fields a Session update sends: an emptied form or alias is `null` (cleared). */
export function sessionFeedbackFields(
  slot: EventFormSlot,
  autoSend: boolean,
): Pick<SessionBody, 'feedbackFormUrl' | 'feedbackFormAlias' | 'feedbackAutoSend'> {
  return {
    feedbackFormUrl: slot.url.trim() || null,
    feedbackFormAlias: slot.alias.trim() || null,
    feedbackAutoSend: autoSend,
  };
}

/**
 * Back from Skyforms with a Session's new form: its short link is made as the
 * Event's forms' are (core binds it to the Event), and the form is saved on
 * the Session. A link that cannot be made leaves the form saved without one.
 */
export async function linkSessionFeedbackForm(
  event: { name: string; ownerTeam: string; startDate?: string },
  session: EventSession,
  formUrl: string,
  api: {
    create: (body: ShortUrlBody) => Promise<ShortUrl>;
    update: (id: string, body: SessionBody) => Promise<unknown>;
  },
): Promise<void> {
  const current = sessionFeedbackSlot(session);
  const changed = current.url.trim() !== formUrl.trim();
  const slot: EventFormSlot = {
    ...current,
    url: formUrl,
    mode: 'skyforms',
    // A new form gets a link of its own; the old alias still names the old form
    alias: changed ? '' : current.alias,
    saved: changed ? undefined : current.saved,
  };
  const [linked] = await attachFormAliases(
    [slot],
    event.name,
    toDatetimeLocal(event.startDate),
    api.create,
    event.ownerTeam,
  );
  await api.update(session.id, {
    ...sessionBody(session),
    ...sessionFeedbackFields(linked ?? slot, session.feedbackAutoSend ?? true),
  });
}

/**
 * The Sessions a form asking about each of them lists (`event_with_sessions`):
 * one line a Session not cancelled, its title and its speaker.
 */
export function feedbackSessionLines(sessions: readonly EventSession[]): string[] {
  return sessions
    .filter((session) => !session.cancelled)
    .map((session) => {
      const title = session.title.trim();
      const speaker = session.speakerName?.trim();
      return speaker ? `${title} (${speaker})` : title;
    });
}

/**
 * The Session's feedback form was closed in Skyforms: core cancels its
 * reminders still to go for good. A core without the call answers 404.
 */
export async function closeSessionFeedbackReminders(sessionId: string, gate: string) {
  if (gate !== 'closed') return;
  try {
    await sessionsApi.closeFeedback(sessionId);
  } catch (err) {
    if (err instanceof ProblemError && err.status === 404) return;
    throw err;
  }
}
