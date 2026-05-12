import { NextRequest, NextResponse } from "next/server";
import { db, orders, orderLines, tenants } from "@/db";
import {
  getActiveCatalog,
  getOrdersByTenant,
  getOrdersByTenantAndParentEmail,
  getTenant,
} from "@/db/queries";
import { eq, inArray } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import {
  ensureParentEmailAccess,
  ensureTenantAccess,
  requireSessionUser,
} from "@/lib/auth/authorization";
import { applyRateLimit } from "@/lib/rate-limit";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { serverCapture, serverCaptureException } from "@/lib/analytics/server";
import { isUniqueConstraintError } from "@/lib/db/unique-constraint";
import {
  assertTotalsMatch,
  TotalsMismatchError,
  priceLookupKey,
  round2,
} from "@/lib/order-totals";

const ORDER_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const generateOrderSuffix = customAlphabet(ORDER_ID_ALPHABET, 10);

function createOrderId(prefix: string) {
  return `${prefix}-${generateOrderSuffix()}`;
}

// GET /api/orders?tenantId=nsbh&email=...
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

    if (searchParams.get("withLines") === "1") {
      // Only the "new" bucket needs lines (it's the batch-print picking queue).
      // Skipping historical statuses keeps the payload proportional to the
      // active queue rather than total order count.
      const newIds = rows.filter((r) => r.status === "new").map((r) => r.id);
      const lines = newIds.length > 0
        ? await db.select().from(orderLines).where(inArray(orderLines.orderId, newIds))
        : [];
      const linesByOrderId: Record<string, typeof lines> = {};
      for (const line of lines) {
        (linesByOrderId[line.orderId] ??= []).push(line);
      }
      return NextResponse.json(
        rows.map((r) => ({ ...r, lines: linesByOrderId[r.id] ?? [] })),
      );
    }

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
      parentNote,
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

    // Build catalog price lookup and assert server-authoritative totals.
    const catalog = await getActiveCatalog(tenantId);
    const priceLookup = new Map<string, number>();
    for (const item of catalog) {
      for (const v of item.variants) {
        priceLookup.set(priceLookupKey(item.id, v.label), v.price);
      }
    }

    let verifiedTotals;
    try {
      verifiedTotals = assertTotalsMatch({
        lines: lines as Array<{
          itemId: string;
          variantLabel: string;
          unitPrice: number;
          qty: number;
        }>,
        delivery: delivery === "ship" ? "ship" : "pickup",
        received: { subtotal, gst, total },
        priceLookup,
      });
    } catch (err) {
      if (err instanceof TotalsMismatchError) {
        return NextResponse.json(
          {
            error: "totals_mismatch",
            reason: err.reason,
            offendingKey: err.offendingKey,
            expected: err.expected,
            received: err.received,
          },
          { status: 400 },
        );
      }
      throw err;
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

    let normalizedParentNote: string | null = null;
    if (typeof parentNote === "string") {
      const trimmed = parentNote.trim();
      if (trimmed.length > 500) {
        return NextResponse.json(
          { error: "parentNote must be 500 characters or fewer" },
          { status: 400 }
        );
      }
      normalizedParentNote = trimmed.length > 0 ? trimmed : null;
    } else if (parentNote !== undefined && parentNote !== null) {
      return NextResponse.json(
        { error: "parentNote must be a string" },
        { status: 400 }
      );
    }

    const prefix = tenantId.toUpperCase();
    // Snapshot the policy version in force at order time (audit trail).
    // Read in the outer scope so insertOrder's closure captures it.
    const [tenantRow] = await db
      .select({ currentLegalVersionId: tenants.currentLegalVersionId })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const legalVersionId = tenantRow?.currentLegalVersionId ?? null;
    const insertOrder = async (orderId: string) => {
      // neon-http driver doesn't support interactive db.transaction; use db.batch
      // which runs all statements atomically in a single HTTP round-trip.
      const orderInsert = db.insert(orders).values({
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
        subtotal: String(verifiedTotals.subtotal),
        gst: String(verifiedTotals.gst),
        total: String(verifiedTotals.total),
        stripePaymentIntentId: normalizedStripePaymentIntentId,
        stripeRef: normalizedStripePaymentIntentId,
        refundPolicyAcceptedAt: new Date(),
        userId: authResult.user.id,
        parentNote: normalizedParentNote,
        legalVersionId,
      });
      const linesInsert = db.insert(orderLines).values(
        lines.map((line) => {
          // Guaranteed non-undefined: assertTotalsMatch above already threw on any
          // (itemId, variantLabel) pair missing from priceLookup. Defensive check
          // guards against future refactors that might break the invariant.
          const authoritativeUnitPrice = priceLookup.get(
            priceLookupKey(line.itemId, line.variantLabel),
          );
          if (authoritativeUnitPrice === undefined) {
            throw new Error(
              `variant missing from priceLookup after assertion: ${line.itemId}::${line.variantLabel}`,
            );
          }
          return {
            orderId,
            itemId: line.itemId,
            itemName: line.itemName,
            variantLabel: line.variantLabel,
            size: line.size?.trim() || null,
            qty: line.qty,
            unitPrice: String(authoritativeUnitPrice),
            lineTotal: String(round2(authoritativeUnitPrice * line.qty)),
          };
        })
      );
      await db.batch([orderInsert, linesInsert]);
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
