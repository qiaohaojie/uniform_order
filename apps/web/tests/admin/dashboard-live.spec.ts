import { expect, test, type Page } from "playwright/test";

/**
 * Live Neon dashboard / reports. Does not start the app.
 * This worktree's shop rows are demo-academy / demo-blank / rgsh (imhs is not present).
 *
 *   pnpm dev:web
 *   PLAYWRIGHT_BASE_URL=… ADMIN_TENANT=demo-academy pnpm test:admin-dashboard
 */
const TENANT = process.env.ADMIN_TENANT ?? "demo-academy";
const EMPTY_TENANT = process.env.ADMIN_EMPTY_TENANT ?? "demo-blank";
const OPERATOR_EMAIL =
  process.env.OPERATOR_EMAIL ?? "operator@demo.uniformorder.online";
const MOCK_SALES_REVENUE = "$18,420";
const MOCK_ORDER_ID = "IMHS-04298";

async function devLogin(page: Page, callbackPath: string) {
  const callbackURL = encodeURIComponent(callbackPath);
  const email = encodeURIComponent(OPERATOR_EMAIL);
  await page.goto(`/api/dev/login?email=${email}&callbackURL=${callbackURL}`);
  await page.waitForURL((url) => !url.pathname.startsWith("/api/dev/login"));
  if (page.url().includes("/auth/") || page.url().includes("sign-in")) {
    throw new Error(
      "Dev login did not establish an admin session. Use pnpm dev:web (NODE_ENV=development) and an operator shop email.",
    );
  }
}

test.describe("Admin dashboard and reports use live Neon data", () => {
  test("dashboard KPIs and recent orders are live, not the leftover mock pack", async ({ page }) => {
    await devLogin(page, `/admin/${TENANT}/dashboard`);
    await expect(page.getByTestId("admin-dashboard")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await expect(page.getByTestId("dashboard-kpi-revenue")).toContainText("Revenue · 30d");
    await expect(page.getByTestId("dashboard-kpi-revenue")).toContainText("Paid orders");
    await expect(page.getByTestId("dashboard-kpi-orders")).toContainText("Orders · 30d");
    await expect(page.getByTestId("dashboard-kpi-avg")).toContainText("Avg order");
    await expect(page.getByTestId("dashboard-kpi-awaiting")).toContainText("Awaiting pickup");

    await expect(page.getByText(MOCK_SALES_REVENUE)).toHaveCount(0);
    await expect(page.getByText("Term 2 catalog")).toHaveCount(0);
    await expect(page.getByText("Stripe payout estimate")).toHaveCount(0);
    await expect(page.getByText(MOCK_ORDER_ID)).toHaveCount(0);

    const recent = page.getByTestId("dashboard-recent-order");
    await expect(recent.first()).toBeVisible();
    await expect(page.getByTestId("dashboard-attention")).toBeVisible();
  });

  test("reports KPIs and GST table read the same live shop totals", async ({ page }) => {
    await devLogin(page, `/admin/${TENANT}/reports`);
    await expect(page.getByTestId("admin-reports")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();

    await expect(page.getByTestId("reports-kpi-revenue")).toContainText("Total revenue");
    await expect(page.getByTestId("reports-kpi-orders")).toContainText("Total orders");
    await expect(page.getByTestId("reports-kpi-avg")).toContainText("Avg order value");
    await expect(page.getByTestId("reports-kpi-gst")).toContainText("GST collected");

    await expect(page.getByText(MOCK_SALES_REVENUE)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "GST summary (BAS-ready)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Monthly revenue" })).toBeVisible();
  });

  test("empty tenant shows empty sales, top-item, and recent-order copy", async ({ page }) => {
    await devLogin(page, `/admin/${EMPTY_TENANT}/dashboard`);
    await expect(page.getByTestId("admin-dashboard")).toBeVisible();
    await expect(page.getByTestId("dashboard-empty-sales")).toContainText("No paid orders in the last 30 days.");
    await expect(page.getByTestId("dashboard-top-items-empty")).toContainText("No live order lines yet.");
    await expect(page.getByTestId("dashboard-recent-empty")).toContainText("No live orders yet.");
    await expect(page.getByText(MOCK_SALES_REVENUE)).toHaveCount(0);
  });
});
