import { ProblemError } from '@/lib/api/core';
import { DEFAULT_FORMS_ADMIN_ORIGIN, slotExtra } from '@/lib/event-forms';
import { sessionsApi, type EventSession } from '@/lib/api/sessions';
import {
  closeSessionFeedbackReminders,
  feedbackSessionLines,
  linkSessionFeedbackForm,
  sessionBody,
  sessionFeedbackFields,
  sessionFeedbackSlot,
  sessionFeedbackSlotKey,
  sessionIdOfFeedbackSlot,
} from '@/lib/session-feedback';

jest.mock('@/lib/api/sessions', () => ({ sessionsApi: { closeFeedback: jest.fn() } }));

const FORM = '55555555-5555-4555-8555-555555555555';
const formUrl = (id: string) => `https://forms.yildizskylab.com/${id}`;

const session: EventSession = {
  id: 's1',
  eventDayId: 'd1',
  title: 'Açılış',
  speakerName: 'Ada',
  speakerLinkedin: 'https://linkedin.example/ada',
  description: 'İlk oturum',
  startTime: '2026-11-01T10:00:00.000Z',
  endTime: '2026-11-01T11:00:00.000Z',
  orderIndex: 0,
  sessionType: 'KEYNOTE',
  cancelled: false,
  feedbackFormUrl: formUrl(FORM),
  feedbackFormAlias: 'gecekodu-gecekoduacilis2026',
  feedbackAutoSend: false,
};

describe('a Session feedback form slot', () => {
  it('names its Session in the slot key and reads it back', () => {
    expect(sessionFeedbackSlotKey('s1')).toBe('feedback-session:s1');
    expect(sessionIdOfFeedbackSlot('feedback-session:s1')).toBe('s1');
    expect(sessionIdOfFeedbackSlot('feedback')).toBeNull();
    expect(sessionIdOfFeedbackSlot('apply')).toBeNull();
    expect(sessionIdOfFeedbackSlot('feedback-session:')).toBeNull();
  });

  it('is the Session saved form, a Skyforms one in Skyforms mode, named after the Session', () => {
    const slot = sessionFeedbackSlot(session, DEFAULT_FORMS_ADMIN_ORIGIN);
    expect(slot).toMatchObject({
      key: 'feedback-session:s1',
      label: 'Geri bildirim',
      mode: 'skyforms',
      url: formUrl(FORM),
      alias: 'gecekodu-gecekoduacilis2026',
      saved: { url: formUrl(FORM), alias: 'gecekodu-gecekoduacilis2026' },
    });
    // The short link and the Skyforms title take the Session's title (SPEC §2.2)
    expect(slotExtra(slot)).toBe('Açılış');
  });

  it('is empty for a Session without a form', () => {
    const slot = sessionFeedbackSlot(
      { ...session, feedbackFormUrl: undefined, feedbackFormAlias: undefined },
      DEFAULT_FORMS_ADMIN_ORIGIN,
    );
    expect(slot).toMatchObject({ mode: 'external', url: '', alias: '' });
    expect(slot.saved).toBeUndefined();
  });
});

describe('a Session update', () => {
  it('sends the whole Session back, its feedback fields left out', () => {
    expect(sessionBody(session)).toEqual({
      eventDayId: 'd1',
      title: 'Açılış',
      speakerName: 'Ada',
      speakerLinkedin: 'https://linkedin.example/ada',
      description: 'İlk oturum',
      startTime: '2026-11-01T10:00:00.000Z',
      endTime: '2026-11-01T11:00:00.000Z',
      orderIndex: 0,
      sessionType: 'KEYNOTE',
    });
  });

  it('clears a removed form and its alias with null', () => {
    const slot = { ...sessionFeedbackSlot(session), url: ' ', alias: '' };
    expect(sessionFeedbackFields(slot, true)).toEqual({
      feedbackFormUrl: null,
      feedbackFormAlias: null,
      feedbackAutoSend: true,
    });
  });

  it('sends the form, its alias and the box', () => {
    expect(sessionFeedbackFields(sessionFeedbackSlot(session), false)).toEqual({
      feedbackFormUrl: formUrl(FORM),
      feedbackFormAlias: 'gecekodu-gecekoduacilis2026',
      feedbackAutoSend: false,
    });
  });
});

describe('back from Skyforms with a Session form', () => {
  const event = { name: 'GeceKodu', ownerTeam: 'GECEKODU', startDate: '2026-11-01T09:00:00.000Z' };

  it('makes its short link and saves it on the Session, the rest of the Session unchanged', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'u1', alias: 'gecekodu-gecekoduacilis2026' });
    const update = jest.fn().mockResolvedValue({});
    const bare = { ...session, feedbackFormUrl: undefined, feedbackFormAlias: undefined };
    await linkSessionFeedbackForm(event, bare, formUrl(FORM), { create, update });
    expect(create).toHaveBeenCalledWith({
      url: formUrl(FORM),
      alias: 'gecekodu-gecekoduacilis2026',
    });
    expect(update).toHaveBeenCalledWith('s1', {
      ...sessionBody(session),
      feedbackFormUrl: formUrl(FORM),
      feedbackFormAlias: 'gecekodu-gecekoduacilis2026',
      feedbackAutoSend: false,
    });
  });

  it('still saves the form when its short link cannot be made', async () => {
    const create = jest.fn().mockRejectedValue(new Error('down'));
    const update = jest.fn().mockResolvedValue({});
    const bare = { ...session, feedbackFormUrl: undefined, feedbackFormAlias: undefined };
    await linkSessionFeedbackForm(event, bare, formUrl(FORM), { create, update });
    expect(update).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ feedbackFormUrl: formUrl(FORM) }),
    );
  });
});

describe('the Sessions for a form that asks about each (event_with_sessions)', () => {
  const sessions: EventSession[] = [
    { ...session, id: 'a', title: 'Açılış', speakerName: 'Ada' },
    { ...session, id: 'b', title: 'Go atölyesi', speakerName: 'Grace', cancelled: true },
    { ...session, id: 'c', title: 'Kapanış', speakerName: ' ' },
  ];

  it('lists each Session not cancelled, one line each, with its speaker', () => {
    expect(feedbackSessionLines(sessions)).toEqual(['Açılış (Ada)', 'Kapanış']);
  });
});

describe('closeSessionFeedbackReminders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('tells core when the form closed, not when it opened', async () => {
    (sessionsApi.closeFeedback as jest.Mock).mockResolvedValue({ cancelled: 2 });
    await closeSessionFeedbackReminders('s1', 'open');
    expect(sessionsApi.closeFeedback).not.toHaveBeenCalled();
    await closeSessionFeedbackReminders('s1', 'closed');
    expect(sessionsApi.closeFeedback).toHaveBeenCalledWith('s1');
  });

  it('takes a 404 as nothing to cancel, and passes other failures on', async () => {
    (sessionsApi.closeFeedback as jest.Mock).mockRejectedValueOnce(
      new ProblemError(404, 'Not Found'),
    );
    await expect(closeSessionFeedbackReminders('s1', 'closed')).resolves.toBeUndefined();
    (sessionsApi.closeFeedback as jest.Mock).mockRejectedValueOnce(new ProblemError(500, 'Error'));
    await expect(closeSessionFeedbackReminders('s1', 'closed')).rejects.toBeInstanceOf(
      ProblemError,
    );
  });
});
