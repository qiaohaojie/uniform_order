import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, tenants, orderRefunds } from "@/db/schema";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { serverCaptureException } from "@/lib/analytics/server";

export const runtime = "nodejs"; // required: edge runtime can't read raw body for Stripe sig

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new NextResponse("missing signature", { status: 400 });

  const rawBody = await req.text(); // MUST be raw text, not req.json()
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("Stripe signature verification failed:", err);
    await serverCaptureException("stripe-webhook", err instanceof Error ? err : new Error(String(err)), { step: "signature-verification" });
    return new NextResponse("invalid signature", { status: 400 });
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
      await db
        .update(tenants)
        .set({
          stripePayoutsEnabled: account.payouts_enabled ?? false,
          stripeChargesEnabled: account.charges_enabled ?? false,
          updatedAt: new Date(),
        })
        .where(eq(tenants.stripeAccountId, account.id));
    }
    return NextResponse.json({ received: true });
  }

  // ─── charge.refunded ──────────────────────────────────────────────────────
  // Record out-of-band refunds initiated from Stripe Dashboard
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const refund = charge.refunds?.data?.[0];
    if (refund && charge.payment_intent) {
      const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent.id;
      const [orderRow] = await db
        .select({ id: orders.id, total: orders.total, status: orders.status })
        .from(orders)
        .where(eq(orders.stripePaymentIntentId, piId))
        .limit(1);

      if (orderRow) {
        // Check if this refund is already recorded
        const existing = await db
          .select({ id: orderRefunds.id })
          .from(orderRefunds)
          .where(eq(orderRefunds.stripeRefundId, refund.id))
          .limit(1);

        if (existing.length === 0) {
          const amount = refund.amount ? refund.amount / 100 : 0;
          await db.insert(orderRefunds).values({
            orderId: orderRow.id,
            amount: String(amount),
            stripeRefundId: refund.id,
            reason: refund.reason ?? "Stripe dashboard refund",
          });

          // Recalculate total refunded and update status
          const [{ totalRefunded }] = await db
            .select({ totalRefunded: db.$count(orderRefunds, eq(orderRefunds.orderId, orderRow.id)) })
            .from(orderRefunds)
            .where(eq(orderRefunds.orderId, orderRow.id));

          const orderTotal = parseFloat(orderRow.total);
          const refundedRows = await db
            .select({ amount: orderRefunds.amount })
            .from(orderRefunds)
            .where(eq(orderRefunds.orderId, orderRow.id));

          const refundedSum = refundedRows.reduce(
            (sum, r) => sum + parseFloat(String(r.amount)),
            0
          );

          const newStatus = refundedSum >= orderTotal - 0.01 ? "refunded" : "partially_refunded";
          if (newStatus !== orderRow.status) {
            await db
              .update(orders)
              .set({ status: newStatus, updatedAt: new Date() })
              .where(eq(orders.id, orderRow.id));
          }
        }
      }
    }
    return NextResponse.json({ received: true });
  }

  // Default: acknowledge receipt for any other event type
  return NextResponse.json({ received: true, ignored: event.type });
}
