/**
 * Phase 2 leftover: paid consigned units write a sold-line ledger with the
 * snapshotted commission, and operators export a treasurer payout CSV.
 *
 * Needs pnpm dev:web and Stripe test keys. Bound to demo-academy like m08.
 */
import { neon } from "@neondatabase/serverless";
import { expect, test, type APIResponse, type Page } from "playwright/test";
import { computeTotals } from "../../src/lib/order-totals";
import { PRELOVED_VARIANT_LABEL } from "../../src/lib/preloved";
import {
  PAYOUT_CSV_HEADERS,
  splitSaleCommission,
} from "../../src/lib/preloved-payout";
import {
  ITEM_ID,
  ITEM_NAME,
  OPERATOR_EMAIL,
  SIZE,
  TENANT,
  chooseSelect,
  confirmVisaPayment,
  devLogin,
  ensurePrelovedEnabled,
  forceChargesEnabled,
  loadLocalEnv,
  pinPooledSkuQty,
  restoreDonationOnlyIntake,
} from "./helpers";

test("commission split is integer cents, not a display-only cut", () => {
  expect(splitSaleCommission(19.95, 5000)).toEqual({
    saleCents: 1995,
    commissionCents: 998,
    remittanceCents: 997,
    saleAud: 19.95,
    commissionAud: 9.98,
    remittanceAud: 9.97,
  });
  expect(splitSaleCommission(20, 2500)).toEqual({
    saleCents: 2000,
    commissionCents: 500,
    remittanceCents: 1500,
    saleAud: 20,
    commissionAud: 5,
    remittanceAud: 15,
  });
  expect(splitSaleCommission(10, 0)).toMatchObject({
    commissionAud: 0,
    remittanceAud: 10,
  });
  expect(splitSaleCommission(10, 10_000)).toMatchObject({
    commissionAud: 10,
    remittanceAud: 0,
  });
});

async function createEftLot(page: Page, stamp: string) {
  const createRes = await page.request.post(
    `/api/tenant/${TENANT}/preloved/consign`,
    {
      data: {
        familyName: `Payout${stamp}`,
        studentName: "Remi",
        email: `payout-${stamp}@example.com`,
        mobile: "0400000014",
        payoutPreference: "eft",
        bankBsb: "062000",
        bankAccountName: "Payout Family",
        bankAccountNumber: "12345678",
        unsoldPreference: "donate",
        items: [{ garment: "Sports polo", size: SIZE }],
        termsAccepted: true,
      },
    },
  );
  if (!createRes.ok()) {
    throw new Error(
      `create consignment lot failed ${createRes.status()}: ${await createRes.text()}`,
    );
  }
  const created = (await createRes.json()) as {
    id?: string;
    ticketCode?: string;
  };
  expect(created.id).toBeTruthy();
  expect(created.ticketCode).toMatch(/^CL-[A-Z0-9]{6}$/);
  return { lotId: created.id!, ticket: created.ticketCode! };
}

async function unsoldRankForLot(skuId: string, lotId: string) {
  loadLocalEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing for unsoldRankForLot");
  const sql = neon(url);
  const rows = await sql`
    select id, lot_id
    from consignment_items
    where preloved_sku_id = ${skuId}
      and sold_order_line_id is null
    order by created_at, id
  `;
  const index = rows.findIndex((row) => String(row.lot_id) === lotId);
  return { index, count: rows.length };
}

async function mintAndPayPreloved(
  page: Page,
  args: {
    skuId: string;
    sourceItemId: string;
    unitPrice: number;
    qty: number;
    donatedGstFree: boolean;
    label: string;
  },
) {
  const totals = computeTotals({
    lines: [
      {
        unitPrice: args.unitPrice,
        qty: args.qty,
        gstFree: args.donatedGstFree,
      },
    ],
    delivery: "pickup",
  });
  await forceChargesEnabled();
  const piRes = await page.request.post("/api/stripe/payment-intent", {
    data: {
      tenantId: TENANT,
      amount: totals.total,
      lines: [
        {
          itemId: args.sourceItemId,
          variantLabel: PRELOVED_VARIANT_LABEL,
          size: SIZE,
          unitPrice: args.unitPrice,
          qty: args.qty,
          prelovedSkuId: args.skuId,
        },
      ],
      delivery: "pickup",
      subtotal: totals.subtotal,
      gst: totals.gst,
      metadata: {
        parentEmail: OPERATOR_EMAIL,
        studentName: `Payout ${args.label}`,
        studentYear: "Year 9",
        delivery: "pickup",
      },
    },
  });
  expect(
    piRes.ok(),
    `PI mint failed: ${piRes.status()} ${await piRes.text()}`,
  ).toBeTruthy();
  const piBody = (await piRes.json()) as { paymentIntentId?: string };
  expect(piBody.paymentIntentId).toBeTruthy();
  await confirmVisaPayment(piBody.paymentIntentId!);

  const orderRes = await postPaidPrelovedOrder(page, {
    paymentIntentId: piBody.paymentIntentId!,
    totals,
    skuId: args.skuId,
    sourceItemId: args.sourceItemId,
    unitPrice: args.unitPrice,
    qty: args.qty,
    label: args.label,
  });
  expect(
    orderRes.ok(),
    `order POST failed: ${orderRes.status()} ${await orderRes.text()}`,
  ).toBeTruthy();
  const orderBody = (await orderRes.json()) as { orderId?: string };
  expect(orderBody.orderId).toBeTruthy();
  return {
    orderId: orderBody.orderId!,
    paymentIntentId: piBody.paymentIntentId!,
    totals,
  };
}

async function postPaidPrelovedOrder(
  page: Page,
  args: {
    paymentIntentId: string;
    totals: { subtotal: number; gst: number; total: number };
    skuId: string;
    sourceItemId: string;
    unitPrice: number;
    qty: number;
    label: string;
  },
): Promise<APIResponse> {
  return page.request.post("/api/orders", {
    data: {
      tenantId: TENANT,
      parentName: `Payout Parent ${args.label}`,
      parentEmail: OPERATOR_EMAIL,
      parentMobile: "0412345678",
      studentName: `Payout Student ${args.label}`,
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
          qty: args.qty,
          unitPrice: args.unitPrice,
          lineTotal: args.unitPrice * args.qty,
          prelovedSkuId: args.skuId,
        },
      ],
    },
  });
}

async function acceptConsignedGood(page: Page, lotId: string) {
  const res = await page.request.post(`/api/tenant/${TENANT}/preloved/intake`, {
    data: {
      action: "accepted",
      sourceItemId: ITEM_ID,
      size: SIZE,
      condition: "good",
      consignmentLotId: lotId,
    },
  });
  expect(
    res.ok(),
    `intake accept failed ${res.status()}: ${await res.text()}`,
  ).toBeTruthy();
}

async function soldLinesForOrders(orderIds: string[]) {
  loadLocalEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing for soldLinesForOrders");
  const sql = neon(url);
  const rows: Array<{
    order_id: string;
    consignment_item_id: string;
    remittance_amount: string | number;
    sold_order_line_id: string | null;
  }> = [];
  for (const orderId of orderIds) {
    const part = await sql`
      select
        csl.order_id,
        csl.consignment_item_id,
        csl.remittance_amount,
        ci.sold_order_line_id
      from consignment_sold_lines csl
      inner join consignment_items ci on ci.id = csl.consignment_item_id
      where csl.order_id = ${orderId}
      order by csl.created_at, csl.id
    `;
    rows.push(
      ...(part as Array<{
        order_id: string;
        consignment_item_id: string;
        remittance_amount: string | number;
        sold_order_line_id: string | null;
      }>),
    );
  }
  return rows;
}

test.describe("Phase 2 payout CSV / sold-line ledger", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("sale records remittance; treasurer CSV uses snapshotted commission", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await devLogin(page, `/admin/${TENANT}/settings`);
    const { donatedGstFree } = await ensurePrelovedEnabled(page);

    const enableRes = await page.request.patch(`/api/tenant/${TENANT}/preloved`, {
      data: {
        prelovedEnabled: true,
        intakeMode: "donation_and_consignment",
        commissionBps: 5000,
      },
    });
    expect(enableRes.ok()).toBeTruthy();

    try {
    const stamp = String(Date.now()).slice(-8);
    const { lotId, ticket } = await createEftLot(page, stamp);

    await page.goto(`/admin/${TENANT}/preloved/intake`);
    await expect(page.getByTestId("intake-desk")).toBeVisible();
    await expect(page.getByTestId("intake-lot-loading")).toHaveCount(0, {
      timeout: 15_000,
    });
    await chooseSelect(page, "intake-item", ITEM_NAME);
    await chooseSelect(page, "intake-size", SIZE);
    await page.getByTestId("intake-condition").getByText("Good", { exact: true }).click();
    await chooseSelect(page, "intake-lot", new RegExp(`^${ticket}\\s`));
    await page.getByTestId("intake-accept").click();
    await expect(page.getByTestId("intake-success")).toContainText(ticket);

    await page.goto(`/admin/${TENANT}/preloved/consignments`);
    const lotRow = page.locator(
      `[data-testid="consignments-row"][data-ticket="${ticket}"]`,
    );
    await expect(lotRow).toBeVisible({ timeout: 15_000 });
    await expect(lotRow.getByTestId("consignments-sold-empty")).toBeVisible();
    await expect(lotRow.getByTestId("consignments-owing")).toContainText("$0.00");

    const lotsRes = await page.request.get(
      `/api/tenant/${TENANT}/preloved/consignment-lots`,
    );
    expect(lotsRes.ok()).toBeTruthy();
    const lotsBody = (await lotsRes.json()) as {
      lots?: Array<{
        id: string;
        bankBsb?: string | null;
        bankAccountName?: string | null;
        bankAccountNumber?: string | null;
        acceptedUnits?: Array<{ skuId: string }>;
      }>;
    };
    const lot = lotsBody.lots?.find((row) => row.id === lotId);
    expect(lot?.bankBsb).toBe("•••000");
    expect(lot?.bankAccountName).toBe("Payout Family");
    expect(lot?.bankAccountNumber).toBe("••••5678");
    expect(JSON.stringify(lot)).not.toContain("062000");
    expect(JSON.stringify(lot)).not.toContain("12345678");
    await expect(lotRow.getByTestId("consignments-bank")).toContainText("•••000");
    await expect(lotRow.getByTestId("consignments-bank")).toContainText("••••5678");
    await expect(lotRow.getByTestId("consignments-bank")).not.toContainText(
      "12345678",
    );
    const skuId = lot?.acceptedUnits?.[0]?.skuId;
    expect(skuId).toBeTruthy();

    const rank = await unsoldRankForLot(skuId!, lotId);
    expect(rank.index).toBeGreaterThanOrEqual(0);
    const buyQty = rank.index + 1;
    expect(buyQty).toBeLessThanOrEqual(12);

    const pinned = await pinPooledSkuQty(buyQty);
    expect(pinned.skuId).toBe(skuId);
    expect(pinned.sourceItemId).toBe(ITEM_ID);

    const paid = await mintAndPayPreloved(page, {
      skuId: skuId!,
      sourceItemId: ITEM_ID,
      unitPrice: pinned.unitPrice,
      qty: buyQty,
      donatedGstFree,
      label: stamp,
    });

    const split = splitSaleCommission(pinned.unitPrice, 5000);

    await page.goto(`/admin/${TENANT}/preloved/consignments`);
    await expect(lotRow.getByTestId("consignments-sold-row")).toBeVisible({
      timeout: 15_000,
    });
    await expect(lotRow).toHaveAttribute("data-sold-qty", "1");
    await expect(lotRow.getByTestId("consignments-sold-row")).toContainText(
      paid.orderId,
    );
    await expect(lotRow.getByTestId("consignments-sold-row")).toContainText(
      `owing $${split.remittanceAud.toFixed(2)}`,
    );
    await expect(lotRow.getByTestId("consignments-owing")).toContainText(
      `$${split.remittanceAud.toFixed(2)}`,
    );

    const csvRes = await page.request.get(
      `/api/tenant/${TENANT}/preloved/payout.csv`,
    );
    expect(csvRes.ok()).toBeTruthy();
    expect(csvRes.headers()["content-type"] ?? "").toContain("text/csv");
    const csv = await csvRes.text();
    const headerLine = csv.trim().split("\n")[0];
    expect(headerLine).toBe(PAYOUT_CSV_HEADERS.join(","));
    const ticketLine = csv
      .split("\n")
      .find((line) => line.includes(ticket) && line.includes(paid.orderId));
    expect(ticketLine).toBeTruthy();
    expect(ticketLine).toContain("EFT");
    expect(ticketLine).toContain("062000");
    expect(ticketLine).toContain("12345678");
    expect(ticketLine).toContain(split.saleAud.toFixed(2));
    expect(ticketLine).toContain("5000");
    expect(ticketLine).toContain(split.commissionAud.toFixed(2));
    expect(ticketLine).toContain(split.remittanceAud.toFixed(2));

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("consignments-export-csv").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      new RegExp(`^payout-${TENANT}-\\d{4}-\\d{2}-\\d{2}\\.csv$`),
    );
    } finally {
      await restoreDonationOnlyIntake(page);
    }
  });

  test("export CSV surfaces an error state", async ({ page }) => {
    await devLogin(page, `/admin/${TENANT}/settings`);
    await ensurePrelovedEnabled(page);
    const enableRes = await page.request.patch(`/api/tenant/${TENANT}/preloved`, {
      data: {
        prelovedEnabled: true,
        intakeMode: "donation_and_consignment",
        commissionBps: 5000,
      },
    });
    expect(enableRes.ok()).toBeTruthy();

    try {

    await page.route(`**/api/tenant/${TENANT}/preloved/payout.csv**`, (route) => {
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Ledger unavailable" }),
      });
    });

    await page.goto(`/admin/${TENANT}/preloved/consignments`);
    await expect(page.getByTestId("consignments-export-csv")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("consignments-export-csv").click();
    await expect(page.getByTestId("consignments-export-error")).toContainText(
      "Ledger unavailable",
    );
    } finally {
      await restoreDonationOnlyIntake(page);
    }
  });

  test("two concurrent qty-1 sales claim distinct FIFO units", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await devLogin(page, `/admin/${TENANT}/settings`);
    const { donatedGstFree } = await ensurePrelovedEnabled(page);
    const enableRes = await page.request.patch(`/api/tenant/${TENANT}/preloved`, {
      data: {
        prelovedEnabled: true,
        intakeMode: "donation_and_consignment",
        commissionBps: 5000,
      },
    });
    expect(enableRes.ok()).toBeTruthy();

    try {
      const stamp = String(Date.now()).slice(-8);
      const lotA = await createEftLot(page, `${stamp}a`);
      const lotB = await createEftLot(page, `${stamp}b`);
      await acceptConsignedGood(page, lotA.lotId);
      await acceptConsignedGood(page, lotB.lotId);

      const pinned = await pinPooledSkuQty(2);
      expect(pinned.sourceItemId).toBe(ITEM_ID);

      const mint = async (label: string) => {
        const totals = computeTotals({
          lines: [
            {
              unitPrice: pinned.unitPrice,
              qty: 1,
              gstFree: donatedGstFree,
            },
          ],
          delivery: "pickup",
        });
        await forceChargesEnabled();
        const piRes = await page.request.post("/api/stripe/payment-intent", {
          data: {
            tenantId: TENANT,
            amount: totals.total,
            lines: [
              {
                itemId: pinned.sourceItemId,
                variantLabel: PRELOVED_VARIANT_LABEL,
                size: SIZE,
                unitPrice: pinned.unitPrice,
                qty: 1,
                prelovedSkuId: pinned.skuId,
              },
            ],
            delivery: "pickup",
            subtotal: totals.subtotal,
            gst: totals.gst,
            metadata: {
              parentEmail: OPERATOR_EMAIL,
              studentName: `Fifo ${label}`,
              studentYear: "Year 9",
              delivery: "pickup",
            },
          },
        });
        expect(
          piRes.ok(),
          `PI mint ${label} failed: ${piRes.status()} ${await piRes.text()}`,
        ).toBeTruthy();
        const body = (await piRes.json()) as { paymentIntentId?: string };
        expect(body.paymentIntentId).toBeTruthy();
        return { paymentIntentId: body.paymentIntentId!, totals };
      };

      const a = await mint("A");
      const b = await mint("B");
      expect(a.paymentIntentId).not.toBe(b.paymentIntentId);
      await Promise.all([
        confirmVisaPayment(a.paymentIntentId),
        confirmVisaPayment(b.paymentIntentId),
      ]);

      const [resA, resB] = await Promise.all([
        postPaidPrelovedOrder(page, {
          paymentIntentId: a.paymentIntentId,
          totals: a.totals,
          skuId: pinned.skuId,
          sourceItemId: pinned.sourceItemId,
          unitPrice: pinned.unitPrice,
          qty: 1,
          label: `${stamp}A`,
        }),
        postPaidPrelovedOrder(page, {
          paymentIntentId: b.paymentIntentId,
          totals: b.totals,
          skuId: pinned.skuId,
          sourceItemId: pinned.sourceItemId,
          unitPrice: pinned.unitPrice,
          qty: 1,
          label: `${stamp}B`,
        }),
      ]);

      const outcomes = await Promise.all(
        [
          { label: "A", res: resA },
          { label: "B", res: resB },
        ].map(async (row) => ({
          label: row.label,
          status: row.res.status(),
          body: (await row.res.json().catch(() => ({}))) as {
            orderId?: string;
            error?: string;
          },
        })),
      );
      const winners = outcomes.filter(
        (row) =>
          (row.status === 200 || row.status === 201) &&
          typeof row.body.orderId === "string" &&
          row.body.orderId.length > 0,
      );
      expect(
        winners,
        `expected two paid orders; got ${JSON.stringify(outcomes)}`,
      ).toHaveLength(2);

      const orderIds = winners.map((row) => row.body.orderId!);
      expect(new Set(orderIds).size).toBe(2);

      const lines = await soldLinesForOrders(orderIds);
      expect(
        lines,
        `loser must claim the next unit, not drop: ${JSON.stringify(lines)}`,
      ).toHaveLength(2);
      expect(new Set(lines.map((row) => row.consignment_item_id)).size).toBe(2);
      expect(new Set(lines.map((row) => row.order_id)).size).toBe(2);
      expect(lines.every((row) => row.sold_order_line_id)).toBeTruthy();

      await pinPooledSkuQty(1);
    } finally {
      await restoreDonationOnlyIntake(page);
    }
  });

  test("idempotent POST restores a sold line after a lost insert", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await devLogin(page, `/admin/${TENANT}/settings`);
    const { donatedGstFree } = await ensurePrelovedEnabled(page);
    const enableRes = await page.request.patch(`/api/tenant/${TENANT}/preloved`, {
      data: {
        prelovedEnabled: true,
        intakeMode: "donation_and_consignment",
        commissionBps: 5000,
      },
    });
    expect(enableRes.ok()).toBeTruthy();

    try {
      const stamp = String(Date.now()).slice(-8);
      const { lotId } = await createEftLot(page, `${stamp}r`);
      await acceptConsignedGood(page, lotId);
      const pinned = await pinPooledSkuQty(1);

      const paid = await mintAndPayPreloved(page, {
        skuId: pinned.skuId,
        sourceItemId: pinned.sourceItemId,
        unitPrice: pinned.unitPrice,
        qty: 1,
        donatedGstFree,
        label: `${stamp}r`,
      });

      const before = await soldLinesForOrders([paid.orderId]);
      expect(before.length).toBeGreaterThanOrEqual(1);
      const itemIds = before.map((row) => row.consignment_item_id);

      loadLocalEnv();
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error("DATABASE_URL missing for orphan delete");
      const sql = neon(url);
      await sql`
        delete from consignment_sold_lines
        where order_id = ${paid.orderId}
      `;
      const orphaned: Array<{ id: string }> = [];
      for (const itemId of itemIds) {
        const part = await sql`
          select id
          from consignment_items
          where id = ${itemId}
            and sold_order_line_id is not null
        `;
        orphaned.push(...(part as Array<{ id: string }>));
      }
      expect(orphaned.length).toBe(itemIds.length);
      const missing = await soldLinesForOrders([paid.orderId]);
      expect(missing).toHaveLength(0);

      const replay = await postPaidPrelovedOrder(page, {
        paymentIntentId: paid.paymentIntentId,
        totals: paid.totals,
        skuId: pinned.skuId,
        sourceItemId: pinned.sourceItemId,
        unitPrice: pinned.unitPrice,
        qty: 1,
        label: `${stamp}r`,
      });
      expect(
        replay.ok(),
        `idempotent replay failed: ${replay.status()} ${await replay.text()}`,
      ).toBeTruthy();
      const replayBody = (await replay.json()) as {
        orderId?: string;
        idempotent?: boolean;
      };
      expect(replayBody.orderId).toBe(paid.orderId);

      const restored = await soldLinesForOrders([paid.orderId]);
      expect(restored).toHaveLength(before.length);
      expect(
        new Set(restored.map((row) => row.consignment_item_id)),
      ).toEqual(new Set(itemIds));

      await pinPooledSkuQty(1);
    } finally {
      await restoreDonationOnlyIntake(page);
    }
  });
});
