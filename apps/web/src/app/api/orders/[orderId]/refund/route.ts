import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getTenant, addOrderRefund, getTotalRefunded, updateOrderStatus } from "@/db/queries";
import { getStripe } from "@/lib/stripe";
import {
  ensureTenantAccess,
  requireSessionUser,
} from "@/lib/auth/authorization";
import { applyRateLimit } from "@/lib/rate-limit";
import { serverCaptureException } from "@/lib/analytics/server";

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
    if (
      order.status === "pending_payment" ||
      order.status === "refunded"
    ) {
      return NextResponse.json(
        { error: `Order is ${order.status} and cannot be refunded` },
        { status: 409 }
      );
    }

    const orderTotal = parseFloat(order.total);
    const alreadyRefunded = await getTotalRefunded(orderId);
    const remaining = Math.round((orderTotal - alreadyRefunded) * 100) / 100;

    if (body.amount > remaining + 0.01) {
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
    const refund = await stripe.refunds.create({
      payment_intent: order.stripePaymentIntentId,
      amount: Math.round(body.amount * 100),
      reverse_transfer: true,
      refund_application_fee: true,
      reason: "requested_by_customer",
      metadata: {
        orderId,
        tenantId: order.tenantId,
        lineId: body.lineId ?? "",
        reason: body.reason ?? "",
      },
    });

    // Record refund in DB
    await addOrderRefund({
      orderId,
      lineId: body.lineId,
      amount: body.amount,
      reason: body.reason,
      operatorUserId: authResult.user.id,
      stripeRefundId: refund.id,
    });

    // Update order status if fully refunded
    const newTotalRefunded = alreadyRefunded + body.amount;
    const newStatus =
      newTotalRefunded >= orderTotal - 0.01 ? "refunded" : "partially_refunded";
    if (newStatus !== order.status) {
      await updateOrderStatus(orderId, newStatus);
    }

    return NextResponse.json({
      ok: true,
      refundId: refund.id,
      amount: body.amount,
      newStatus,
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
