import { render } from "@react-email/render";
import { db, orders, orderLines, tenants } from "@/db";
import { eq, sql } from "drizzle-orm";
import { sendEmail } from "./client";
import { OrderConfirmationEmail } from "./templates/OrderConfirmation";
import { OrderReadyEmail } from "./templates/OrderReady";
import React from "react";

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
  const emailsSent = (order.emailsSent as Record<string, any>) || {};
  if (emailsSent.confirmation) {
    return;
  }

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
    })),
    totalAmount: Number(order.total),
    refundPolicyUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/${tenant.id}/refund-policy`,
  };

  try {
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
  } catch (err) {
    console.error(`[email] Failed to send confirmation email for ${orderId}:`, err);
  }
}

/**
 * Sends an order ready email to the parent.
 * Uses "Stamp on Success" logic to prevent duplicate emails.
 */
export async function sendOrderReadyEmail(orderId: string) {
  const data = await getOrderForEmail(orderId);
  if (!data) {
    console.error(`[email] Order ${orderId} not found for ready email`);
    return;
  }

  const { order, tenant } = data;

  // Check if already sent (Idempotency)
  const emailsSent = (order.emailsSent as Record<string, any>) || {};
  if (emailsSent.ready) {
    return;
  }

  const props = {
    tenantName: tenant.name,
    tenantAccent: tenant.accent,
    orderId: order.id,
    studentName: order.studentName,
    collectionInstructions:
      tenant.collectionInstructions || "Please collect from the school office.",
    shopHours: tenant.shopHours || "Mon-Fri, 8:30am - 4:00pm",
  };

  try {
    const html = await render(React.createElement(OrderReadyEmail, props));
    const text = await render(React.createElement(OrderReadyEmail, props), {
      plainText: true,
    });

    const result = await sendEmail({
      to: order.parentEmail,
      subject: `Your order #${order.id} is ready for pickup!`,
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
          emailsSent: sql`jsonb_set(COALESCE(${orders.emailsSent}, '{}'::jsonb), '{ready}', ${JSON.stringify(
            stamp
          )}::jsonb)`,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    }
  } catch (err) {
    console.error(`[email] Failed to send ready email for ${orderId}:`, err);
  }
}
