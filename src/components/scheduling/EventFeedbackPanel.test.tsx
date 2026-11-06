import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { EventFeedbackPanel } from '@/components/scheduling/EventFeedbackPanel';
import { closeFeedbackReminders } from '@/components/scheduling/EventEditor';
import { ProblemError } from '@/lib/api/core';
import { eventsApi, type CoreEvent } from '@/lib/api/events';

jest.mock('@/lib/api/events', () => ({
  ...jest.requireActual('@/lib/api/events'),
  eventsApi: { feedbackCounts: jest.fn(), sendFeedback: jest.fn(), closeFeedback: jest.fn() },
}));

const event: CoreEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'SkyDays',
  description: '',
  location: 'YTÜ',
  ownerTeam: 'GECEKODU',
  capacity: 0,
  active: true,
  ranked: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  feedbackMode: 'event',
  feedbackAutoSend: true,
  feedbackFormUrl: 'https://forms.yildizskylab.com/55555555-5555-4555-8555-555555555555',
  feedbackFormAlias: 'gecekodu-skydaysgeribildirim2026',
};

describe('EventFeedbackPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (eventsApi.feedbackCounts as jest.Mock).mockResolvedValue({
      event: { sent: 12, answered: 5 },
      sessions: [],
    });
  });

  it('shows nothing without a feedback form', () => {
    const { container } = render(
      <EventFeedbackPanel event={{ ...event, feedbackFormUrl: '' }} canSend />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(eventsApi.feedbackCounts).not.toHaveBeenCalled();
  });

  it('shows the short link, its QR and the counts', async () => {
    render(<EventFeedbackPanel event={event} canSend={false} />);
    expect(
      screen.getByRole('link', { name: /gecekodu-skydaysgeribildirim2026$/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('QR gecekodu-skydaysgeribildirim2026')).toBeInTheDocument();
    expect(await screen.findByText('Gönderilen 12 · Cevaplayan 5')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Şimdi gönder' })).not.toBeInTheDocument();
  });

  it('sends the form once asked, and says when it went already', async () => {
    const user = userEvent.setup();
    (eventsApi.sendFeedback as jest.Mock)
      .mockResolvedValueOnce({ sent: true, recipients: 7 })
      .mockResolvedValueOnce({ sent: false });
    render(<EventFeedbackPanel event={event} canSend />);

    await user.click(screen.getByRole('button', { name: 'Şimdi gönder' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Geri bildirim formu şimdi gönderilsin mi?',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Şimdi gönder' }));
    expect(eventsApi.sendFeedback).toHaveBeenCalledWith(event.id);
    expect(await screen.findByText('7 kişiye gönderiliyor')).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Şimdi gönder' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Şimdi gönder' }),
    );
    expect(await screen.findByText('Bu form daha önce gönderildi')).toBeInTheDocument();
  });

  it('says a refusal in the dialog', async () => {
    const user = userEvent.setup();
    (eventsApi.sendFeedback as jest.Mock).mockRejectedValue(
      new ProblemError(409, 'Conflict', { code: 'feedback_not_sendable' }),
    );
    render(<EventFeedbackPanel event={event} canSend />);

    await user.click(screen.getByRole('button', { name: 'Şimdi gönder' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Şimdi gönder' }));
    expect(
      await within(dialog).findByText(
        'Taslak, iptal edilmiş ya da arşivlenmiş etkinliğin formu gönderilmez.',
      ),
    ).toBeInTheDocument();
  });
});

describe('closeFeedbackReminders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('tells core when the form closed, not when it opened', async () => {
    (eventsApi.closeFeedback as jest.Mock).mockResolvedValue({ cancelled: 3 });
    await closeFeedbackReminders(event.id, 'open');
    await closeFeedbackReminders(undefined, 'closed');
    expect(eventsApi.closeFeedback).not.toHaveBeenCalled();
    await closeFeedbackReminders(event.id, 'closed');
    expect(eventsApi.closeFeedback).toHaveBeenCalledWith(event.id);
  });

  it('takes a 404 (an Event not created yet) as nothing to cancel, and passes other failures on', async () => {
    (eventsApi.closeFeedback as jest.Mock).mockRejectedValueOnce(
      new ProblemError(404, 'Not Found'),
    );
    await expect(closeFeedbackReminders(event.id, 'closed')).resolves.toBeUndefined();
    (eventsApi.closeFeedback as jest.Mock).mockRejectedValueOnce(new ProblemError(500, 'Error'));
    await expect(closeFeedbackReminders(event.id, 'closed')).rejects.toBeInstanceOf(ProblemError);
  });
});
