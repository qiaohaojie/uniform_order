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
  restoreDonationOnlyIntake,
} from "./helpers";
import { maskAccountNumber, maskBsb } from "../../src/lib/preloved-consignment";

test("mask BSB last 3 and account last 4 for operator JSON", () => {
  expect(maskBsb("062000")).toBe("•••000");
  expect(maskAccountNumber("12345678")).toBe("••••5678");
  expect(maskBsb(null)).toBeNull();
  expect(maskAccountNumber("")).toBeNull();
});

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

    try {

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

    const lotId = await row.getAttribute("data-lot-id");
    expect(lotId).toBeTruthy();

    const remakeRes = await page.request.patch(
      `/api/tenant/${TENANT}/preloved/consignment-lots/${lotId}`,
      { data: { payoutStatus: "eft_paid" } },
    );
    expect(remakeRes.status()).toBe(409);
    const remakeBody = (await remakeRes.json()) as {
      code?: string;
      lot?: { payoutStatus?: string; payoutMarkedAt?: string | null };
    };
    expect(remakeBody.code).toBe("already_marked");
    expect(remakeBody.lot?.payoutStatus).toBe("school_fee_credited");
    const markedAt = remakeBody.lot?.payoutMarkedAt;
    expect(markedAt).toBeTruthy();

    const remakeAgain = await page.request.patch(
      `/api/tenant/${TENANT}/preloved/consignment-lots/${lotId}`,
      { data: { payoutStatus: "donated_proceeds" } },
    );
    expect(remakeAgain.status()).toBe(409);
    const remakeAgainBody = (await remakeAgain.json()) as {
      lot?: { payoutStatus?: string; payoutMarkedAt?: string | null };
    };
    expect(remakeAgainBody.lot?.payoutStatus).toBe("school_fee_credited");
    expect(remakeAgainBody.lot?.payoutMarkedAt).toBe(markedAt);
    await expect(row).toHaveAttribute("data-payout-status", "school_fee_credited");

    const createRes = await page.request.post(
      `/api/tenant/${TENANT}/preloved/consign`,
      {
        data: {
          familyName: "Derived",
          studentName: "Status",
          email: "derived@example.com",
          mobile: "0400000001",
          payoutPreference: "school_fee_credit",
          unsoldPreference: "donate",
          items: [{ garment: "Sports shorts", size: "12" }],
          termsAccepted: true,
        },
      },
    );
    expect(createRes.ok()).toBeTruthy();
    const created = (await createRes.json()) as {
      ticketCode?: string;
      id?: string;
    };
    expect(created.ticketCode).toMatch(/^CL-[A-Z0-9]{6}$/);
    expect(created.id).toBeTruthy();

    const deriveRes = await page.request.patch(
      `/api/tenant/${TENANT}/preloved/consignment-lots/${created.id}`,
      { data: { payoutStatus: "eft_paid" } },
    );
    expect(deriveRes.ok()).toBeTruthy();
    const deriveBody = (await deriveRes.json()) as {
      lot?: { payoutStatus?: string };
    };
    expect(deriveBody.lot?.payoutStatus).toBe("school_fee_credited");

    const badId = await page.request.patch(
      `/api/tenant/${TENANT}/preloved/consignment-lots/not-a-uuid`,
    );
    expect(badId.status()).toBe(404);

    const mergeCreate = await page.request.post(
      `/api/tenant/${TENANT}/preloved/consign`,
      {
        data: {
          familyName: "Merge",
          studentName: "Already",
          email: "merge-marked@example.com",
          mobile: "0400000002",
          payoutPreference: "school_fee_credit",
          unsoldPreference: "donate",
          items: [{ garment: "Sports jacket", size: "14" }],
          termsAccepted: true,
        },
      },
    );
    expect(mergeCreate.ok()).toBeTruthy();
    const mergeLot = (await mergeCreate.json()) as {
      ticketCode?: string;
      id?: string;
    };
    expect(mergeLot.ticketCode).toMatch(/^CL-[A-Z0-9]{6}$/);
    expect(mergeLot.id).toBeTruthy();

    await page.reload();
    const mergeRow = page.locator(
      `[data-testid="consignments-row"][data-ticket="${mergeLot.ticketCode}"]`,
    );
    await expect(mergeRow).toBeVisible({ timeout: 15_000 });
    await expect(mergeRow).toHaveAttribute("data-payout-status", "pending");

    const markFirst = await page.request.patch(
      `/api/tenant/${TENANT}/preloved/consignment-lots/${mergeLot.id}`,
    );
    expect(markFirst.ok()).toBeTruthy();
    await mergeRow.getByTestId("consignments-mark-payout").click();
    await expect(mergeRow).toHaveAttribute(
      "data-payout-status",
      "school_fee_credited",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("consignments-mark-error")).toHaveCount(0);
    } finally {
      await restoreDonationOnlyIntake(page);
    }
  });
});
