import { sql } from "drizzle-orm";
import { db } from "@/db";
import { orderEvents } from "@/db/schema";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { serverCapture, serverCaptureException } from "@/lib/analytics/server";

type RecordOrderPaidArgs = {
  orderId: string;
  tenantId: string;
  paymentIntentId: string;
  /** Charge amount in dollars, for analytics only. */
  amount?: number;
  /** ISO currency, for analytics only. */
  currency?: string;
  /** PostHog distinct id of the caller (user id from the order POST, or a system id). */
  analyticsDistinctId: string;
};

/**
 * Idempotently record that an order has been paid, and fire the one-time side
 * effects (audit event, analytics, confirmation email).
 *
 * Called from BOTH the order POST (which inserts the order as already `paid`,
 * since it has verified the PaymentIntent succeeded) and the
 * `payment_intent.succeeded` webhook (the backstop). Either may win the race or
 * run first, and the webhook may be redelivered any number of times — so every
 * effect here is idempotent:
 *
 *  - the `order_paid` event insert relies on the partial unique index
 *    `order_events_paid_unique` (`order_id` WHERE event_type='order_paid'); its
 *    RETURNING tells us whether THIS call was the first to record the payment,
 *    which gates the analytics capture to exactly once;
 *  - `sendOrderConfirmationEmail` is self-idempotent under concurrency: it
 *    atomically CLAIMS the order's `emailsSent.confirmation` slot (a single
 *    conditional UPDATE flips an empty slot to `pending`), so only one of two
 *    concurrent callers sends. A transient failure leaves the slot `retry` and
 *    the next delivery re-claims it, but only ever sends once. Retries are
 *    bounded: a permanent failure (missing config, unrenderable template,
 *    provider 4xx) — or exhausting the retry budget — stamps a terminal
 *    `failed` marker that is never re-claimed, so a broken config cannot drive
 *    unbounded futile re-sends across Stripe redeliveries.
 */
export async function recordOrderPaid({
  orderId,
  tenantId,
  paymentIntentId,
  amount,
  currency,
  analyticsDistinctId,
}: RecordOrderPaidArgs): Promise<void> {
  const inserted = await db
    .insert(orderEvents)
    .values({
      orderId,
      tenantId,
      eventType: "order_paid",
      metadataJson: { paymentIntentId },
    })
    .onConflictDoNothing({
      target: orderEvents.orderId,
      where: sql`${orderEvents.eventType} = 'order_paid'`,
    })
    .returning({ id: orderEvents.id });

  // RETURNING is empty when the row already existed (conflict) — so a non-empty
  // result means this call is the first to record the payment.
  const firstRecord = inserted.length === 1;

  if (firstRecord) {
    await serverCapture(analyticsDistinctId, "order_confirmed", {
      order_id: orderId,
      tenant_id: tenantId,
      stripe_payment_intent_id: paymentIntentId,
      amount,
      currency,
    });
  }

  // Self-idempotent; safe to call on every delivery so a previously-failed send
  // is retried. Best-effort — never throw out of here.
  try {
    await sendOrderConfirmationEmail(orderId);
  } catch (err) {
    console.error("Confirmation email failed for order", orderId, err);
    await serverCaptureException(
      "order-paid",
      err instanceof Error ? err : new Error(String(err)),
      { step: "confirmation-email", orderId }
    );
  }
}
