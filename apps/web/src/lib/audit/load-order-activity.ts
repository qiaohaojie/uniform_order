import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, orderRefunds, orders } from "@/db/schema";
import type { AuditEvent } from "./types";

/**
 * Merged + sorted row list for the order timeline UI.
 *
 * Combines:
 * - `audit_events` rows scoped to (targetType="order", targetId=orderId)
 * - `order_refunds` rows for the order (rendered as `payment_refunded`)
 * - a synthetic `order_placed` row sourced from `orders.createdAt` / `parentName`
 *
 * Note: there is no separate payments table and `orders` has no `paidAt`
 * column, so we do not emit a `payment_received` row. Successful Stripe
 * charges are recorded on `orders.stripePaymentIntentId` but not timestamped
 * separately from order creation.
 */
export type OrderActivityRow =
  | { kind: "audit"; id: string; createdAt: Date; event: AuditEvent }
  | { kind: "payment_refunded"; id: string; createdAt: Date; amount: string }
  | { kind: "order_placed"; id: string; createdAt: Date; parentName: string };

const MAX_ROWS = 20;

export async function loadOrderActivity(
  orderId: string
): Promise<OrderActivityRow[]> {
  const [auditRows, refundRows, orderRow] = await Promise.all([
    db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.targetType, "order"),
          eq(auditEvents.targetId, orderId)
        )
      )
      .orderBy(desc(auditEvents.createdAt))
      .limit(MAX_ROWS),
    db
      .select()
      .from(orderRefunds)
      .where(eq(orderRefunds.orderId, orderId))
      .orderBy(desc(orderRefunds.createdAt))
      .limit(MAX_ROWS),
    db
      .select({
        createdAt: orders.createdAt,
        parentName: orders.parentName,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1),
  ]);

  const rows: OrderActivityRow[] = [];

  for (const a of auditRows) {
    if (!a.createdAt) continue;
    rows.push({ kind: "audit", id: a.id, createdAt: a.createdAt, event: a });
  }

  for (const r of refundRows) {
    if (!r.createdAt) continue;
    rows.push({
      kind: "payment_refunded",
      id: r.id,
      createdAt: r.createdAt,
      amount: r.amount,
    });
  }

  const order = orderRow[0];
  if (order && order.createdAt) {
    rows.push({
      kind: "order_placed",
      id: `order-placed-${orderId}`,
      createdAt: order.createdAt,
      parentName: order.parentName ?? "parent",
    });
  }

  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return rows.slice(0, MAX_ROWS);
}
