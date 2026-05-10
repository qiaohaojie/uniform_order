import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, tenants, orderRefunds } from "@/db/schema";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { serverCapture, serverCaptureException } from "@/lib/analytics/server";
import { getStripe } from "@/lib/stripe";
import { revalidateTag } from "next/cache";
import { tenantBillingTag } from "@/lib/platform/stripe-billing";

export const runtime = "nodejs"; // required: edge runtime can't read raw body for Stripe sig

function isLivemodeExpected() {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_") ?? false;
}

function money(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new NextResponse("missing signature", { status: 400 });

  const stripe = getStripe();
  const rawBody = await req.text(); // MUST be raw text, not req.json()
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("Stripe signature verification failed:", err);
    await serverCaptureException("stripe-webhook", err instanceof Error ? err : new Error(String(err)), { step: "signature-verification" });
    return new NextResponse("invalid signature", { status: 400 });
  }

  // Guard against test-mode webhooks hitting a production DB (or vice versa)
  const expectedLivemode = isLivemodeExpected();
  if (event.livemode !== expectedLivemode) {
    console.warn("stripe webhook: livemode mismatch", {
      expected: expectedLivemode,
      got: event.livemode,
      eventId: event.id,
      type: event.type,
    });
    await serverCaptureException(
      "stripe-webhook",
      new Error("livemode mismatch"),
      { expected: expectedLivemode, got: event.livemode, eventId: event.id, type: event.type }
    );
    return NextResponse.json({ received: true, ignored: "livemode mismatch" });
  }

  // ─── payment_intent.succeeded ───────────────────────────────────────────
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;

    // Atomic transition; .returning() gives us orderId only when we actually flipped the row
    // IMPORTANT: Only transition from 'pending_payment' to 'new'
    const flipped = await db
      .update(orders)
      .set({ status: "new" })
      .where(and(eq(orders.stripePaymentIntentId, pi.id), eq(orders.status, "pending_payment")))
      .returning({ id: orders.id });

    if (flipped.length === 1) {
      await serverCapture("stripe-webhook", "order_confirmed", {
        order_id: flipped[0].id,
        stripe_payment_intent_id: pi.id,
        amount: pi.amount ? pi.amount / 100 : undefined,
        currency: pi.currency,
      });
      try {
        await sendOrderConfirmationEmail(flipped[0].id);
      } catch (err) {
        console.error("Confirmation email failed for order", flipped[0].id, err);
        await serverCaptureException("stripe-webhook", err instanceof Error ? err : new Error(String(err)), { step: "confirmation-email", orderId: flipped[0].id });
      }
    } else {
      console.info("stripe webhook: no pending_payment order matched", pi.id);
    }

    return NextResponse.json({ received: true });
  }

  // ─── account.updated ──────────────────────────────────────────────────────
  // Sync Stripe Connect account status to tenants table
  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    if (account.id) {
      try {
        const updated = await db
          .update(tenants)
          .set({
            stripePayoutsEnabled: account.payouts_enabled ?? false,
            stripeChargesEnabled: account.charges_enabled ?? false,
            updatedAt: new Date(),
          })
          .where(eq(tenants.stripeAccountId, account.id))
          .returning({ id: tenants.id });

        if (updated.length === 0) {
          console.info("stripe webhook: account.updated matched no tenant", account.id);
          await serverCapture("stripe-webhook", "stripe_account_updated_unmatched", {
            stripe_account_id: account.id,
            event_id: event.id,
          });
        } else {
          await serverCapture("stripe-webhook", "stripe_account_updated", {
            tenant_id: updated[0].id,
            stripe_account_id: account.id,
            payouts_enabled: account.payouts_enabled ?? false,
            charges_enabled: account.charges_enabled ?? false,
            details_submitted: account.details_submitted ?? false,
          });
          revalidateTag(tenantBillingTag(updated[0].id), "max");
        }
      } catch (err) {
        console.error("stripe webhook: account.updated DB write failed", err);
        await serverCaptureException(
          "stripe-webhook",
          err instanceof Error ? err : new Error(String(err)),
          { step: "account-updated", stripeAccountId: account.id, eventId: event.id }
        );
        throw err; // let Stripe retry
      }
    }
    return NextResponse.json({ received: true });
  }

  // ─── charge.refunded ──────────────────────────────────────────────────────
  // Record out-of-band refunds initiated from Stripe Dashboard.
  // Iterate all refunds on the charge in case there are multiple partials.
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const refunds = charge.refunds?.data ?? [];
    if (refunds.length > 0 && charge.payment_intent) {
      const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent.id;
      const [orderRow] = await db
        .select({ id: orders.id, total: orders.total, status: orders.status })
        .from(orders)
        .where(eq(orders.stripePaymentIntentId, piId))
        .limit(1);

      if (orderRow) {
        for (const refund of refunds) {
          if (!refund.id) continue;
          const amount = refund.amount ? refund.amount / 100 : 0;

          // ON CONFLICT DO NOTHING avoids races from duplicate webhooks
          // or concurrent API-refund insertions.
          await db
            .insert(orderRefunds)
            .values({
              orderId: orderRow.id,
              amount: String(amount),
              stripeRefundId: refund.id,
              reason: refund.reason ?? "Stripe dashboard refund",
            })
            .onConflictDoNothing({ target: orderRefunds.stripeRefundId });
        }

        // Recompute total refunded from DB and update status
        const [sumRow] = await db
          .select({ total: sql<number>`coalesce(sum(${orderRefunds.amount}), 0)` })
          .from(orderRefunds)
          .where(eq(orderRefunds.orderId, orderRow.id));

        const refundedSum = money(sumRow?.total ?? 0);
        const orderTotal = money(orderRow.total);
        const newStatus = refundedSum >= orderTotal ? "refunded" : "partially_refunded";
        if (newStatus !== orderRow.status) {
          await db
            .update(orders)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(orders.id, orderRow.id));
        }
      }
    }
    return NextResponse.json({ received: true });
  }

  // Default: acknowledge receipt for any other event type
  return NextResponse.json({ received: true, ignored: event.type });
}
