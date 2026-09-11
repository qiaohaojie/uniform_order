import { expect, test } from "playwright/test";
import { devLogin, TENANT } from "../preloved/helpers";

const MOCK_SALES_REVENUE = "$18,420";

test.describe("Admin dashboard and reports use live Neon data", () => {
  test("dashboard KPIs and recent orders are live, not the leftover mock pack", async ({ page }) => {
    await devLogin(page, `/admin/${TENANT}/dashboard`);
    await expect(page.getByTestId("admin-dashboard")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await expect(page.getByTestId("dashboard-kpi-revenue")).toContainText("Revenue · 30d");
    await expect(page.getByTestId("dashboard-kpi-orders")).toContainText("Orders · 30d");
    await expect(page.getByTestId("dashboard-kpi-avg")).toContainText("Avg order");
    await expect(page.getByTestId("dashboard-kpi-awaiting")).toContainText("Awaiting pickup");

    await expect(page.getByText(MOCK_SALES_REVENUE)).toHaveCount(0);
    await expect(page.getByText("Term 2 catalog")).toHaveCount(0);
    await expect(page.getByText("Stripe payout estimate")).toHaveCount(0);

    const recent = page.getByTestId("dashboard-recent-order");
    const emptyRecent = page.getByTestId("dashboard-recent-empty");
    await expect(recent.or(emptyRecent).first()).toBeVisible();

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
});
