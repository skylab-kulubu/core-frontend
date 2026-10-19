import { useRef, type ReactNode } from 'react';
import { identityApi } from '@/lib/api/identity';
import { useConfirm } from '@/lib/ui/use-confirm';

export const UNVERIFIED_ADD_TEXT =
  'Bu hesap YTÜ ile doğrulanmamış. Aynı adlı başka biri olmadığından emin olun.';

export type MemberAdd = {
  groupId: string;
  userId: string;
  /** The person's name, for the question. */
  personName: string;
  /** The Group's name, for the question. */
  groupName: string;
  /** Runs after core took the add: says so, closes the picker, reloads. */
  onAdded: () => void | Promise<void>;
  /** What the question says when the confirmed add is refused. */
  failure: string;
};

/**
 * Whether core warns that the person is not verified with YTÜ for this
 * Group (grup-yonetimi 07). core never refuses the add, so a check that
 * cannot be read only means no warning.
 */
export async function warnsUnverified(groupId: string, userId: string): Promise<boolean> {
  try {
    const check = await identityApi.memberCheck(groupId, userId);
    return check.warnings.includes('not_ytu_verified');
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.warn(err);
    return false;
  }
}

/**
 * Adds a person to a Group from a picker. When core warns that the person is
 * not verified with YTÜ (a Privileged target), it asks first and sends the
 * reader's confirmation as unverifiedAck; otherwise it adds at once. The
 * Group's Privileged state comes only from core's answer, never its name.
 *
 * `add` throws when an add without a question is refused, so the picker can
 * say why; a refusal after the question is said inside it. A pick while one
 * is still being checked or added is ignored. Call `cancel` when the picker
 * closes: a check that answers later then asks nothing and adds nobody.
 * Render `dialog` inside the picker's drawer so the question opens over it.
 */
export function useMemberAdd(): {
  add: (request: MemberAdd) => Promise<void>;
  cancel: () => void;
  dialog: ReactNode;
} {
  const [confirm, dialog] = useConfirm();
  // Which picker opening a pick belongs to, and whether one is still running in it
  const run = useRef(0);
  const busy = useRef(false);

  async function add(request: MemberAdd) {
    if (busy.current) return;
    busy.current = true;
    const id = run.current;
    const { groupId, userId, onAdded } = request;
    try {
      const warns = await warnsUnverified(groupId, userId);
      if (id !== run.current) return;
      if (warns) {
        confirm({
          title: `${request.personName} ${request.groupName} grubuna eklensin mi?`,
          description: UNVERIFIED_ADD_TEXT,
          actionLabel: 'Yine de ekle',
          destructive: false,
          onConfirm: async () => {
            await identityApi.addMember(groupId, userId, { unverifiedAck: true });
            await onAdded();
          },
          failure: request.failure,
          closesDrawer: true,
        });
        return;
      }
      await identityApi.addMember(groupId, userId);
      await onAdded();
    } finally {
      if (id === run.current) busy.current = false;
    }
  }

  function cancel() {
    run.current += 1;
    busy.current = false;
  }

  return { add, cancel, dialog };
}
