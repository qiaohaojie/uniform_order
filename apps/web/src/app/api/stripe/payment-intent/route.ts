import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { and, eq, inArray } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";
import { getCatalogLineLookup, getTenant } from "@/db/queries";
import { getPrelovedSettings } from "@/db/preloved-queries";
import { catalogItems, db, pendingOrderSnapshots, prelovedSkus } from "@/db";
import type { PendingOrderLineSnapshot } from "@/db/schema";
import {
  assertTotalsMatch,
  prelovedPriceLookupKey,
  priceLookupKey,
  TotalsMismatchError,
  type LineInput,
} from "@/lib/order-totals";
import { requireSessionUser } from "@/lib/auth/authorization";
import { applyRateLimit } from "@/lib/rate-limit";

const PRELOVED_SKU_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asUuidOrNull(id: string): string | null {
  return PRELOVED_SKU_ID_RE.test(id) ? id : null;
}

type ClientOrderLine = {
  itemId: string;
  variantLabel: string;
  unitPrice: number;
  qty: number;
  size?: unknown;
  prelovedSkuId?: unknown;
};

type PrelovedLineLookup = {
  price: number;
  itemName: string;
  sourceItemId: string;
  size: string;
  condition: "good" | "fair";
  qtyOnHand: number;
};

function readPrelovedSkuId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function getPrelovedLineLookup(
  tenantId: string,
  skuIds: string[],
): Promise<Map<string, PrelovedLineLookup>> {
  const lookup = new Map<string, PrelovedLineLookup>();
  const queryIds = [...new Set(skuIds.filter((id) => PRELOVED_SKU_ID_RE.test(id)))];
  if (queryIds.length === 0) return lookup;

  const rows = await db
    .select({
      id: prelovedSkus.id,
      price: prelovedSkus.price,
      condition: prelovedSkus.condition,
      sourceItemId: prelovedSkus.sourceItemId,
      size: prelovedSkus.size,
      qtyOnHand: prelovedSkus.qtyOnHand,
      itemName: catalogItems.name,
    })
    .from(prelovedSkus)
    .innerJoin(catalogItems, eq(catalogItems.id, prelovedSkus.sourceItemId))
    .where(
      and(
        eq(prelovedSkus.tenantId, tenantId),
        eq(prelovedSkus.active, true),
        inArray(prelovedSkus.id, queryIds),
      ),
    );

  for (const row of rows) {
    lookup.set(row.id, {
      price: Number(row.price),
      itemName: row.itemName,
      sourceItemId: row.sourceItemId,
      size: row.size,
      condition: row.condition,
      qtyOnHand: row.qtyOnHand,
    });
  }
  return lookup;
}

// TODO(refunds): When a refund route is added (e.g. POST /api/stripe/refund),
// it MUST pass `reverse_transfer: true` (and usually `refund_application_fee: true`)
// to stripe.refunds.create(). Because we use destination charges below
// (transfer_data.destination = tenant.stripeAccountId), refunds are debited from
// the PLATFORM balance by default — without reverse_transfer the connected
// uniform shop keeps the parent's money and the platform absorbs the full loss.
// For chargebacks (which auto-debit the platform balance immediately), use
// stripe.transfers.createReversal() against the original transfer to claw back
// from the shop. See conversation in T-019dfac8-94cf-739f-80b2-d7a15c283cf5.

// POST /api/stripe/payment-intent
export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();

    // Require an authenticated session and rate-limit per user BEFORE any work:
    // this route mints PaymentIntents on the tenant's connected account, so anonymous
    // access would allow PI minting and tenant-readiness enumeration. The checkout page
    // already redirects unauthenticated users to sign-in, so authed parents are unaffected.
    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;
    const rl = applyRateLimit(req, `payment-intent:${authResult.user.id}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (rl) return rl;

    const body = await req.json();
    const { tenantId, amount, metadata, lines, delivery, subtotal, gst } = body;

    // Currency is server-pinned to AUD. The catalog prices, the totals
    // assertion, tenant payout reconciliation and order finalisation
    // (pi.amount / 100) all assume a two-decimal AUD charge. A client-supplied
    // currency (e.g. a zero-decimal "jpy") would corrupt the recorded total/GST
    // and silently charge in the wrong currency, so it is never trusted.
    const currency = "aud";

    if (!tenantId || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: "tenantId and amount required" },
        { status: 400 }
      );
    }

    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    if (!Array.isArray(lines) || typeof subtotal !== "number" || typeof gst !== "number") {
      return NextResponse.json({ error: "Missing totals payload" }, { status: 400 });
    }

    const tenant = await getTenant(tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    if (tenant.platformApprovalStatus !== "approved") {
      return NextResponse.json(
        { error: "Tenant not yet approved by platform" },
        { status: 409 }
      );
    }
    if (!tenant.stripeAccountId) {
      return NextResponse.json(
        { error: "Tenant has no connected Stripe account" },
        { status: 409 }
      );
    }
    if (tenant.stripeChargesEnabled !== true) {
      return NextResponse.json(
        { error: "Tenant Stripe account is not ready to accept charges" },
        { status: 409 }
      );
    }

    // Build catalog + preloved price lookup and assert server-authoritative totals.
    // Client `gstFree` is never trusted: new lines are taxable; preloved lines
    // inherit the tenant `donatedGstFree` flag at PI creation.
    const clientLines = lines as ClientOrderLine[];
    const prelovedSkuIds = clientLines
      .map((line) => readPrelovedSkuId(line.prelovedSkuId))
      .filter((id): id is string => id !== undefined);

    const catalogLookup = await getCatalogLineLookup(tenantId);
    const [prelovedSettings, prelovedLookup] =
      prelovedSkuIds.length > 0
        ? await Promise.all([
            getPrelovedSettings(tenantId),
            getPrelovedLineLookup(tenantId, prelovedSkuIds),
          ])
        : [null, new Map<string, PrelovedLineLookup>()];
    // Donate/intake/write-off 404 when the flag is off; leftover carts and
    // crafted prelovedSkuId must not still be priced or charged.
    if (prelovedSkuIds.length > 0 && !prelovedSettings?.prelovedEnabled) {
      return NextResponse.json(
        { error: "Preloved is not enabled" },
        { status: 404 },
      );
    }
    const donatedGstFree = prelovedSettings?.donatedGstFree === true;

    const priceLookup = new Map(
      Array.from(catalogLookup, ([key, value]) => [key, value.price]),
    );
    for (const [skuId, sku] of prelovedLookup) {
      priceLookup.set(prelovedPriceLookupKey(skuId), sku.price);
    }

    const pricedLines: LineInput[] = clientLines.map((line) => {
      const prelovedSkuId = readPrelovedSkuId(line.prelovedSkuId);
      const sku = prelovedSkuId ? prelovedLookup.get(prelovedSkuId) : undefined;
      return {
        itemId: line.itemId,
        variantLabel: line.variantLabel,
        unitPrice: line.unitPrice,
        qty: line.qty,
        prelovedSkuId,
        gstFree: sku !== undefined && donatedGstFree,
      };
    });

    let verified;
    try {
      verified = assertTotalsMatch({
        lines: pricedLines,
        delivery: delivery === "ship" ? "ship" : "pickup",
        received: { subtotal, gst, total: amountNumber },
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

    const qtyBySku = new Map<string, number>();
    for (const line of clientLines) {
      const prelovedSkuId = readPrelovedSkuId(line.prelovedSkuId);
      if (!prelovedSkuId) continue;
      qtyBySku.set(prelovedSkuId, (qtyBySku.get(prelovedSkuId) ?? 0) + line.qty);
    }
    for (const [skuId, qty] of qtyBySku) {
      const sku = prelovedLookup.get(skuId);
      if (!sku) continue;
      if (qty > sku.qtyOnHand) {
        return NextResponse.json({ error: "insufficient_qty" }, { status: 409 });
      }
    }

    const amountInCents = Math.round(verified.total * 100);
    const feeBps = Number(process.env.STRIPE_APPLICATION_FEE_BPS ?? 0);
    let applicationFeeAmount: number | undefined;
    if (Number.isFinite(feeBps) && feeBps > 0) {
      const fee = Math.floor((amountInCents * feeBps) / 10_000);
      if (fee > 0 && fee < amountInCents) {
        applicationFeeAmount = fee;
      }
    }

    // Pin fulfilmentMethod into the PaymentIntent at creation time so the
    // /api/orders writer can trust it as authoritative — preventing a client
    // from flipping pickup→shipping (or vice versa) after payment and skewing
    // the recorded subtotal/GST/shipping breakdown.
    const fulfilmentMethod = delivery === "ship" ? "shipping" : "pickup";

    // Spread client-supplied metadata FIRST so the server-authoritative keys
    // below always win. Otherwise a client could pass
    // metadata: { fulfilmentMethod: "shipping" } and override the pinned value
    // that /api/orders trusts as anti-tamper, recording a phantom shipping fee.
    const clientMetadata =
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, string>)
        : {};

    const intentParams: Stripe.PaymentIntentCreateParams = {
      amount: amountInCents,
      currency,
      metadata: {
        ...clientMetadata,
        tenantId,
        stripeAccountId: tenant.stripeAccountId,
        fulfilmentMethod,
        parentUserId: authResult.user.id,
      },
      automatic_payment_methods: { enabled: true },
      transfer_data: { destination: tenant.stripeAccountId },
      on_behalf_of: tenant.stripeAccountId,
      ...(applicationFeeAmount ? { application_fee_amount: applicationFeeAmount } : {}),
    };

    const paymentIntent = await stripe.paymentIntents.create(intentParams);

    // Persist the server-authoritative per-line snapshot, keyed by the
    // PaymentIntent. POST /api/orders reads this instead of trusting the client
    // `lines` it is handed after payment: the total is Stripe-locked, but
    // without a stored snapshot the per-line breakdown (which drives receipts,
    // partial-refund math, and GST-free preloved flags) could be reshuffled
    // by the client with the sum left intact. Prices/names come from the
    // catalog rows just validated by `assertTotalsMatch`, so they are exactly
    // what backed the charge — and, unlike a live re-read at order-POST time,
    // they cannot drift if an operator edits a price in between.
    //
    // Snapshot insert is required: if it fails we cancel the PI and return
    // 500. Swallowing the failure used to leave a payable clientSecret whose
    // order POST forced gstFree: false and inflated GST on mixed carts.
    //
    // `size` is a non-price-bearing display field with no catalog counterpart
    // for new lines, so it is carried through from the client as-is. Preloved
    // size/condition/itemName come from the SKU row that backed the charge.
    const lineSnapshot: PendingOrderLineSnapshot[] = clientLines.map((line) => {
      const prelovedSkuId = readPrelovedSkuId(line.prelovedSkuId);
      if (prelovedSkuId) {
        // Non-null: assertTotalsMatch already threw 'unknown_variant' otherwise.
        const sku = prelovedLookup.get(prelovedSkuId)!;
        return {
          itemId: sku.sourceItemId,
          itemName: sku.itemName,
          variantLabel: line.variantLabel,
          size: sku.size,
          qty: line.qty,
          unitPrice: sku.price,
          gstFree: donatedGstFree,
          prelovedSkuId,
          condition: sku.condition,
        };
      }
      // Non-null: assertTotalsMatch already threw 'unknown_variant' otherwise.
      const catalogLine = catalogLookup.get(
        priceLookupKey(line.itemId, line.variantLabel),
      )!;
      const size = typeof line.size === "string" ? line.size.trim() : "";
      return {
        itemId: line.itemId,
        itemName: catalogLine.itemName,
        variantLabel: line.variantLabel,
        size: size.length > 0 ? size : null,
        qty: line.qty,
        unitPrice: catalogLine.price,
        gstFree: false,
      };
    });

    try {
      // Stripe PaymentIntent ids are unique, so this insert cannot conflict.
      // Any thrown insert (constraint, connectivity, etc.) hits the cancel path.
      await db.insert(pendingOrderSnapshots).values({
        paymentIntentId: paymentIntent.id,
        tenantId,
        // Dev-login ids are `dev-<email>`, not uuids. The column is uuid + FK
        // to neon_auth.users; a non-uuid here 500s the PI after Stripe create.
        userId: asUuidOrNull(authResult.user.id),
        fulfilmentMethod,
        subtotal: String(verified.subtotal),
        gst: String(verified.gst),
        total: String(verified.total),
        linesJson: lineSnapshot,
      });
    } catch (err) {
      console.error(
        "Failed to persist pending order snapshot for",
        paymentIntent.id,
        err,
      );
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id, {
          cancellation_reason: "abandoned",
        });
      } catch (cancelErr) {
        console.error(
          "Failed to cancel PaymentIntent after snapshot failure",
          paymentIntent.id,
          cancelErr,
        );
      }
      return NextResponse.json(
        { error: "Failed to create payment intent" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("POST /api/stripe/payment-intent error:", err);
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
