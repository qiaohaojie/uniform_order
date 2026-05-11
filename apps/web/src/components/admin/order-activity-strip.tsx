import { formatAuditEvent, formatRelativeTime } from "@/lib/audit/format";
import type { OrderActivityRow } from "@/lib/audit/load-order-activity";

function describeRow(row: OrderActivityRow): {
  line: string;
  actor: string;
  isHumanActor: boolean;
} {
  switch (row.kind) {
    case "audit":
      return {
        line: formatAuditEvent(row.event),
        actor: row.event.actorEmail,
        isHumanActor: true,
      };
    case "payment_refunded":
      return {
        line: `Refund processed ($${Number(row.amount).toFixed(2)})`,
        actor: "Stripe",
        isHumanActor: false,
      };
    case "order_placed":
      return {
        line: `Order placed by ${row.parentName}`,
        actor: row.parentName,
        isHumanActor: false,
      };
  }
}

export function OrderActivityStrip({ rows }: { rows: OrderActivityRow[] }) {
  if (rows.length === 0) {
    return (
      <section className="rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] p-5">
        <h2 className="font-serif text-lg text-[color:var(--color-navy-deep)]">
          Activity
        </h2>
        <p className="mt-2 text-sm text-neutral-500">No activity yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] p-5">
      <h2 className="font-serif text-lg text-[color:var(--color-navy-deep)]">
        Activity
      </h2>
      <ol className="mt-4 space-y-3">
        {rows.map((row) => {
          const { line, actor, isHumanActor } = describeRow(row);
          return (
            <li key={row.id} className="flex items-start gap-3 text-sm">
              <span
                aria-hidden
                className={`mt-2 inline-block h-2 w-2 shrink-0 rounded-full ${
                  isHumanActor
                    ? "bg-[color:var(--color-gold)]"
                    : "bg-neutral-400"
                }`}
              />
              <div className="flex flex-1 items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[color:var(--color-navy-deep)]">{line}</p>
                  <p className="text-xs text-neutral-500">{actor}</p>
                </div>
                <p className="tnum shrink-0 text-xs text-neutral-500">
                  {formatRelativeTime(row.createdAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
