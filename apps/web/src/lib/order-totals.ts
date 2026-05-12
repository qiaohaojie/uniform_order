import { SHIP_FEE_AUD } from "./shipping";

export type LineInput = {
  itemId: string;
  variantLabel: string;
  unitPrice: number; // AUD dollars (e.g. 19.95) — client-claimed, validated against catalog
  qty: number; // positive integer
};

export type ComputedTotals = {
  subtotal: number; // AUD dollars, 2dp
  shipping: number; // AUD dollars, 2dp — SHIP_FEE_AUD when delivery=ship, 0 otherwise
  gst: number; // AUD dollars, 2dp — 1/11 of GST-inclusive total
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

/**
 * Compute order totals in AUD dollars.
 *
 * GST model: 1/11 of the **GST-inclusive total** (subtotal + shipping).
 * This treats shipping as GST-applicable, which is the AU norm for domestic
 * deliveries by a GST-registered business.
 *
 * Reports page (`app/platform/billing/`, `app/admin/[tenant]/reports/`) has
 * its own GST calculation today. Consolidating to this helper is tracked as
 * a follow-up in `docs/remaining_work.md` and is NOT done in this PR —
 * accountant sign-off (§3.6) will reconcile any formula drift between the
 * two callsites first.
 *
 * If shipping is ever moved to GST-free, change to `(subtotal / 11)` and
 * audit historical Reports rows before deploying.
 */
export function computeTotals(args: {
  lines: { unitPrice: number; qty: number }[];
  delivery: DeliveryMode;
}): ComputedTotals {
  const subtotal = round2(
    args.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),
  );
  const shipping = args.delivery === "ship" ? SHIP_FEE_AUD : 0;
  const total = round2(subtotal + shipping);
  const gst = round2(total / 11);
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
 * Assert that client-supplied totals match server-authoritative prices from the catalog.
 *
 * 1. Looks up each (itemId, variantLabel) in priceLookup — throws 'unknown_variant' if missing.
 * 2. Compares client unitPrice against catalog price (tolerance 1¢) — throws 'price_mismatch'.
 * 3. Recomputes totals from catalog prices — throws 'total_mismatch' on drift > 1¢.
 *
 * Returns ComputedTotals computed from server-authoritative prices.
 */
export function assertTotalsMatch(args: {
  lines: LineInput[];
  delivery: DeliveryMode;
  received: { subtotal: number; gst: number; total: number };
  priceLookup: Map<string, number>;
}): ComputedTotals {
  const PRICE_TOLERANCE = 0.01;
  const TOTAL_TOLERANCE = 0.01;

  const serverLines: { unitPrice: number; qty: number }[] = [];
  for (const l of args.lines) {
    const key = priceLookupKey(l.itemId, l.variantLabel);
    if (!Number.isInteger(l.qty) || l.qty <= 0) {
      throw new TotalsMismatchError(
        { subtotal: 0, shipping: 0, gst: 0, total: 0 },
        args.received,
        "invalid_qty",
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
    serverLines.push({ unitPrice: catalogPrice, qty: l.qty });
  }

  const expected = computeTotals({ lines: serverLines, delivery: args.delivery });
  const ok =
    Math.abs(expected.subtotal - args.received.subtotal) <= TOTAL_TOLERANCE &&
    Math.abs(expected.gst - args.received.gst) <= TOTAL_TOLERANCE &&
    Math.abs(expected.total - args.received.total) <= TOTAL_TOLERANCE;
  if (!ok) throw new TotalsMismatchError(expected, args.received, "total_mismatch");

  return expected;
}
