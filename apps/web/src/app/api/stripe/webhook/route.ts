import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, tenants, orderRefunds, auditEvents, orderEvents } from "@/db/schema";
import { sendOrderConfirmationEmail, sendOrderRefundEmail } from "@/lib/email";

function formatAud(amount: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount);
}
import { serverCapture, serverCaptureException } from "@/lib/analytics/server";
import { getStripe } from "@/lib/stripe";
import { revalidateTag } from "next/cache";
import { tenantBillingTag } from "@/lib/platform/stripe-billing";
import { logAuditEvent } from "@/lib/audit/log";

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

    // Atomic transition: only flip payment_status from 'pending' to 'paid'.
    const flipped = await db
      .update(orders)
      .set({ paymentStatus: "paid", updatedAt: new Date() })
      .where(and(eq(orders.stripePaymentIntentId, pi.id), eq(orders.paymentStatus, "pending")))
      .returning({ id: orders.id, tenantId: orders.tenantId });

    if (flipped.length === 1) {
      await db.insert(orderEvents).values({
        orderId: flipped[0].id,
        tenantId: flipped[0].tenantId,
        eventType: "order_paid",
        metadataJson: { paymentIntentId: pi.id },
      });
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
      console.info("stripe webhook: no pending-payment order matched", pi.id);
    }

    return NextResponse.json({ received: true });
  }

  // ─── payment_intent.payment_failed ────────────────────────────────────────
  // No order row exists at this point — /api/orders inserts only after
  // confirmPayment succeeds. We log the failure to audit_events targeted at
  // the PaymentIntent itself, so per-tenant audit views can surface declined
  // attempts alongside successful events.
  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const piTenantId = typeof pi.metadata?.tenantId === "string" ? pi.metadata.tenantId : null;
    const piParentEmail = typeof pi.metadata?.parentEmail === "string"
      ? pi.metadata.parentEmail
      : "stripe-webhook";
    // Idempotency: Stripe redelivers on non-2xx and occasional 2xx network glitches.
    // Stamp event.id into the payload and short-circuit if we've already logged it.
    const existing = await db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.action, "payment_intent.payment_failed"),
          eq(auditEvents.targetId, pi.id),
          sql`${auditEvents.payload}->>'eventId' = ${event.id}`,
        ),
      )
      .limit(1);
    if (existing.length === 0) {
      await logAuditEvent({
        tenantId: piTenantId,
        actorEmail: piParentEmail,
        actorRole: "system",
        action: "payment_intent.payment_failed",
        targetType: "payment_intent",
        targetId: pi.id,
        payload: {
          eventId: event.id,
          amount: pi.amount ? pi.amount / 100 : null,
          currency: pi.currency,
          lastPaymentError: pi.last_payment_error?.message ?? null,
          declineCode: pi.last_payment_error?.decline_code ?? null,
        },
      });
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
        .select({
          id: orders.id,
          total: orders.total,
          paymentStatus: orders.paymentStatus,
          tenantId: orders.tenantId,
          parentName: orders.parentName,
          parentEmail: orders.parentEmail,
        })
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

        // Look up tenant name for the refund email (best-effort).
        const [tenantRow] = await db
          .select({ name: tenants.name })
          .from(tenants)
          .where(eq(tenants.id, orderRow.tenantId))
          .limit(1);

        // Compute totals from the webhook payload (authoritative for Stripe state).
        const newRefundedCents = refunds.reduce((s, r) => s + (r.amount ?? 0), 0);
        const orderTotalCents = Math.round(money(orderRow.total) * 100);
        const newPaymentStatus =
          newRefundedCents >= orderTotalCents ? "refunded" : "partially_refunded";
        const isFullRefund = newPaymentStatus === "refunded";

        if (
          newPaymentStatus !== orderRow.paymentStatus ||
          newRefundedCents > 0
        ) {
          await db
            .update(orders)
            .set({
              paymentStatus: newPaymentStatus,
              refundedAmountCents: newRefundedCents,
              updatedAt: new Date(),
            })
            .where(eq(orders.id, orderRow.id));
        }

        // Email parent (idempotent on stripe_refund_id). Only audit when actually sent —
        // webhook replays would otherwise create duplicate refund_email_sent rows.
        if (tenantRow) {
          for (const refund of refunds) {
            if (!refund.id) continue;
            try {
              const result = await sendOrderRefundEmail({
                orderId: orderRow.id,
                tenantId: orderRow.tenantId,
                tenantName: tenantRow.name,
                parentName: orderRow.parentName,
                parentEmail: orderRow.parentEmail,
                stripeRefundId: refund.id,
                amountAud: formatAud((refund.amount ?? 0) / 100),
                isFullRefund,
                triggeredBy: "webhook",
                triggeredByUserId: null,
              });
              if (result.status === "sent") {
                await db.insert(orderEvents).values({
                  orderId: orderRow.id,
                  tenantId: orderRow.tenantId,
                  eventType: "refund_email_sent",
                  metadataJson: {
                    source: "webhook",
                    chargeId: charge.id,
                    stripeRefundId: refund.id,
                  },
                });
              }
            } catch (emailErr) {
              console.error("Refund email failed for webhook refund", refund.id, emailErr);
            }
          }
        }

        const totalRefundedCents = refunds.reduce(
          (sum, r) => sum + (r.amount ?? 0),
          0,
        );
        // Idempotency: skip if we've already logged this Stripe event.
        const existingRefundAudit = await db
          .select({ id: auditEvents.id })
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.action, "order.refunded.via_dashboard"),
              eq(auditEvents.targetId, orderRow.id),
              sql`${auditEvents.payload}->>'eventId' = ${event.id}`,
            ),
          )
          .limit(1);
        if (existingRefundAudit.length === 0) {
          await logAuditEvent({
            tenantId: orderRow.tenantId,
            actorEmail: "stripe-webhook",
            actorRole: "system",
            action: "order.refunded.via_dashboard",
            targetType: "order",
            targetId: orderRow.id,
            payload: {
              eventId: event.id,
              chargeId: charge.id,
              amountRefundedCents: totalRefundedCents,
              fullyRefunded: charge.refunded ?? false,
            },
          });
        }
      }
    }
    return NextResponse.json({ received: true });
  }

  // Default: acknowledge receipt for any other event type
  return NextResponse.json({ received: true, ignored: event.type });
}
