/**
 * Preloved follow-ups: write-off leftover-only + operator donation inbox.
 *
 * Does not start the app. From repo root:
 *   pnpm dev:web
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:<port> pnpm test:preloved-followups
 *
 * Defaults to demo-academy (live Neon has no imhs). Override with
 * PRELOVED_TENANT / OPERATOR_EMAIL.
 */
import { expect, test } from "playwright/test";
import { TENANT, devLogin, ensurePrelovedEnabled } from "./helpers";

const ADMIN_VIEWPORT = { width: 1440, height: 900 };
const MISSING_SKU = "00000000-0000-4000-8000-000000000000";

test.describe("Preloved follow-ups", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: ADMIN_VIEWPORT });

  test("qty-zero write-off is not eligible and does not invent written_off qty", async ({
    page,
  }) => {
    await devLogin(page, `/admin/${TENANT}/settings`);
    await ensurePrelovedEnabled(page);

    const res = await page.request.post(
      `/api/tenant/${TENANT}/preloved/skus/${MISSING_SKU}/write-off`,
    );
    const body = (await res.json()) as {
      error?: string;
      code?: string;
      qtyWrittenOff?: number;
      event?: { qty?: number };
    };
    expect(res.status()).toBe(409);
    expect(body.code).toBe("write_off_not_eligible");
    expect(body.qtyWrittenOff).toBeUndefined();
    expect(body.event).toBeUndefined();
  });

  test("donation inbox shows loading, error, empty, and a posted note", async ({
    page,
  }) => {
    await devLogin(page, `/admin/${TENANT}/settings`);
    await ensurePrelovedEnabled(page);

    const parent = `Inbox Parent ${Date.now()}`;
    const student = `Inbox Student ${Date.now()}`;

    const donate = await page.request.post(`/api/tenant/${TENANT}/preloved/donate`, {
      data: { parentName: parent, studentName: student, bagCount: 2 },
    });
    expect(donate.ok()).toBeTruthy();

    await page.route(`**/api/tenant/${TENANT}/preloved/donation-notes`, async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 750));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ notes: [] }),
      });
    });
    await page.goto(`/admin/${TENANT}/preloved/inbox`);
    await expect(page.getByTestId("donation-inbox-loading")).toBeVisible();
    await expect(page.getByTestId("donation-inbox-empty")).toBeVisible();

    await page.unroute(`**/api/tenant/${TENANT}/preloved/donation-notes`);
    await page.route(`**/api/tenant/${TENANT}/preloved/donation-notes`, async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Failed to load donation notes" }),
      });
    });
    await page.reload();
    await expect(page.getByTestId("donation-inbox-error")).toBeVisible();
    await expect(page.getByText("Could not load the inbox")).toBeVisible();

    await page.unroute(`**/api/tenant/${TENANT}/preloved/donation-notes`);
    await page.getByTestId("donation-inbox-retry").click();
    await expect(page.getByTestId("donation-inbox-list")).toBeVisible();
    await expect(page.getByText(parent, { exact: true })).toBeVisible();
    await expect(page.getByText(student, { exact: true })).toBeVisible();
    await expect(page.getByText("2 bags").first()).toBeVisible();
  });
});
