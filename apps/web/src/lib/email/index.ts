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

type EmailStamp = { sentAt: string; messageId: string };
type EmailsSent = {
  confirmation?: EmailStamp;
  ready?: EmailStamp;
};

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
 * Sends an order confirmation email to the parent.
 * Uses "Stamp on Success" logic to prevent duplicate emails.
 */
export async function sendOrderConfirmationEmail(orderId: string) {
  const data = await getOrderForEmail(orderId);
  if (!data) {
    console.error(`[email] Order ${orderId} not found for confirmation email`);
    return;
  }

  const { order, tenant, lines } = data;

  // Check if already sent (Idempotency)
  const emailsSent = (order.emailsSent as EmailsSent) ?? {};
  if (emailsSent.confirmation) {
    return;
  }

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

  const html = await render(React.createElement(OrderConfirmationEmail, props));
  const text = await render(React.createElement(OrderConfirmationEmail, props), {
    plainText: true,
  });

  const result = await sendEmail({
    to: order.parentEmail,
    subject: `Order Confirmation #${order.id} - ${tenant.name}`,
    html,
    text,
  });

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
  }
}

/**
 * Sends the order-ready email via the notification dispatcher.
 * Idempotency keys derive from the order_events row ID emitted by the
 * transition, so retries within the same transition yield the same key.
 */
export async function sendOrderReadyEmail(input: {
  orderId: string;
  tenantId: string;
  orderEventId: string;
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
    idempotencyKey: `ready:${input.orderId}:${input.orderEventId}`,
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
  orderEventId: string;
  triggeredByUserId: string | null;
}): Promise<EnqueueResult> {
  return enqueueNotification({
    orderId: input.orderId,
    tenantId: input.tenantId,
    type: "hold",
    recipientEmail: input.parentEmail,
    idempotencyKey: `hold:${input.orderId}:${input.orderEventId}`,
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
