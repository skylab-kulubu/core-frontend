import { FieldLabel } from '@/components/chrome/FieldLabel';
import type { Person } from '@/lib/api/identity';
import type { Ticket } from '@/lib/api/tickets';
import {
  ticketDetailFields,
  type TicketDetailContext,
  type TicketSourceEvent,
} from '@/lib/tickets-ui';

export function TicketDetailView({
  ticket,
  people,
  event,
  sessions,
}: {
  ticket: Ticket;
  people: Map<string, Person>;
  event?: TicketSourceEvent | null;
  sessions?: TicketDetailContext['sessions'];
}) {
  const fields = ticketDetailFields(ticket, people, event, { sessions });
  return (
    <dl className="divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
      {fields.map((field, index) => (
        <div key={`${field.label}-${index}`} className="space-y-1 px-3 py-2.5">
          <dt>
            <FieldLabel>{field.label}</FieldLabel>
          </dt>
          <dd className="text-sm break-words text-neutral-200">
            {field.href ? (
              <a
                href={field.href}
                className="text-skylab-300 hover:text-skylab-200"
                target={field.href.startsWith('/') ? undefined : '_blank'}
                rel={field.href.startsWith('/') ? undefined : 'noreferrer'}
              >
                {field.value}
              </a>
            ) : (
              field.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
