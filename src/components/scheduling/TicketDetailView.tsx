import type { Person } from '@/lib/api/identity';
import type { Ticket } from '@/lib/api/tickets';
import {
  ticketDetailFields,
  type TicketDetailContext,
  type TicketDetailField,
  type TicketDetailGroup,
  type TicketSourceEvent,
} from '@/lib/tickets-ui';

const GROUPS: readonly TicketDetailGroup[] = ['Kişi', 'Bilet', 'Giriş', 'Formdaki diğer cevaplar'];

/** A guest's empty school fields say nothing; the ticket's own fields stay, empty or not. */
const OPTIONAL = new Set(['Telefon', 'Üniversite', 'Fakülte', 'Bölüm', 'Sınıf']);

function FieldValue({ field }: { field: TicketDetailField }) {
  if (!field.href) return <>{field.value}</>;
  const local = field.href.startsWith('/');
  return (
    <a
      href={field.href}
      className="text-skylab-300 hover:text-foreground"
      target={local ? undefined : '_blank'}
      rel={local ? undefined : 'noreferrer'}
    >
      {field.value}
    </a>
  );
}

/** A registration's fields in groups, a label beside each value. */
export function TicketDetailView({
  ticket,
  people,
  event,
  sessions,
  groups = GROUPS,
  headings = true,
}: {
  ticket: Ticket;
  people: Map<string, Person>;
  event?: TicketSourceEvent | null;
  sessions?: TicketDetailContext['sessions'];
  /** The groups to show, in order; all four by default. */
  groups?: readonly TicketDetailGroup[];
  /** Off inside a card that already names the group. */
  headings?: boolean;
}) {
  const fields = ticketDetailFields(ticket, people, event, { sessions }).filter(
    (field) => !(OPTIONAL.has(field.label) && field.value === '—'),
  );
  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const rows = fields.filter((field) => field.group === group);
        if (!rows.length) return null;
        return (
          <section key={group} aria-label={group} className="space-y-2">
            {headings ? <h3 className="text-foreground text-sm font-semibold">{group}</h3> : null}
            <dl className="grid grid-cols-[minmax(6rem,9rem)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
              {rows.map((field, index) => (
                <div key={`${field.label}-${index}`} className="contents">
                  <dt className="text-muted-foreground">{field.label}</dt>
                  <dd className="text-secondary-foreground break-words">
                    <FieldValue field={field} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
