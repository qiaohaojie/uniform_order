import { SHIP_FEE_AUD } from "./shipping";

export type LineInput = {
  unitPrice: number; // AUD dollars (e.g. 19.95)
  qty: number; // positive integer
};

export type ComputedTotals = {
  subtotal: number; // AUD dollars, 2dp
  gst: number; // AUD dollars, 2dp — 1/11 of GST-inclusive total
  total: number; // AUD dollars, 2dp — subtotal + shipping
};

export type DeliveryMode = "pickup" | "ship";

// Round to 2dp using half-away-from-zero (Math.round behaviour).
// Matches the toFixed(2) display rounding used elsewhere.
// Exported so /api/orders can use the same rounding for lineTotal in Task 5.
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
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
  lines: LineInput[];
  delivery: DeliveryMode;
}): ComputedTotals {
  const subtotal = round2(
    args.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),
  );
  const ship = args.delivery === "ship" ? SHIP_FEE_AUD : 0;
  const total = round2(subtotal + ship);
  const gst = round2(total / 11);
  return { subtotal, gst, total };
}

export class TotalsMismatchError extends Error {
  constructor(
    readonly expected: ComputedTotals,
    readonly received: { subtotal: number; gst: number; total: number },
  ) {
    super("totals_mismatch");
  }
}

export function assertTotalsMatch(args: {
  lines: LineInput[];
  delivery: DeliveryMode;
  received: { subtotal: number; gst: number; total: number };
}): ComputedTotals {
  const expected = computeTotals({ lines: args.lines, delivery: args.delivery });
  const TOLERANCE = 0.01; // 1 cent
  const ok =
    Math.abs(expected.subtotal - args.received.subtotal) <= TOLERANCE &&
    Math.abs(expected.gst - args.received.gst) <= TOLERANCE &&
    Math.abs(expected.total - args.received.total) <= TOLERANCE;
  if (!ok) throw new TotalsMismatchError(expected, args.received);
  return expected;
}
