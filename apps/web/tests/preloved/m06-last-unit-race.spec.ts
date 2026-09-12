/**
 * M06 last-unit race: two concurrent paid checkouts for qty 1 compete at CAS.
 * Winner gets an order; loser gets 409 insufficient_qty; stock ends at 0.
 *
 * Charge-time PI mint is a non-locking read, so both PaymentIntents may succeed.
 * The hard backstop is decrementPrelovedForPaymentIntent on order create
 * (webhook may also win the race first — still one applied, one insufficient).
 *
 * Does not start the app. From repo root:
 *   pnpm dev:web
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:<port> pnpm test:m06-last-unit-race
 *
 * Bound to demo-academy by the package script. Needs Stripe test keys.
 *
 * baseURL and workers: 1 come from playwright.config.ts.
 */
import { expect, test, type APIResponse, type Page } from "playwright/test";
import { computeTotals } from "../../src/lib/order-totals";
import { PRELOVED_VARIANT_LABEL } from "../../src/lib/preloved";
import {
  ITEM_ID,
  ITEM_NAME,
  OPERATOR_EMAIL,
  SIZE,
  TENANT,
  confirmVisaPayment,
  devLogin,
  ensureInStockSku,
  ensurePrelovedEnabled,
  forceChargesEnabled,
  pinPooledSkuQty,
  readStockQty,
} from "./helpers";

async function mintLastUnitPi(
  page: Page,
  args: {
    skuId: string;
    sourceItemId: string;
    unitPrice: number;
    donatedGstFree: boolean;
    label: string;
  },
) {
  const totals = computeTotals({
    lines: [{ unitPrice: args.unitPrice, qty: 1, gstFree: args.donatedGstFree }],
    delivery: "pickup",
  });
  const res = await page.request.post("/api/stripe/payment-intent", {
    data: {
      tenantId: TENANT,
      amount: totals.total,
      lines: [
        {
          itemId: args.sourceItemId,
          variantLabel: PRELOVED_VARIANT_LABEL,
          size: SIZE,
          unitPrice: args.unitPrice,
          qty: 1,
          prelovedSkuId: args.skuId,
        },
      ],
      delivery: "pickup",
      subtotal: totals.subtotal,
      gst: totals.gst,
      metadata: {
        parentEmail: OPERATOR_EMAIL,
        studentName: `Race ${args.label}`,
        studentYear: "Year 9",
        delivery: "pickup",
      },
    },
  });
  expect(
    res.ok(),
    `PI mint ${args.label} failed: ${res.status()} ${await res.text()}`,
  ).toBeTruthy();
  const body = (await res.json()) as { paymentIntentId?: string };
  expect(body.paymentIntentId).toBeTruthy();
  return { paymentIntentId: body.paymentIntentId!, totals };
}

async function postPaidOrder(
  page: Page,
  args: {
    paymentIntentId: string;
    totals: { subtotal: number; gst: number; total: number };
    skuId: string;
    sourceItemId: string;
    unitPrice: number;
    label: string;
  },
): Promise<APIResponse> {
  return page.request.post("/api/orders", {
    data: {
      tenantId: TENANT,
      parentName: `Race Parent ${args.label}`,
      parentEmail: OPERATOR_EMAIL,
      parentMobile: "0412345678",
      studentName: `Race Student ${args.label}`,
      studentYear: "Year 9",
      studentRoll: "9R",
      fulfilmentMethod: "pickup",
      deliveryFee: 0,
      subtotal: args.totals.subtotal,
      gst: args.totals.gst,
      total: args.totals.total,
      stripePaymentIntentId: args.paymentIntentId,
      refundPolicyAccepted: true,
      lines: [
        {
          itemId: args.sourceItemId,
          itemName: ITEM_NAME,
          variantLabel: PRELOVED_VARIANT_LABEL,
          size: SIZE,
          qty: 1,
          unitPrice: args.unitPrice,
          lineTotal: args.unitPrice,
          prelovedSkuId: args.skuId,
        },
      ],
    },
  });
}

test.describe("M06 last-unit race", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("two concurrent last-unit orders: one wins, one 409, qty 0", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await devLogin(page, `/admin/${TENANT}/settings`);
    const { donatedGstFree } = await ensurePrelovedEnabled(page);

    // Row may already be at 0 from a prior race; pin restores qty without intake UI.
    let skuId: string;
    let unitPrice: number;
    let sourceItemId: string;
    try {
      ({ skuId, unitPrice, sourceItemId } = await pinPooledSkuQty(1));
    } catch {
      await ensureInStockSku(page);
      ({ skuId, unitPrice, sourceItemId } = await pinPooledSkuQty(1));
    }
    expect(sourceItemId).toBe(ITEM_ID);
    expect(await readStockQty(page)).toBe(1);

    await forceChargesEnabled();
    const a = await mintLastUnitPi(page, {
      skuId,
      sourceItemId,
      unitPrice,
      donatedGstFree,
      label: "A",
    });
    await forceChargesEnabled();
    const b = await mintLastUnitPi(page, {
      skuId,
      sourceItemId,
      unitPrice,
      donatedGstFree,
      label: "B",
    });
    expect(a.paymentIntentId).not.toBe(b.paymentIntentId);

    await Promise.all([
      confirmVisaPayment(a.paymentIntentId),
      confirmVisaPayment(b.paymentIntentId),
    ]);

    const [resA, resB] = await Promise.all([
      postPaidOrder(page, {
        paymentIntentId: a.paymentIntentId,
        totals: a.totals,
        skuId,
        sourceItemId,
        unitPrice,
        label: "A",
      }),
      postPaidOrder(page, {
        paymentIntentId: b.paymentIntentId,
        totals: b.totals,
        skuId,
        sourceItemId,
        unitPrice,
        label: "B",
      }),
    ]);

    const outcomes = [
      { label: "A", res: resA, pi: a.paymentIntentId },
      { label: "B", res: resB, pi: b.paymentIntentId },
    ];
    const bodies = await Promise.all(
      outcomes.map(async (o) => ({
        ...o,
        status: o.res.status(),
        body: (await o.res.json().catch(() => ({}))) as {
          orderId?: string;
          error?: string;
        },
      })),
    );

    const winners = bodies.filter(
      (o) =>
        (o.status === 200 || o.status === 201) &&
        typeof o.body.orderId === "string" &&
        o.body.orderId.length > 0,
    );
    const losers = bodies.filter(
      (o) => o.status === 409 && o.body.error === "insufficient_qty",
    );
    expect(
      winners,
      `expected one winner; got ${JSON.stringify(bodies.map((b) => ({ label: b.label, status: b.status, body: b.body })))}`,
    ).toHaveLength(1);
    expect(
      losers,
      `expected one insufficient_qty loser; got ${JSON.stringify(bodies.map((b) => ({ label: b.label, status: b.status, body: b.body })))}`,
    ).toHaveLength(1);
    expect(winners[0]!.body.orderId).toMatch(
      new RegExp(`^${TENANT.toUpperCase()}-`, "i"),
    );

    expect(await readStockQty(page)).toBe(0);

    // Restore one unit so later specs / the shop rack stay usable.
    await pinPooledSkuQty(1);
    expect(await readStockQty(page)).toBe(1);
  });
});
