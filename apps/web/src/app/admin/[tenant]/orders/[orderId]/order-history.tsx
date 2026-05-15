"use client";

import type { listOrderEvents, listOrderNotificationEvents } from "@/db/queries";

type OrderEventRow = Awaited<ReturnType<typeof listOrderEvents>>[number];
type NotificationEventRow = Awaited<
  ReturnType<typeof listOrderNotificationEvents>
>[number];

export function OrderHistory({
  events,
  notifications,
}: {
  events: OrderEventRow[];
  notifications: NotificationEventRow[];
}) {
  const rows: Array<{ ts: Date; label: string; sub?: string }> = [];
  for (const e of events) {
    if (!e.createdAt) continue;
    rows.push({
      ts: e.createdAt,
      label: `${e.eventType}${
        e.fromStatus ? ` (${e.fromStatus} → ${e.toStatus ?? ""})` : ""
      }`,
      sub: e.reason ?? undefined,
    });
  }
  for (const n of notifications) {
    if (!n.createdAt) continue;
    rows.push({
      ts: n.createdAt,
      label: `email:${n.type} → ${n.status}`,
      sub: n.failureReason ?? undefined,
    });
  }
  rows.sort((a, b) => b.ts.getTime() - a.ts.getTime());

  if (rows.length === 0) return null;

  return (
    <section className="mt-6 border border-rule rounded p-3 bg-paper">
      <h3 className="font-serif text-lg mb-2">History</h3>
      <ol className="text-sm flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-col">
            <span className="text-xs text-foreground/60 tnum">
              {r.ts.toLocaleString()}
            </span>
            <span>{r.label}</span>
            {r.sub && <span className="text-xs text-foreground/70">{r.sub}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
