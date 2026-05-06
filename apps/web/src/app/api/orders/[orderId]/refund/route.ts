import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getTenant, addOrderRefund, getTotalRefunded, updateOrderStatus, money } from "@/db/queries";
import { getStripe } from "@/lib/stripe";
import {
  ensureTenantAccess,
  requireSessionUser,
} from "@/lib/auth/authorization";
import { applyRateLimit } from "@/lib/rate-limit";
import { serverCapture, serverCaptureException } from "@/lib/analytics/server";

const STRIPE_REASONS = new Set(["duplicate", "fraudulent", "requested_by_customer"]);

function toStripeReason(reason?: string): "duplicate" | "fraudulent" | "requested_by_customer" {
  if (reason && STRIPE_REASONS.has(reason)) {
    return reason as "duplicate" | "fraudulent" | "requested_by_customer";
  }
  return "requested_by_customer";
}

// POST /api/orders/[orderId]/refund
// Body: { amount: number, lineId?: string, reason?: string }
// Requires operator access to the tenant. Partial or full refund via Stripe.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  try {
    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body.amount !== "number" || body.amount <= 0) {
      return NextResponse.json(
        { error: "Refund amount must be a positive number" },
        { status: 400 }
      );
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const tenant = await getTenant(order.tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const tenantAccessResponse = ensureTenantAccess(
      authResult.user,
      tenant.shopEmail
    );
    if (tenantAccessResponse) return tenantAccessResponse;

    const rateLimitResponse = applyRateLimit(
      req,
      `refund:${order.tenantId}:${authResult.user.id}`,
      { limit: 10, windowMs: 60_000 }
    );
    if (rateLimitResponse) return rateLimitResponse;

    // Verify order is in a refundable state
    // partially_refunded is allowed so operators can issue further partial refunds
    if (order.status === "pending_payment" || order.status === "refunded") {
      return NextResponse.json(
        { error: `Order is ${order.status} and cannot be refunded` },
        { status: 409 }
      );
    }

    const orderTotal = money(order.total);
    const alreadyRefunded = await getTotalRefunded(orderId);
    const remaining = money(orderTotal - alreadyRefunded);

    if (money(body.amount) > remaining) {
      return NextResponse.json(
        { error: `Refund amount exceeds remaining balance ($${remaining.toFixed(2)})` },
        { status: 400 }
      );
    }

    // Stripe refund
    if (!order.stripePaymentIntentId) {
      return NextResponse.json(
        { error: "Order has no associated Stripe payment" },
        { status: 409 }
      );
    }

    const stripe = getStripe();
    const amountCents = Math.round(money(body.amount) * 100);
    const idemKey = `refund:${orderId}:${body.lineId ?? ""}:${amountCents}`;

    const refund = await stripe.refunds.create(
      {
        payment_intent: order.stripePaymentIntentId,
        amount: amountCents,
        ...(tenant.stripeAccountId ? { reverse_transfer: true, refund_application_fee: true } : {}),
        reason: toStripeReason(body.reason),
        metadata: {
          orderId,
          tenantId: order.tenantId,
          lineId: body.lineId ?? "",
          reason: body.reason ?? "",
        },
      },
      { idempotencyKey: idemKey }
    );

    // Record refund in DB. The customer has already been refunded by Stripe at
    // this point, so any DB failure here must NOT bubble up as a 500 — the
    // operator would think the refund failed and retry, but the retry would
    // succeed via Stripe idempotency without creating a real second refund.
    // Instead, return success with reconcilePending so the UI can flag the row
    // as needing reconciliation (the charge.refunded webhook will eventually
    // insert it).
    let dbRecorded = true;
    let reconcilePending = false;
    try {
      await addOrderRefund({
        orderId,
        lineId: body.lineId,
        amount: money(body.amount),
        reason: body.reason,
        operatorUserId: authResult.user.id,
        stripeRefundId: refund.id,
      });
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      // PostgreSQL unique-violation code is 23505 — already recorded, fine
      if (msg.includes("23505") || msg.includes("unique constraint")) {
        console.info("Refund already recorded in DB for stripe refund", refund.id);
      } else {
        dbRecorded = false;
        reconcilePending = true;
        console.error("Refund succeeded in Stripe but DB insert failed", refund.id, dbErr);
        await serverCaptureException(
          "api-refund-db-insert",
          dbErr instanceof Error ? dbErr : new Error(String(dbErr)),
          { orderId, stripeRefundId: refund.id }
        );
      }
    }

    // Recompute total refunded from DB to avoid read-modify-write races.
    // If the DB insert above failed, the new amount won't be reflected until
    // the webhook reconciles it — skip the status update in that case.
    let newStatus: "refunded" | "partially_refunded" = "partially_refunded";
    if (dbRecorded) {
      const newTotalRefunded = await getTotalRefunded(orderId);
      newStatus = money(newTotalRefunded) >= money(orderTotal) ? "refunded" : "partially_refunded";
      if (newStatus !== order.status) {
        await updateOrderStatus(orderId, newStatus);
      }
    }

    await serverCapture(authResult.user.id, "refund_issued", {
      order_id: orderId,
      tenant_id: order.tenantId,
      refund_id: refund.id,
      amount: money(body.amount),
      reason: body.reason,
      new_status: newStatus,
      reconcile_pending: reconcilePending,
    });

    return NextResponse.json({
      ok: true,
      refundId: refund.id,
      amount: money(body.amount),
      newStatus,
      reconcilePending,
    });
  } catch (err) {
    console.error("POST /api/orders/[orderId]/refund error:", err);
    await serverCaptureException("api-refund-post", err instanceof Error ? err : new Error(String(err)), { method: "POST", orderId });
    return NextResponse.json(
      { error: "Failed to process refund" },
      { status: 500 }
    );
  }
}
