/**
 * Phase 2 leftover: operator links a consignment lot ticket at intake so the
 * accepted unit is attributed on stock and the consignments tab.
 *
 * Needs pnpm dev:web. Bound to demo-academy like m07.
 */
import { expect, test, type Page } from "playwright/test";
import {
  ITEM_ID,
  ITEM_NAME,
  SIZE,
  TENANT,
  acceptSize10PoloGood,
  chooseSelect,
  devLogin,
  ensurePrelovedEnabled,
  pinPooledSkuForTest,
  pooledRow,
  restoreDonationOnlyIntake,
} from "./helpers";

const MIXED_GST_CONDITION = "fair" as const;

async function createConsignmentLot(page: Page, stamp: string) {
  const createRes = await page.request.post(
    `/api/tenant/${TENANT}/preloved/consign`,
    {
      data: {
        familyName: `Gst${stamp}`,
        studentName: "Kai",
        email: `gst-${stamp}@example.com`,
        mobile: "0400000013",
        payoutPreference: "school_fee_credit",
        unsoldPreference: "donate",
        items: [{ garment: "Sports polo", size: SIZE }],
        termsAccepted: true,
      },
    },
  );
  if (!createRes.ok()) {
    const body = await createRes.text();
    throw new Error(`create consignment lot failed ${createRes.status()}: ${body}`);
  }
  const created = (await createRes.json()) as {
    id?: string;
    ticketCode?: string;
  };
  expect(created.id).toBeTruthy();
  expect(created.ticketCode).toMatch(/^CL-[A-Z0-9]{6}$/);
  return { lotId: created.id!, ticket: created.ticketCode! };
}

async function postIntake(page: Page, body: Record<string, unknown> = {}) {
  return page.request.post(`/api/tenant/${TENANT}/preloved/intake`, {
    data: {
      action: "accepted",
      sourceItemId: ITEM_ID,
      size: SIZE,
      condition: MIXED_GST_CONDITION,
      ...body,
    },
  });
}

test.describe("Phase 2 consignment lot → intake / stock", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("accept against a ticket; stock and lot show the link", async ({
    page,
  }) => {
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

    const createRes = await page.request.post(
      `/api/tenant/${TENANT}/preloved/consign`,
      {
        data: {
          familyName: "Lotlink",
          studentName: "Ava",
          email: "lotlink@example.com",
          mobile: "0400000012",
          payoutPreference: "school_fee_credit",
          unsoldPreference: "donate",
          items: [{ garment: "Sports polo", size: "10" }],
          termsAccepted: true,
        },
      },
    );
    expect(createRes.ok()).toBeTruthy();
    const created = (await createRes.json()) as {
      id?: string;
      ticketCode?: string;
    };
    expect(created.id).toBeTruthy();
    expect(created.ticketCode).toMatch(/^CL-[A-Z0-9]{6}$/);
    const ticket = created.ticketCode!;
    const lotId = created.id!;

    await page.goto(`/admin/${TENANT}/preloved/intake`);
    await expect(page.getByTestId("intake-desk")).toBeVisible();
    await expect(page.getByTestId("intake-lot-loading")).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("intake-lot")).toBeVisible();
    await chooseSelect(page, "intake-item", ITEM_NAME);
    await chooseSelect(page, "intake-size", SIZE);
    await page.getByTestId("intake-condition").getByText("Good", { exact: true }).click();
    await chooseSelect(page, "intake-lot", new RegExp(`^${ticket}\\s`));
    await page.getByTestId("intake-accept").click();
    await expect(page.getByTestId("intake-success")).toContainText(ticket);

    await page.goto(`/admin/${TENANT}/preloved/stock`);
    await expect(page.getByTestId("preloved-stock-page")).toBeVisible();
    const row = pooledRow(page);
    await expect(row).toBeVisible();
    await expect(row.getByTestId("stock-lot-tickets")).toContainText(ticket);

    await page.goto(`/admin/${TENANT}/preloved/consignments`);
    await expect(page.getByTestId("consignments-list")).toBeVisible({
      timeout: 15_000,
    });
    const lotRow = page.locator(
      `[data-testid="consignments-row"][data-ticket="${ticket}"]`,
    );
    await expect(lotRow).toBeVisible();
    await expect(lotRow).toHaveAttribute("data-accepted-qty", /[1-9]/);
    await expect(lotRow.getByTestId("consignments-accepted-row")).toContainText(
      ITEM_NAME,
    );
    await expect(lotRow.getByTestId("consignments-accepted-row")).toContainText(
      SIZE,
    );

    const missing = await page.request.post(
      `/api/tenant/${TENANT}/preloved/intake`,
      {
        data: {
          action: "accepted",
          sourceItemId: process.env.PRELOVED_ITEM_ID ?? "rvra-polo-ss",
          size: SIZE,
          condition: "good",
          consignmentLotId: "00000000-0000-4000-8000-000000000000",
        },
      },
    );
    expect(missing.status()).toBe(404);
    const missingBody = (await missing.json()) as { code?: string };
    expect(missingBody.code).toBe("consignment_lot_not_found");

    const donationRes = await page.request.patch(
      `/api/tenant/${TENANT}/preloved`,
      { data: { intakeMode: "donation_only" } },
    );
    expect(donationRes.ok()).toBeTruthy();
    const blocked = await page.request.post(
      `/api/tenant/${TENANT}/preloved/intake`,
      {
        data: {
          action: "accepted",
          sourceItemId: process.env.PRELOVED_ITEM_ID ?? "rvra-polo-ss",
          size: SIZE,
          condition: "good",
          consignmentLotId: lotId,
        },
      },
    );
    expect(blocked.status()).toBe(400);
    const blockedBody = (await blocked.json()) as { code?: string };
    expect(blockedBody.code).toBe("consignment_not_enabled");

    const restore = await page.request.patch(
      `/api/tenant/${TENANT}/preloved`,
      { data: { intakeMode: "donation_and_consignment" } },
    );
    expect(restore.ok()).toBeTruthy();

    await page.goto(`/admin/${TENANT}/preloved/intake`);
    await expect(page.getByTestId("intake-desk")).toBeVisible();
    await acceptSize10PoloGood(page);
    await expect(page.getByTestId("intake-success")).toContainText(/Donation pooled/i);
    } finally {
      await restoreDonationOnlyIntake(page);
    }
  });

  test("refuse mixed GST on a pooled SKU; matching donation still accepts", async ({
    page,
  }) => {
    await devLogin(page, `/admin/${TENANT}/settings`);
    await ensurePrelovedEnabled(page);

    const enableRes = await page.request.patch(`/api/tenant/${TENANT}/preloved`, {
      data: {
        prelovedEnabled: true,
        intakeMode: "donation_and_consignment",
        commissionBps: 5000,
        donatedGstFree: true,
      },
    });
    expect(enableRes.ok()).toBeTruthy();

    try {
      await pinPooledSkuForTest({ qty: 0, size: SIZE, condition: MIXED_GST_CONDITION });
      const { lotId } = await createConsignmentLot(page, `mix-${Date.now()}`);

      const donate = await postIntake(page);
      expect(donate.ok()).toBeTruthy();
      const donated = (await donate.json()) as { sku?: { gstFree?: boolean } };
      expect(donated.sku?.gstFree).toBe(true);

      const mixedConsign = await postIntake(page, { consignmentLotId: lotId });
      expect(mixedConsign.status()).toBe(409);
      const mixedConsignBody = (await mixedConsign.json()) as { code?: string };
      expect(mixedConsignBody.code).toBe("gst_pool_conflict");

      const matchingDonate = await postIntake(page);
      expect(matchingDonate.ok()).toBeTruthy();

      await pinPooledSkuForTest({ qty: 0, size: SIZE, condition: MIXED_GST_CONDITION });
      const offRes = await page.request.patch(`/api/tenant/${TENANT}/preloved`, {
        data: { donatedGstFree: false },
      });
      expect(offRes.ok()).toBeTruthy();

      const consign = await postIntake(page, { consignmentLotId: lotId });
      expect(consign.ok()).toBeTruthy();
      const consigned = (await consign.json()) as { sku?: { gstFree?: boolean } };
      expect(consigned.sku?.gstFree).toBe(false);

      const onRes = await page.request.patch(`/api/tenant/${TENANT}/preloved`, {
        data: { donatedGstFree: true },
      });
      expect(onRes.ok()).toBeTruthy();
      const mixedDonate = await postIntake(page);
      expect(mixedDonate.status()).toBe(409);
      const mixedDonateBody = (await mixedDonate.json()) as { code?: string };
      expect(mixedDonateBody.code).toBe("gst_pool_conflict");
    } finally {
      const restore = await page.request.patch(`/api/tenant/${TENANT}/preloved`, {
        data: {
          intakeMode: "donation_only",
          donatedGstFree: false,
        },
      });
      expect(restore.ok()).toBeTruthy();
    }
  });

  test("stale ticket selection cannot fall through as a donation", async ({
    page,
  }) => {
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

    const { ticket } = await createConsignmentLot(page, `stale-${Date.now()}`);

    await page.goto(`/admin/${TENANT}/preloved/intake`);
    await expect(page.getByTestId("intake-desk")).toBeVisible();
    await expect(page.getByTestId("intake-lot-loading")).toHaveCount(0, {
      timeout: 15_000,
    });
    await chooseSelect(page, "intake-item", ITEM_NAME);
    await chooseSelect(page, "intake-size", SIZE);
    await page.getByTestId("intake-condition").getByText("Fair", { exact: true }).click();
    await chooseSelect(page, "intake-lot", new RegExp(`^${ticket}\\s`));

    await page.route(`**/api/tenant/${TENANT}/preloved/consignment-lots`, (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Lots unavailable" }),
        });
      }
      return route.continue();
    });
    await page.getByTestId("intake-lot-retry").click();
    await expect(page.getByTestId("intake-lot-error")).toBeVisible();
    await expect(page.getByTestId("intake-accept")).toBeDisabled();
    } finally {
      await restoreDonationOnlyIntake(page);
    }
  });
});
