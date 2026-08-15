import { render } from "@react-email/render";
import { db, orders, orderLines, tenants } from "@/db";
import { eq, sql } from "drizzle-orm";
import { sendEmail } from "./client";
import { OrderConfirmationEmail } from "./templates/OrderConfirmation";
import { OrderReadyEmail } from "./templates/OrderReady";
import { OrderHold } from "./templates/OrderHold";
import { OrderRefund } from "./templates/OrderRefund";
import { enqueueNotification, type EnqueueResult } from "./dispatch";
import { serverCaptureException } from "@/lib/analytics/server";
import React from "react";

function requireAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new PermanentEmailError(
      "NEXT_PUBLIC_APP_URL is required to render email links",
    );
  }
  return url;
}

/**
 * A failure that retrying cannot fix: missing config, an unrenderable template,
 * a malformed recipient, or a provider 4xx. Callers stamp a terminal
 * `failed` marker for these instead of releasing the claim for another attempt.
 */
export class PermanentEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentEmailError";
  }
}

/**
 * How many times a *transient* confirmation send may be retried across Stripe
 * webhook redeliveries before the slot is marked terminally failed. Without a
 * cap, a provider that keeps 5xx-ing (or a request that keeps timing out) would
 * be re-attempted on every redelivery forever with no actionable failed state.
 */
const CONFIRMATION_MAX_ATTEMPTS = 5;

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
 * Marks a claimed confirmation slot as retryable so a later delivery re-claims
 * it. Keeps the attempt counter so the retry budget is enforced across
 * deliveries (the slot is never emptied — an empty slot would reset the count).
 */
async function markConfirmationRetry(
  orderId: string,
  attempts: number,
  reason: string,
) {
  await db
    .update(orders)
    .set({
      emailsSent: sql`jsonb_set(
        COALESCE(${orders.emailsSent}, '{}'::jsonb),
        '{confirmation}',
        ${JSON.stringify({
          status: "retry",
          attempts,
          lastError: reason.slice(0, 500),
          lastAttemptAt: new Date().toISOString(),
        })}::jsonb
      )`,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));
}

/**
 * Marks the confirmation slot terminally failed. The slot stays non-null and
 * non-`retry`, so the atomic claim below will never re-claim it: redeliveries
 * stop re-attempting a send that cannot succeed, and the admin order card
 * surfaces a "Confirmation failed" badge for manual follow-up.
 */
async function markConfirmationFailed(
  orderId: string,
  attempts: number,
  reason: string,
) {
  // Dead-letter signal: every terminal confirmation failure is reported once,
  // including the paths that do not throw out of the send.
  await serverCaptureException(
    "confirmation-email",
    new Error(`confirmation_email_failed_permanently: ${reason}`),
    { orderId, attempts },
  );
  await db
    .update(orders)
    .set({
      emailsSent: sql`jsonb_set(
        COALESCE(${orders.emailsSent}, '{}'::jsonb),
        '{confirmation}',
        ${JSON.stringify({
          status: "failed",
          attempts,
          reason: reason.slice(0, 500),
          failedAt: new Date().toISOString(),
        })}::jsonb
      )`,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));
}

/**
 * Records a failed send attempt: terminal for permanent failures or once the
 * retry budget is spent, retryable otherwise.
 */
async function recordConfirmationFailure(
  orderId: string,
  attempts: number,
  err: unknown,
) {
  const reason = err instanceof Error ? err.message : String(err);
  const permanent = err instanceof PermanentEmailError;
  if (permanent || attempts >= CONFIRMATION_MAX_ATTEMPTS) {
    await markConfirmationFailed(
      orderId,
      attempts,
      permanent ? reason : `max_attempts_exceeded: ${reason}`,
    );
    return;
  }
  await markConfirmationRetry(orderId, attempts, reason);
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
 * non-empty) proceeds to send.
 *
 * Failure handling is state-machined through the same slot so redeliveries stay
 * bounded (issue #42):
 *
 *   absent                                  → claimable
 *   {status:"pending", attempts}            → a send is in flight
 *   {status:"retry", attempts, lastError}   → transient failure, re-claimable
 *                                             while attempts < MAX
 *   {status:"failed", attempts, reason}     → terminal; never re-claimed
 *   {sentAt, messageId}                     → sent
 *
 * A permanent failure (missing config, unrenderable template, malformed
 * recipient, provider 4xx) goes straight to `failed`; a transient one burns one
 * attempt and lands on `failed` once the budget is spent. Either way the slot
 * stops being re-claimed, so a config-broken deployment no longer re-attempts
 * on every Stripe redelivery forever, and the failed state is visible to admins.
 */
export async function sendOrderConfirmationEmail(orderId: string) {
  // Atomic claim: only one concurrent caller can take the slot. Claimable when
  // never attempted, or left `retry` with attempts still under budget. The
  // attempt counter is carried forward so the budget spans redeliveries.
  const claimed = await db
    .update(orders)
    .set({
      emailsSent: sql`jsonb_set(
        COALESCE(${orders.emailsSent}, '{}'::jsonb),
        '{confirmation}',
        jsonb_build_object(
          'status', 'pending',
          'attempts',
          COALESCE((${orders.emailsSent} -> 'confirmation' ->> 'attempts')::int, 0) + 1
        )
      )`,
      updatedAt: new Date(),
    })
    .where(
      sql`${orders.id} = ${orderId} AND (
        (COALESCE(${orders.emailsSent}, '{}'::jsonb) -> 'confirmation') IS NULL
        OR (
          COALESCE(${orders.emailsSent} -> 'confirmation' ->> 'status', '') = 'retry'
          AND COALESCE((${orders.emailsSent} -> 'confirmation' ->> 'attempts')::int, 0)
              < ${CONFIRMATION_MAX_ATTEMPTS}
        )
      )`
    )
    .returning({ emailsSent: orders.emailsSent });

  if (claimed.length === 0) {
    // Already sent, in flight, or terminally failed — nothing to do.
    return;
  }

  const attempts =
    Number(
      (claimed[0].emailsSent as { confirmation?: { attempts?: number } })
        ?.confirmation?.attempts,
    ) || 1;

  const data = await getOrderForEmail(orderId);
  if (!data) {
    // The order row is gone (or its tenant is): no amount of retrying helps,
    // and there is no row left to stamp — log and stop.
    console.error(`[email] Order ${orderId} not found for confirmation email`);
    await markConfirmationFailed(orderId, attempts, "order_not_found");
    return;
  }

  const { order, tenant, lines } = data;

  // requireAppUrl() throws PermanentEmailError when NEXT_PUBLIC_APP_URL is
  // unset — a config fault that every redelivery would hit identically.
  let appUrl: string;
  try {
    appUrl = requireAppUrl();
  } catch (err) {
    await recordConfirmationFailure(orderId, attempts, err);
    throw err;
  }

  const refundPolicyUrl = tenant.currentLegalVersionId
    ? `${appUrl}/${tenant.id}/refund-policy`
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
    orderUrl: `${appUrl}/orders/${order.id}`,
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
    // The template failed to render for this order's data — deterministic, so
    // retrying the same order would fail the same way. Terminal.
    const failure = new PermanentEmailError(
      `render_failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    await recordConfirmationFailure(orderId, attempts, failure);
    throw err;
  }

  let result: Awaited<ReturnType<typeof sendEmail>>;
  try {
    // sendEmail throws only for 5xx / timeout (transient) and returns null for
    // permanent rejections (malformed recipient, provider 4xx).
    result = await sendEmail({
      to: order.parentEmail,
      subject: `Order Confirmation #${order.id} - ${tenant.name}`,
      html,
      text,
    });
  } catch (err) {
    await recordConfirmationFailure(orderId, attempts, err);
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
    // A null result means the provider permanently rejected the send (malformed
    // recipient or a 4xx) — retrying is futile, so mark the slot failed and
    // surface it rather than re-attempting on every redelivery.
    await markConfirmationFailed(
      orderId,
      attempts,
      "provider_rejected: no message id returned",
    );
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
