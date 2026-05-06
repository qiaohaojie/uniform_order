import { NextRequest, NextResponse } from "next/server";
import { db, orders, orderLines } from "@/db";
import {
  getOrdersByTenant,
  getOrdersByTenantAndParentEmail,
  getTenant,
} from "@/db/queries";
import { eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import {
  ensureParentEmailAccess,
  ensureTenantAccess,
  requireSessionUser,
} from "@/lib/auth/authorization";
import { applyRateLimit } from "@/lib/rate-limit";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { serverCapture, serverCaptureException } from "@/lib/analytics/server";

const ORDER_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const generateOrderSuffix = customAlphabet(ORDER_ID_ALPHABET, 10);

function createOrderId(prefix: string) {
  return `${prefix}-${generateOrderSuffix()}`;
}

function isUniqueConstraintError(error: unknown, constraintName?: string) {
  const pgError = error as { code?: string; constraint?: string };
  if (pgError?.code !== "23505") return false;
  if (!constraintName) return true;
  return pgError.constraint === constraintName;
}

// GET /api/orders?tenantId=imhs&email=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const email = searchParams.get("email");

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  try {
    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

    const tenant = await getTenant(tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const normalizedEmail = email?.trim().toLowerCase();

    if (normalizedEmail) {
      const parentEmailAccess = ensureParentEmailAccess(authResult.user, normalizedEmail);
      if (parentEmailAccess) return parentEmailAccess;

      const rateLimitResponse = applyRateLimit(req, `orders:parent:${tenantId}:${authResult.user.id}`, {
        limit: 45,
        windowMs: 60_000,
      });
      if (rateLimitResponse) return rateLimitResponse;

      const rows = await getOrdersByTenantAndParentEmail(tenantId, normalizedEmail);
      return NextResponse.json(rows);
    }

    const tenantAccessResponse = ensureTenantAccess(authResult.user, tenant.shopEmail);
    if (tenantAccessResponse) return tenantAccessResponse;

    const rateLimitResponse = applyRateLimit(req, `orders:tenant:${tenantId}:${authResult.user.id}`, {
      limit: 120,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const rows = await getOrdersByTenant(tenantId);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/orders error:", err);
    await serverCaptureException("api-orders-get", err instanceof Error ? err : new Error(String(err)), { method: "GET", tenantId });
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

// POST /api/orders — place a new order
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

    const createRateLimitResponse = applyRateLimit(req, `orders:create:${authResult.user.id}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (createRateLimitResponse) return createRateLimitResponse;

    const body = await req.json();
    const {
      tenantId,
      parentName,
      parentEmail,
      parentMobile,
      studentName,
      studentYear,
      studentRoll,
      delivery,
      deliveryFee,
      subtotal,
      gst,
      total,
      stripePaymentIntentId,
      refundPolicyAccepted,
      lines,
    } = body;

    const normalizedStripePaymentIntentId =
      typeof stripePaymentIntentId === "string" ? stripePaymentIntentId.trim() : "";

    if (
      !tenantId ||
      !parentName ||
      !parentEmail ||
      !parentMobile ||
      !studentName ||
      !studentYear ||
      !studentRoll ||
      typeof subtotal !== "number" ||
      typeof gst !== "number" ||
      typeof total !== "number" ||
      !normalizedStripePaymentIntentId ||
      refundPolicyAccepted !== true ||
      !Array.isArray(lines) ||
      lines.length === 0
    ) {
      return NextResponse.json({ error: "Missing required order fields" }, { status: 400 });
    }

    const normalizedParentEmail = parentEmail.trim().toLowerCase();
    if (normalizedParentEmail !== authResult.user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [existingOrder] = await db
      .select({ id: orders.id, userId: orders.userId })
      .from(orders)
      .where(eq(orders.stripePaymentIntentId, normalizedStripePaymentIntentId))
      .limit(1);

    if (existingOrder) {
      if (existingOrder.userId && existingOrder.userId !== authResult.user.id) {
        return NextResponse.json({ error: "Payment intent already used" }, { status: 409 });
      }
      return NextResponse.json(
        { orderId: existingOrder.id, idempotent: true },
        { status: 200 }
      );
    }

    const prefix = tenantId.toUpperCase();
    const insertOrder = async (orderId: string) => {
      await db.transaction(async (tx) => {
        await tx.insert(orders).values({
          id: orderId,
          tenantId,
          parentName,
          parentEmail: normalizedParentEmail,
          parentMobile,
          studentName,
          studentYear,
          studentRoll,
          delivery: delivery ?? "pickup",
          deliveryFee: String(deliveryFee ?? 0),
          subtotal: String(subtotal),
          gst: String(gst),
          total: String(total),
          stripePaymentIntentId: normalizedStripePaymentIntentId,
          stripeRef: normalizedStripePaymentIntentId,
          refundPolicyAcceptedAt: new Date(),
          userId: authResult.user.id,
        });

        for (const line of lines) {
          await tx.insert(orderLines).values({
            orderId,
            itemId: line.itemId,
            itemName: line.itemName,
            variantLabel: line.variantLabel,
            size: line.size ?? null,
            qty: line.qty,
            unitPrice: String(line.unitPrice),
            lineTotal: String(line.lineTotal),
          });
        }
      });
    };

    let createdOrderId: string | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidateOrderId = createOrderId(prefix);
      try {
        await insertOrder(candidateOrderId);
        createdOrderId = candidateOrderId;
        break;
      } catch (error) {
        if (isUniqueConstraintError(error, "orders_pkey")) {
          if (attempt > 0) {
            console.warn(`Order ID collision on attempt ${attempt + 1}, retrying...`);
          }
          continue;
        }

        if (isUniqueConstraintError(error)) {
          const [duplicateOrder] = await db
            .select({ id: orders.id, userId: orders.userId })
            .from(orders)
            .where(eq(orders.stripePaymentIntentId, normalizedStripePaymentIntentId))
            .limit(1);

          if (duplicateOrder) {
            if (duplicateOrder.userId && duplicateOrder.userId !== authResult.user.id) {
              return NextResponse.json({ error: "Payment intent already used" }, { status: 409 });
            }
            return NextResponse.json(
              { orderId: duplicateOrder.id, idempotent: true },
              { status: 200 }
            );
          }
        }

        throw error;
      }
    }

    if (!createdOrderId) {
      throw new Error("Unable to generate a unique order ID");
    }

    await serverCapture(authResult.user.id, "order_placed", {
      order_id: createdOrderId,
      tenant_id: tenantId,
      delivery: delivery ?? "pickup",
      total,
      subtotal,
      item_count: lines.length,
      $set: { email: normalizedParentEmail },
    });

    // Send order confirmation email (best-effort; do not fail the request)
    try {
      await sendOrderConfirmationEmail(createdOrderId);
    } catch (err) {
      console.error("Order confirmation email failed for order", createdOrderId, err);
    }

    return NextResponse.json({ orderId: createdOrderId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/orders error:", err);
    await serverCaptureException("api-orders-post", err instanceof Error ? err : new Error(String(err)), { method: "POST" });
    return NextResponse.json({ error: "Failed to place order" }, { status: 500 });
  }
}
