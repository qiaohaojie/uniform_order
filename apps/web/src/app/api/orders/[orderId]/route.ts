import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getTenant, updateOrderStatus } from "@/db/queries";
import { db, orders } from "@/db";
import { and, eq, ne } from "drizzle-orm";
import { sendOrderReadyEmail } from "@/lib/email";
import {
  ensureParentEmailAccess,
  ensureTenantAccess,
  isPlatformAdminEmail,
  requireSessionUser,
} from "@/lib/auth/authorization";
import { applyRateLimit } from "@/lib/rate-limit";
import { serverCaptureException } from "@/lib/analytics/server";
import { logAuditEvent } from "@/lib/audit/log";

const ORDER_STATUSES = ["pending_payment", "new", "packing", "ready", "collected"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

function isOrderStatus(status: unknown): status is OrderStatus {
  return typeof status === "string" && ORDER_STATUSES.includes(status as OrderStatus);
}

// GET /api/orders/:orderId
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const tenantId = new URL(req.url).searchParams.get("tenantId");
  try {
    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

    const order = await getOrderById(orderId);
    if (!order || (tenantId && order.tenantId !== tenantId)) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const tenant = await getTenant(order.tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const tenantAccessResponse = ensureTenantAccess(authResult.user, tenant.shopEmail);
    if (tenantAccessResponse) {
      const parentEmailDenial = ensureParentEmailAccess(authResult.user, order.parentEmail);
      if (parentEmailDenial) return parentEmailDenial;

      const rateLimitResponse = applyRateLimit(req, `order-detail:${order.tenantId}:${authResult.user.id}`, {
        limit: 30,
        windowMs: 60_000,
      });
      if (rateLimitResponse) return rateLimitResponse;
    }

    return NextResponse.json(order);
  } catch (err) {
    console.error("GET /api/orders/[orderId] error:", err);
    await serverCaptureException("api-order-detail-get", err instanceof Error ? err : new Error(String(err)), { method: "GET", orderId });
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

// PATCH /api/orders/:orderId — update status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  try {
    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

    const { status, tenantId } = await req.json();
    if (!isOrderStatus(status) || status === "pending_payment") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const order = await getOrderById(orderId);
    if (!order || (tenantId && order.tenantId !== tenantId)) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const tenant = await getTenant(order.tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    const tenantAccessResponse = ensureTenantAccess(authResult.user, tenant.shopEmail);
    if (tenantAccessResponse) return tenantAccessResponse;

    if (status === "ready") {
      const previousStatus = order.status;
      const flipped = await db
        .update(orders)
        .set({ status: "ready", updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), ne(orders.status, "ready")))
        .returning({ id: orders.id });

      if (flipped.length === 1) {
        await logAuditEvent({
          tenantId: order.tenantId,
          actorEmail: authResult.user.email,
          actorRole: isPlatformAdminEmail(authResult.user.email)
            ? "platform_admin"
            : "operator",
          action: "order.marked_ready",
          targetType: "order",
          targetId: orderId,
          payload: { previousStatus },
        });

        try {
          await sendOrderReadyEmail(orderId);
        } catch (err) {
          console.error("Ready email failed for order", orderId, err);
          // Do not fail the PATCH — admin update succeeded, email is best-effort
        }
      }
      return NextResponse.json({ ok: true });
    }

    const updated = await updateOrderStatus(orderId, status);
    if (updated.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/orders/[orderId] error:", err);
    await serverCaptureException("api-order-detail-patch", err instanceof Error ? err : new Error(String(err)), { method: "PATCH", orderId });
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
