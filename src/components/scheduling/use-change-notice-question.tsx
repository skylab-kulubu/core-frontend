'use client';

import { useRef, type ReactNode } from 'react';
import { CheckboxRow } from '@/components/scheduling/use-event-status-actions';
import {
  changeNoticeTitle,
  noticeTickedByDefault,
  type ChangeNotice,
} from '@/lib/scheduling/change-notice';
import { useConfirm } from '@/lib/ui/use-confirm';

/**
 * Asks before a save that gives a published Event a new time, place or other details (name,
 * description, attendee note, capacity, links) whether its Ticket holders are told: ticked for a
 * new time or place, as in the cancel dialog; unticked for other details alone (core
 * docs/event-updated-notification.md#other-details). The answer is true or false; `null` when
 * the reader leaves the question (Vazgeç), and nothing is saved. Render `dialog` once.
 */
export function useChangeNoticeQuestion(): [
  (notice: ChangeNotice) => Promise<boolean | null>,
  ReactNode,
] {
  const [confirm, dialog] = useConfirm();
  const pending = useRef<((answer: boolean | null) => void) | null>(null);

  function ask(notice: ChangeNotice): Promise<boolean | null> {
    pending.current?.(null);
    return new Promise((resolve) => {
      pending.current = resolve;
      const answer = { notify: noticeTickedByDefault(notice.changes) };
      const settle = (value: boolean | null) => {
        if (pending.current === resolve) pending.current = null;
        resolve(value);
      };
      confirm({
        title: changeNoticeTitle(notice.changes),
        content: (
          <CheckboxRow
            label={
              notice.holders === null
                ? 'Bilet sahiplerine bildir'
                : `Bilet sahiplerine bildir (${notice.holders} kişi)`
            }
            defaultChecked={answer.notify}
            onChange={(next) => {
              answer.notify = next;
            }}
          />
        ),
        actionLabel: 'Kaydet',
        destructive: false,
        onConfirm: () => settle(answer.notify),
        onCancel: () => settle(null),
      });
    });
  }

  return [ask, dialog];
}
