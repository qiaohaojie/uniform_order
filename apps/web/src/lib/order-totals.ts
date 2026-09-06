import { SHIP_FEE_AUD } from "./shipping";

export type LineInput = {
  itemId: string;
  variantLabel: string;
  unitPrice: number; // AUD dollars (e.g. 19.95) — client-claimed, validated against catalog / preloved SKU
  qty: number; // positive integer
  /** Server-authored. Client gstFree is ignored at the PaymentIntent boundary. */
  gstFree?: boolean;
  /** When set, price lookup uses `preloved:<skuId>` instead of itemId::variantLabel. */
  prelovedSkuId?: string | null;
};

export type ComputedTotals = {
  subtotal: number; // AUD dollars, 2dp
  shipping: number; // AUD dollars, 2dp — SHIP_FEE_AUD when delivery=ship, 0 otherwise
  gst: number; // AUD dollars, 2dp — 1/11 of GST-inclusive taxable base
  total: number; // AUD dollars, 2dp — subtotal + shipping
};

export type DeliveryMode = "pickup" | "ship";

export type MismatchReason =
  | "total_mismatch"
  | "price_mismatch"
  | "unknown_variant"
  | "invalid_qty";

// Round to 2dp using half-away-from-zero (Math.round behaviour).
// Matches the toFixed(2) display rounding used elsewhere.
// Exported so /api/orders can use the same rounding for lineTotal in Task 5.
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build the price lookup key for a (itemId, variantLabel) pair.
 * Used in both the API routes and the helper to ensure consistent keying.
 */
export function priceLookupKey(itemId: string, variantLabel: string): string {
  return `${itemId}::${variantLabel}`;
}

/** Price lookup key for a preloved SKU. Not the source catalog itemId::variantLabel. */
export function prelovedPriceLookupKey(skuId: string): string {
  return `preloved:${skuId}`;
}

/**
 * Resolve the price lookup key for a line. Preloved SKU id wins when present
 * so mixed carts cannot be priced off the matching new-item variant.
 */
export function linePriceLookupKey(line: {
  itemId: string;
  variantLabel: string;
  prelovedSkuId?: string | null;
}): string {
  const skuId =
    typeof line.prelovedSkuId === "string" ? line.prelovedSkuId.trim() : "";
  if (skuId.length > 0) return prelovedPriceLookupKey(skuId);
  return priceLookupKey(line.itemId, line.variantLabel);
}

/**
 * Compute order totals in AUD dollars.
 *
 * GST model: 1/11 of the **GST-inclusive taxable base** — the sum of lines
 * that are not `gstFree`, plus shipping. GST-free donated preloved lines still
 * add to subtotal and total; they are excluded from the 1/11 base. Shipping is
 * always GST-applicable (AU domestic delivery by a GST-registered business).
 *
 * Lines without `gstFree` stay all-taxable: gst = round2((subtotal + shipping) / 11),
 * same as the historical whole-order 1/11 formula.
 *
 * Admin reports aggregate persisted `order.gst` (and split GST-free preloved
 * sales from line flags) rather than calling this helper.
 *
 * If shipping is ever moved to GST-free, drop it from the taxable base and
 * audit historical Reports rows before deploying.
 */
export function computeTotals(args: {
  lines: { unitPrice: number; qty: number; gstFree?: boolean }[];
  delivery: DeliveryMode;
}): ComputedTotals {
  const subtotal = round2(
    args.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),
  );
  const taxableSubtotal = round2(
    args.lines.reduce(
      (sum, l) => (l.gstFree === true ? sum : sum + l.unitPrice * l.qty),
      0,
    ),
  );
  const shipping = args.delivery === "ship" ? SHIP_FEE_AUD : 0;
  const total = round2(subtotal + shipping);
  const gst = round2((taxableSubtotal + shipping) / 11);
  return { subtotal, shipping, gst, total };
}

export class TotalsMismatchError extends Error {
  constructor(
    readonly expected: ComputedTotals,
    readonly received: { subtotal: number; gst: number; total: number },
    readonly reason: MismatchReason,
    readonly offendingKey?: string,
  ) {
    super(reason);
  }
}

/**
 * Assert that client-supplied totals match server-authoritative prices.
 *
 * 1. Looks up each line in priceLookup — catalog `itemId::variantLabel`, or
 *    `preloved:<skuId>` when `prelovedSkuId` is set. Throws 'unknown_variant'
 *    if missing.
 * 2. Compares client unitPrice against the looked-up price (tolerance 1¢) —
 *    throws 'price_mismatch'.
 * 3. Recomputes totals from those prices, passing `gstFree` through to
 *    computeTotals — throws 'total_mismatch' on drift > 1¢.
 *
 * Returns ComputedTotals computed from server-authoritative prices.
 * Callers must supply server-authored `gstFree`; do not forward a client flag.
 */
export function assertTotalsMatch(args: {
  lines: LineInput[];
  delivery: DeliveryMode;
  received: { subtotal: number; gst: number; total: number };
  priceLookup: Map<string, number>;
}): ComputedTotals {
  const PRICE_TOLERANCE = 0.01;
  const TOTAL_TOLERANCE = 0.01;

  const serverLines: { unitPrice: number; qty: number; gstFree: boolean }[] = [];
  for (const l of args.lines) {
    const key = linePriceLookupKey(l);
    if (!Number.isInteger(l.qty) || l.qty <= 0) {
      throw new TotalsMismatchError(
        { subtotal: 0, shipping: 0, gst: 0, total: 0 },
        args.received,
        "invalid_qty",
        key,
      );
    }
    // Reject non-finite unitPrice (string, undefined, NaN) loudly. Without this,
    // `Math.abs(catalogPrice - NaN) > 0.01` evaluates false and silently masks
    // tampering attempts — even though the server still overrides the price
    // downstream, failing loud is better than failing silent.
    if (typeof l.unitPrice !== "number" || !Number.isFinite(l.unitPrice)) {
      throw new TotalsMismatchError(
        { subtotal: 0, shipping: 0, gst: 0, total: 0 },
        args.received,
        "price_mismatch",
        key,
      );
    }
    const catalogPrice = args.priceLookup.get(key);
    if (catalogPrice === undefined) {
      throw new TotalsMismatchError(
        { subtotal: 0, shipping: 0, gst: 0, total: 0 },
        args.received,
        "unknown_variant",
        key,
      );
    }
    if (Math.abs(catalogPrice - l.unitPrice) > PRICE_TOLERANCE) {
      throw new TotalsMismatchError(
        { subtotal: 0, shipping: 0, gst: 0, total: 0 },
        args.received,
        "price_mismatch",
        key,
      );
    }
    serverLines.push({
      unitPrice: catalogPrice,
      qty: l.qty,
      gstFree: l.gstFree === true,
    });
  }

  const expected = computeTotals({ lines: serverLines, delivery: args.delivery });
  const ok =
    Math.abs(expected.subtotal - args.received.subtotal) <= TOTAL_TOLERANCE &&
    Math.abs(expected.gst - args.received.gst) <= TOTAL_TOLERANCE &&
    Math.abs(expected.total - args.received.total) <= TOTAL_TOLERANCE;
  if (!ok) throw new TotalsMismatchError(expected, args.received, "total_mismatch");

  return expected;
}
