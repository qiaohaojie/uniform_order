/**
 * Phase 2 first vertical: enable consignment, parent form with school-fee
 * credit preference, operator lot list + manual credit mark.
 *
 * Needs pnpm dev:web. Prefer demo-academy like other Phase 1 follow-up gates.
 */
import { expect, test } from "playwright/test";
import {
  TENANT,
  devLogin,
  ensurePrelovedEnabled,
} from "./helpers";

test.describe("Phase 2 consignment / school-fee credit", () => {
  test("parent submits lot; operator marks school-fee credited", async ({
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

    await page.goto(`/${TENANT}/preloved/consign`);
    await expect(page.getByTestId("consign-page")).toBeVisible();
    await expect(page.getByTestId("footer-consign-link")).toBeVisible();

    await page.getByTestId("consign-family").locator("input").fill("Nguyen");
    await page.getByTestId("consign-student").locator("input").fill("Minh");
    await page.getByTestId("consign-email").locator("input").fill("parent@example.com");
    await page.getByTestId("consign-mobile").locator("input").fill("0400000000");
    await page.getByTestId("consign-payout-school_fee_credit").check();
    await page.getByTestId("consign-unsold-donate").check();
    await page.getByTestId("consign-item-garment-0").locator("input").fill("Sports polo");
    await page.getByTestId("consign-item-size-0").locator("input").fill("10");
    await page.getByTestId("consign-terms").check();
    await page.getByTestId("consign-submit").click();

    await expect(page.getByTestId("consign-form-success")).toBeVisible();
    const ticket = (await page.getByTestId("consign-ticket-code").innerText()).trim();
    expect(ticket).toMatch(/^CL-[A-Z0-9]{6}$/);

    await page.goto(`/admin/${TENANT}/preloved/consignments`);
    await expect(page.getByTestId("consignments-panel")).toBeVisible();
    await expect(page.getByTestId("consignments-list")).toBeVisible({
      timeout: 15_000,
    });

    const row = page.locator(`[data-testid="consignments-row"][data-ticket="${ticket}"]`);
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute("data-payout-status", "pending");
    await row.getByTestId("consignments-mark-payout").click();
    await expect(row).toHaveAttribute("data-payout-status", "school_fee_credited", {
      timeout: 10_000,
    });
    await expect(row.getByTestId("consignments-status")).toContainText(
      /School-fee credited/i,
    );
  });
});
