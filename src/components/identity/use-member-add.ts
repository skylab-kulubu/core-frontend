import { useRef, type ReactNode } from 'react';
import { identityApi } from '@/lib/api/identity';
import { countPossessive } from '@/lib/turkish-count';
import { useConfirm } from '@/lib/ui/use-confirm';

/** The candidate list's mark on a person core warns of (a Privileged Group only). */
export const UNVERIFIED_MARK = 'YTÜ ile doğrulanmamış';

/** The question's action once core warned of an account not verified with YTÜ. */
export const UNVERIFIED_ADD_ACTION = 'Gruba ekle';

/** How many of the unverified a question names before it counts the rest. */
const NAMED_MOST = 3;

/** The question's text for one account not verified with YTÜ. */
export function unverifiedAddText(email: string): string {
  return `Bu hesap YTÜ hesabıyla doğrulanmamış. Yönetim yetkisi vermeden önce e-posta adresinin (${email}) bu kişiye ait olduğunu kontrol et.`;
}

/** The question's text for a batch of `total` people of whom `unverified` are not verified with YTÜ. */
export function unverifiedBatchText(
  total: number,
  unverified: readonly { name: string; email: string }[],
): string {
  const named = unverified.slice(0, NAMED_MOST).map(({ name, email }) => `${name} (${email})`);
  const rest = unverified.length - named.length;
  const list = rest > 0 ? `${named.join(', ')} ve ${rest} kişi daha` : named.join(', ');
  const check =
    unverified.length === 1 ? 'E-posta adresini kontrol et.' : 'E-posta adreslerini kontrol et.';
  return `${total} kişiden ${countPossessive(unverified.length)} YTÜ ile doğrulanmamış: ${list}. ${check}`;
}

export type MemberAdd = {
  groupId: string;
  userId: string;
  /** The person's name, for the question. */
  personName: string;
  /** The person's whole address, for the question. */
  personEmail: string;
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
 * closes: a check that answers later then asks nothing and adds nobody, and
 * the next opening may pick at once. An add already sent still holds the
 * next pick until core answers it, so a quick close and reopen sends no
 * second add. Render `dialog` inside the picker's drawer so the question
 * opens over it.
 */
export function useMemberAdd(): {
  add: (request: MemberAdd) => Promise<void>;
  cancel: () => void;
  dialog: ReactNode;
} {
  const [confirm, dialog] = useConfirm();
  // Which picker opening a pick belongs to
  const run = useRef(0);
  // The pick still running, and whether it is only being checked so far
  const holder = useRef<{ checking: boolean } | null>(null);

  async function add(request: MemberAdd) {
    if (holder.current) return;
    const pick = { checking: true };
    holder.current = pick;
    const opening = run.current;
    const { groupId, userId, onAdded } = request;
    try {
      const warns = await warnsUnverified(groupId, userId);
      if (opening !== run.current) return;
      pick.checking = false;
      if (warns) {
        confirm({
          title: `${request.personName} ${request.groupName} grubuna eklensin mi?`,
          description: unverifiedAddText(request.personEmail),
          actionLabel: UNVERIFIED_ADD_ACTION,
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
      if (holder.current === pick) holder.current = null;
    }
  }

  function cancel() {
    run.current += 1;
    if (holder.current?.checking) holder.current = null;
  }

  return { add, cancel, dialog };
}
