import { formatAuditEvent, formatRelativeTime } from "@/lib/audit/format";
import type { AuditEvent } from "@/lib/audit/types";

const MAX_ROWS = 20;

export function TenantActivityFeed({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) {
    return (
      <section className="rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] p-5">
        <h2 className="font-serif text-lg text-[color:var(--color-navy-deep)]">Activity</h2>
        <p className="mt-2 text-sm text-neutral-500">No activity yet.</p>
      </section>
    );
  }

  const showFooter = events.length === MAX_ROWS;

  return (
    <section className="rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] p-5">
      <h2 className="font-serif text-lg text-[color:var(--color-navy-deep)]">Activity</h2>
      <ol className="mt-4 space-y-3">
        {events.map((e) => (
          <li key={e.id} className="flex items-start gap-3 text-sm">
            <span aria-hidden className="mt-2 inline-block h-2 w-2 shrink-0 rounded-full bg-[color:var(--color-gold)]" />
            <div className="flex flex-1 items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[color:var(--color-navy-deep)]">{formatAuditEvent(e)}</p>
                <p className="text-xs text-neutral-500">{e.actorEmail}</p>
              </div>
              <p className="tnum shrink-0 text-xs text-neutral-500">{formatRelativeTime(e.createdAt)}</p>
            </div>
          </li>
        ))}
      </ol>
      {showFooter ? (
        <p className="mt-4 text-xs text-neutral-500">Showing 20 most recent — full history coming soon.</p>
      ) : null}
    </section>
  );
}
