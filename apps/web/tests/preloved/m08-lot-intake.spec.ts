/**
 * Phase 2 leftover: operator links a consignment lot ticket at intake so the
 * accepted unit is attributed on stock and the consignments tab.
 *
 * Needs pnpm dev:web. Bound to demo-academy like m07.
 */
import { expect, test } from "playwright/test";
import {
  ITEM_NAME,
  SIZE,
  TENANT,
  acceptSize10PoloGood,
  chooseSelect,
  devLogin,
  ensurePrelovedEnabled,
  pooledRow,
} from "./helpers";

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
  });
});
