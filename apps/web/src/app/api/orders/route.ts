import { NextRequest, NextResponse } from "next/server";
import { db, orders, orderLines, tenants } from "@/db";
import {
  getCatalogPriceLookup,
  getOrdersByTenant,
  getOrdersByTenantAndParentEmail,
  getTenant,
  getTenantSettings,
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
import { priceLookupKey, round2 } from "@/lib/order-totals";
import { SHIP_FEE_AUD } from "@/lib/shipping";
import { getStripe } from "@/lib/stripe";

const ORDER_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const generateOrderSuffix = customAlphabet(ORDER_ID_ALPHABET, 10);

function createOrderId(prefix: string) {
  return `${prefix}-${generateOrderSuffix()}`;
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

    if (searchParams.get("withLines") === "1") {
      // Only the "new" bucket needs lines (it's the batch-print picking queue).
      // Skipping historical statuses keeps the payload proportional to the
      // active queue rather than total order count.
      const newIds = rows
        .filter((r) => r.fulfilmentStatus === "to_prepare")
        .map((r) => r.id);
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
      fulfilmentMethod: bodyFulfilmentMethod,
      subtotal,
      gst,
      total,
      stripePaymentIntentId,
      refundPolicyAccepted,
      parentNote,
      lines,
    } = body;

    // Accept either the new fulfilmentMethod enum or the legacy delivery field.
    const fulfilmentMethod: "pickup" | "shipping" =
      bodyFulfilmentMethod === "shipping" || delivery === "ship"
        ? "shipping"
        : "pickup";

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

    const tenantSettings = await getTenantSettings(tenantId);
    if (fulfilmentMethod === "shipping" && !tenantSettings.shippingEnabled) {
      return NextResponse.json(
        { error: "Shipping is not enabled for this school" },
        { status: 400 },
      );
    }
    if (fulfilmentMethod === "pickup" && !tenantSettings.pickupEnabled) {
      return NextResponse.json(
        { error: "Pickup is not enabled for this school" },
        { status: 400 },
      );
    }

    // ─── Server-authoritative totals (post-payment) ───────────────────────
    //
    // Payment has already been authorised by /api/stripe/payment-intent, which
    // ran the catalog-price assertion at PI-creation time and seeded
    // paymentIntents.create({ amount }) with the server-computed total. Stripe
    // has now charged that amount.
    //
    // Re-running the catalog assertion here would introduce a paid-without-order
    // failure mode: if an operator deactivates a variant or changes a price
    // between PI creation and order finalisation, the assertion rejects with
    // `totals_mismatch`, but the customer has already been charged. The
    // recoverable path is to trust the PaymentIntent's `amount` as the
    // authoritative total and derive the rest server-side.
    //
    // Structural validation (qty, unitPrice types) stays — we still want to
    // refuse garbage payloads. Per-line unitPrice falls back to the client
    // value when the catalog has shifted; this is fine because the total is
    // bounded by what Stripe actually charged.
    const piTypeError = (() => {
      if (!Array.isArray(lines) || lines.length === 0) return "lines_invalid";
      for (const l of lines) {
        if (!Number.isInteger(l.qty) || l.qty <= 0) return "invalid_qty";
        if (typeof l.unitPrice !== "number" || !Number.isFinite(l.unitPrice))
          return "invalid_unit_price";
      }
      return null;
    })();
    if (piTypeError) {
      return NextResponse.json(
        { error: "totals_mismatch", reason: piTypeError },
        { status: 400 },
      );
    }

    // Idempotency check runs before the Stripe API round-trip so retries
    // (double-clicks, network flakes) short-circuit at the DB lookup instead
    // of incurring an unnecessary paymentIntents.retrieve.
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

    // Retrieve the PaymentIntent for authoritative total + status check.
    let stripePI;
    try {
      stripePI = await getStripe().paymentIntents.retrieve(
        normalizedStripePaymentIntentId,
      );
    } catch {
      return NextResponse.json(
        { error: "stripe_pi_not_found" },
        { status: 400 },
      );
    }

    // Refuse to write an order row unless the PI is in a terminal-success
    // state. Without this, a client could submit a clientSecret while the PI
    // is still `requires_confirmation` / `requires_action` / `processing` and
    // slip an order row through ahead of (or instead of) a successful charge.
    if (stripePI.status !== "succeeded") {
      return NextResponse.json(
        { error: "stripe_pi_not_succeeded", status: stripePI.status },
        { status: 400 },
      );
    }

    // The PaymentIntent was created with fulfilmentMethod stamped in metadata.
    // That's the only fulfilment value we trust here — otherwise a client
    // could pay for a pickup order ($0 shipping) and then post the order with
    // fulfilmentMethod='shipping', causing us to record subtotal = total - $9.50
    // (a synthetic discount in the persisted breakdown).
    const piFulfilmentMethod = stripePI.metadata?.fulfilmentMethod;
    if (piFulfilmentMethod !== "pickup" && piFulfilmentMethod !== "shipping") {
      return NextResponse.json(
        { error: "stripe_pi_missing_fulfilment_method" },
        { status: 400 },
      );
    }
    if (piFulfilmentMethod !== fulfilmentMethod) {
      return NextResponse.json(
        {
          error: "fulfilment_method_mismatch",
          expected: piFulfilmentMethod,
          received: fulfilmentMethod,
        },
        { status: 400 },
      );
    }

    const authoritativeTotal = stripePI.amount / 100;
    if (Math.abs(total - authoritativeTotal) > 0.01) {
      return NextResponse.json(
        {
          error: "totals_mismatch",
          reason: "client_total_drift",
          expected: { total: authoritativeTotal },
          received: { total },
        },
        { status: 400 },
      );
    }
    const shipping = fulfilmentMethod === "shipping" ? SHIP_FEE_AUD : 0;
    const verifiedTotals = {
      subtotal: round2(authoritativeTotal - shipping),
      shipping,
      gst: round2(authoritativeTotal / 11),
      total: round2(authoritativeTotal),
    };

    // Per-line price snapshot: prefer the live catalog when the variant still
    // exists (keeps receipts in sync with the shop), fall back to the client
    // value otherwise. Either way the total is locked by Stripe above.
    const priceLookup = await getCatalogPriceLookup(tenantId);

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
        fulfilmentMethod,
        deliveryFee: String(verifiedTotals.shipping),
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
          // Prefer the live catalog price; fall back to the client value if
          // the variant has been deactivated/renamed since PI creation. Total
          // is locked by Stripe in the assertion above, so client-supplied
          // unitPrice can't be used to under-pay the order.
          const catalogPrice = priceLookup.get(
            priceLookupKey(line.itemId, line.variantLabel),
          );
          const unitPrice = catalogPrice ?? line.unitPrice;
          return {
            orderId,
            itemId: line.itemId,
            itemName: line.itemName,
            variantLabel: line.variantLabel,
            size: line.size?.trim() || null,
            qty: line.qty,
            unitPrice: String(unitPrice),
            lineTotal: String(round2(unitPrice * line.qty)),
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
      delivery: fulfilmentMethod === "shipping" ? "ship" : "pickup",
      fulfilment_method: fulfilmentMethod,
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
