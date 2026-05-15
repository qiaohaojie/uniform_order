import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getTenant } from "@/db/queries";
import {
  ensureParentEmailAccess,
  ensureTenantAccess,
  requireSessionUser,
} from "@/lib/auth/authorization";
import { applyRateLimit } from "@/lib/rate-limit";
import { serverCaptureException } from "@/lib/analytics/server";

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

