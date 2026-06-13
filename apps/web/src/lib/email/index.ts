import { render } from "@react-email/render";
import { db, orders, orderLines, tenants } from "@/db";
import { eq, sql } from "drizzle-orm";
import { sendEmail } from "./client";
import { OrderConfirmationEmail } from "./templates/OrderConfirmation";
import { OrderReadyEmail } from "./templates/OrderReady";
import { OrderHold } from "./templates/OrderHold";
import { OrderRefund } from "./templates/OrderRefund";
import { enqueueNotification, type EnqueueResult } from "./dispatch";
import React from "react";

function requireAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL is required to render email links");
  }
  return url;
}

/**
 * Helper to fetch order with its line items and tenant information.
 */
async function getOrderForEmail(orderId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return null;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, order.tenantId))
    .limit(1);

  if (!tenant) return null;

  const lines = await db
    .select()
    .from(orderLines)
    .where(eq(orderLines.orderId, orderId));

  return { order, tenant, lines };
}

/**
 * Releases a previously-claimed confirmation slot so a later delivery can retry.
 * Removes the `confirmation` key entirely (back to the un-claimed state).
 */
async function releaseConfirmationClaim(orderId: string) {
  await db
    .update(orders)
    .set({
      emailsSent: sql`COALESCE(${orders.emailsSent}, '{}'::jsonb) - 'confirmation'`,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));
}

/**
 * Sends an order confirmation email to the parent.
 *
 * `recordOrderPaid` invokes this from BOTH the order POST and the
 * `payment_intent.succeeded` webhook (which Stripe may redeliver), so two calls
 * can run concurrently. A read-then-write guard (read `emailsSent.confirmation`,
 * then send, then stamp) lets both callers observe an empty slot before either
 * stamps it, and the parent receives two emails. Instead we ATOMICALLY claim the
 * slot: a single conditional UPDATE flips a still-empty slot to a `pending`
 * marker, and only the caller whose UPDATE actually changed a row (RETURNING
 * non-empty) proceeds to send. On failure the claim is released so the next
 * delivery retries — preserving the prior "retry until sent once" behaviour.
 */
export async function sendOrderConfirmationEmail(orderId: string) {
  // Atomic claim: only one concurrent caller can flip null -> pending.
  const claimed = await db
    .update(orders)
    .set({
      emailsSent: sql`jsonb_set(COALESCE(${orders.emailsSent}, '{}'::jsonb), '{confirmation}', '{"status":"pending"}'::jsonb)`,
      updatedAt: new Date(),
    })
    .where(
      sql`${orders.id} = ${orderId} AND (COALESCE(${orders.emailsSent}, '{}'::jsonb) -> 'confirmation') IS NULL`
    )
    .returning({ id: orders.id });

  if (claimed.length === 0) {
    // Already claimed/sent by a concurrent or prior caller — nothing to do.
    return;
  }

  const data = await getOrderForEmail(orderId);
  if (!data) {
    console.error(`[email] Order ${orderId} not found for confirmation email`);
    await releaseConfirmationClaim(orderId);
    return;
  }

  const { order, tenant, lines } = data;

  const refundPolicyUrl = tenant.currentLegalVersionId
    ? `${requireAppUrl()}/${tenant.id}/refund-policy`
    : null;

  const props = {
    tenantName: tenant.name,
    tenantAccent: tenant.accent,
    orderId: order.id,
    parentName: order.parentName,
    studentName: order.studentName,
    studentYear: order.studentYear,
    items: lines.map((line) => ({
      itemName: line.itemName,
      variantLabel: line.variantLabel,
      qty: line.qty,
      unitPrice: Number(line.unitPrice),
      lineTotal: Number(line.lineTotal),
    })),
    totalAmount: Number(order.total),
    shopEmail: tenant.shopEmail,
    orderUrl: `${requireAppUrl()}/orders/${order.id}`,
    refundPolicyUrl,
  };

  let html: string;
  let text: string;
  try {
    html = await render(React.createElement(OrderConfirmationEmail, props));
    text = await render(React.createElement(OrderConfirmationEmail, props), {
      plainText: true,
    });
  } catch (err) {
    // Render failed before send — release the claim so a redelivery retries.
    await releaseConfirmationClaim(orderId);
    throw err;
  }

  let result: Awaited<ReturnType<typeof sendEmail>>;
  try {
    result = await sendEmail({
      to: order.parentEmail,
      subject: `Order Confirmation #${order.id} - ${tenant.name}`,
      html,
      text,
    });
  } catch (err) {
    await releaseConfirmationClaim(orderId);
    throw err;
  }

  if (result?.id) {
    const stamp = {
      sentAt: new Date().toISOString(),
      messageId: result.id,
    };

    await db
      .update(orders)
      .set({
        emailsSent: sql`jsonb_set(COALESCE(${orders.emailsSent}, '{}'::jsonb), '{confirmation}', ${JSON.stringify(
          stamp
        )}::jsonb)`,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
  } else {
    // Provider returned no id => not actually delivered. Release the claim so a
    // later delivery can retry, matching the prior stamp-on-success behaviour.
    await releaseConfirmationClaim(orderId);
  }
}

/**
 * Sends the order-ready email via the notification dispatcher.
 *
 * Callers MUST pass a deterministic `idempotencyKey` so retries within a single
 * transition collapse to one delivery. Keying on a freshly-inserted
 * `order_events.id` (which differs per retry) silently bypasses the unique
 * index on `order_notification_events.idempotency_key`, so the dispatcher
 * accepts the caller's key verbatim.
 */
export async function sendOrderReadyEmail(input: {
  orderId: string;
  tenantId: string;
  idempotencyKey: string;
  triggeredByUserId: string | null;
}): Promise<EnqueueResult> {
  const data = await getOrderForEmail(input.orderId);
  if (!data) {
    console.error(`[email] Order ${input.orderId} not found for ready email`);
    return { eventId: "", status: "failed" };
  }
  const { order, tenant } = data;
  const refundPolicyUrl = tenant.currentLegalVersionId
    ? `${requireAppUrl()}/${tenant.id}/refund-policy`
    : null;

  return enqueueNotification({
    orderId: input.orderId,
    tenantId: input.tenantId,
    type: "ready",
    recipientEmail: order.parentEmail,
    idempotencyKey: input.idempotencyKey,
    triggeredBy: "staff_action",
    triggeredByUserId: input.triggeredByUserId,
    subject: `Your order #${order.id} is ready for pickup!`,
    reactBody: React.createElement(OrderReadyEmail, {
      tenantName: tenant.name,
      tenantAccent: tenant.accent,
      orderId: order.id,
      studentName: order.studentName,
      collectionInstructions:
        tenant.collectionInstructions || "Please collect from the school office.",
      shopHours: tenant.shopHours || "Mon-Fri, 8:30am - 4:00pm",
      orderUrl: `${requireAppUrl()}/orders/${order.id}`,
      shopEmail: tenant.shopEmail,
      refundPolicyUrl,
    }),
  });
}

export async function sendOrderHoldEmail(input: {
  orderId: string;
  tenantId: string;
  tenantName: string;
  parentName: string;
  parentEmail: string;
  idempotencyKey: string;
  triggeredByUserId: string | null;
}): Promise<EnqueueResult> {
  return enqueueNotification({
    orderId: input.orderId,
    tenantId: input.tenantId,
    type: "hold",
    recipientEmail: input.parentEmail,
    idempotencyKey: input.idempotencyKey,
    triggeredBy: "staff_action",
    triggeredByUserId: input.triggeredByUserId,
    subject: `Update on order ${input.orderId}`,
    reactBody: React.createElement(OrderHold, {
      tenantName: input.tenantName,
      parentName: input.parentName,
      orderId: input.orderId,
    }),
  });
}

export async function sendOrderRefundEmail(input: {
  orderId: string;
  tenantId: string;
  tenantName: string;
  parentName: string;
  parentEmail: string;
  stripeRefundId: string;
  amountAud: string;
  isFullRefund: boolean;
  triggeredBy: "staff_action" | "webhook";
  triggeredByUserId: string | null;
}): Promise<EnqueueResult> {
  return enqueueNotification({
    orderId: input.orderId,
    tenantId: input.tenantId,
    type: "refund",
    recipientEmail: input.parentEmail,
    idempotencyKey: `refund:${input.stripeRefundId}`,
    triggeredBy: input.triggeredBy,
    triggeredByUserId: input.triggeredByUserId,
    subject: `Refund processed for order ${input.orderId}`,
    reactBody: React.createElement(OrderRefund, {
      tenantName: input.tenantName,
      parentName: input.parentName,
      orderId: input.orderId,
      amountAud: input.amountAud,
      isFullRefund: input.isFullRefund,
    }),
  });
}
